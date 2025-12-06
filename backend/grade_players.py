import pandas as pd
from sqlalchemy import create_engine, text
import numpy as np
import os
import datetime
import warnings

warnings.simplefilter(action='ignore', category=FutureWarning)

# --- CONFIGURATION ---
if "SUPABASE_DB_URL" in os.environ:
    DB_CONNECTION_STR = os.environ["SUPABASE_DB_URL"]
else:
    DB_CONNECTION_STR = "postgresql://postgres.tvjklvwddqzpkgtkpixm:r24s15t28c3g10s15@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

def normalize(series, inverted=False):
    """ Scales data to 50-99. """
    if series.empty: return series
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val: return series.apply(lambda x: 75)
    
    if inverted:
        return 50 + ((max_val - series) / (max_val - min_val)) * 49
    else:
        return 50 + ((series - min_val) / (max_val - min_val)) * 49

def run_analysis_system():
    print("🧠 Starting Master Analysis Engine...")
    engine = create_engine(DB_CONNECTION_STR)
    
    try:
        with engine.connect() as conn:
            # 1. FIND SEASON
            result = conn.execute(text("SELECT MAX(season) FROM play_by_play"))
            target_season = result.scalar()
            print(f"   ✅ Detected Season: {target_season}")

            # 2. FETCH ALL DATA NEEDED
            print(f"   ↳ Downloading Data...")
            
            pbp_query = text(f"""
                SELECT 
                    p.play_id, p.game_id, p.posteam, p.defteam, p.play_type, 
                    p.epa, p.yards_gained, p.sack, p.fumble, p.interception, p.complete_pass,
                    p.passer_player_id, p.receiver_player_id, p.rusher_player_id,
                    p.sack_player_id, p.interception_player_id,
                    part.offense_players, part.defense_players
                FROM play_by_play p
                LEFT JOIN participation part 
                    ON p.play_id = part.play_id 
                    AND (p.game_id = part.nflverse_game_id OR CAST(p.old_game_id AS TEXT) = CAST(part.old_game_id AS TEXT))
                WHERE p.season = {target_season} AND p.play_type IN ('pass', 'run')
            """)
            pbp = pd.read_sql(pbp_query, conn)
            
            roster = pd.read_sql(text(f"SELECT * FROM rosters WHERE season = {target_season}"), conn)
            standings = pd.read_sql(text(f"SELECT * FROM standings WHERE season = {target_season}"), conn)
            schedule = pd.read_sql(text(f"SELECT * FROM schedules WHERE season = {target_season}"), conn)

    except Exception as e:
        print(f"❌ DB Error: {e}")
        return

    if pbp.empty: return

    # --- PART 1: PLAYER GRADING (Fail-Safe) ---
    print("   ↳ 1. Grading Players...")
    
    # Roster Fix
    name_col = next((col for col in ['player_name', 'full_name', 'name'] if col in roster.columns), None)
    if name_col:
        roster = roster.rename(columns={name_col: 'full_name'})
        roster = roster[['player_id', 'full_name', 'position', 'team']].drop_duplicates(subset=['player_id'])

    final_grades = []
    
    # Skill Grades (Always run)
    qbs = pbp[pbp['play_type'] == 'pass'].groupby(['passer_player_id', 'posteam']).agg({'epa': 'mean', 'play_type': 'count'}).reset_index()
    qbs = qbs[qbs['play_type'] > 20].rename(columns={'passer_player_id': 'player_id', 'play_type': 'snaps'})
    qbs['grade'] = normalize(qbs['epa'])
    final_grades.append(qbs)
    
    rbs = pbp[pbp['play_type'] == 'run'].groupby(['rusher_player_id', 'posteam']).agg({'epa': 'mean', 'play_type': 'count'}).reset_index()
    rbs = rbs[rbs['play_type'] > 15].rename(columns={'rusher_player_id': 'player_id', 'play_type': 'snaps'})
    rbs['grade'] = normalize(rbs['epa'])
    final_grades.append(rbs)
    
    recs = pbp[(pbp['play_type'] == 'pass') & (pbp['receiver_player_id'].notnull())].groupby(['receiver_player_id', 'posteam']).agg({'epa': 'mean', 'play_type': 'count'}).reset_index()
    recs = recs[recs['play_type'] > 10].rename(columns={'receiver_player_id': 'player_id', 'play_type': 'snaps'})
    recs['grade'] = normalize(recs['epa'])
    final_grades.append(recs)

    # Lineman/Defense Grades (If participation exists)
    if not pbp['offense_players'].isnull().all():
        player_stats = {}
        def update_stat(pid, val=1):
            if pid not in player_stats: player_stats[pid] = 0
            player_stats[pid] += val

        for _, play in pbp.iterrows():
            if play['offense_players']:
                for pid in str(play['offense_players']).split(';'): update_stat(pid)
            if play['defense_players']:
                for pid in str(play['defense_players']).split(';'): update_stat(pid)

        snap_df = pd.DataFrame.from_dict(player_stats, orient='index', columns=['snaps']).reset_index().rename(columns={'index': 'player_id'})
        snap_df = snap_df.merge(roster, on='player_id')
        
        linemen = snap_df[snap_df['position'].isin(['T','G','C','OT','OG','OL','DE','DT','LB','NT','CB','S','DB'])]
        if not linemen.empty:
            linemen['grade'] = normalize(linemen['snaps'])
            # Ensure columns match for concat
            linemen_clean = linemen[['player_id', 'team', 'grade', 'snaps']].rename(columns={'team': 'posteam'})
            final_grades.append(linemen_clean)

    # Save Players
    if final_grades:
        full_df = pd.concat(final_grades)
        
        # Merge with Roster
        # This is where the error happened. We fix it by being explicit.
        save_df = full_df.merge(roster[['player_id', 'full_name', 'position', 'team']], on='player_id', how='left')
        
        # Logic to pick the right team column (Roster team vs Stat team)
        # If 'team_y' exists, that's the roster team. Use it.
        if 'team_y' in save_df.columns:
            save_df['team'] = save_df['team_y'].fillna(save_df['team_x'])
        elif 'team' in save_df.columns:
            # If no collision, 'team' is from the roster.
            pass
        elif 'posteam' in save_df.columns:
            # Fallback to the team they played for in the stats
            save_df['team'] = save_df['posteam']
            
        # Final cleanup
        save_df = save_df[['player_id', 'full_name', 'team', 'position', 'grade', 'snaps']]
        save_df = save_df.rename(columns={'full_name': 'player_name'})
        save_df['grade'] = save_df['grade'].fillna(50).round(1)
        
        try:
            with engine.connect() as conn:
                save_df.to_sql('player_season_grades', conn, if_exists='replace', index=False)
                conn.commit()
        except: pass

    # --- PART 2: TEAM POWER RANKINGS ---
    print("   ↳ 2. Calculating Team Power...")
    
    # Simple aggregations
    if not save_df.empty:
        team_power = save_df.groupby('team')['grade'].mean().reset_index()
        team_power.columns = ['team', 'overall_power']
        
        qb_grades = save_df[save_df['position'] == 'QB'].groupby('team')['grade'].max().reset_index().rename(columns={'grade': 'qb_grade'})
        
        # Calculate Defense Grade (Inverse of EPA allowed)
        defs = pbp.groupby('defteam').agg({'epa': 'mean'}).reset_index()
        defs['defense_grade'] = normalize(defs['epa'] * -1)
        defs = defs.rename(columns={'defteam': 'team'})
        
        final_teams = team_power.merge(qb_grades, on='team', how='left').merge(defs[['team', 'defense_grade']], on='team', how='left').fillna(50)
        
        # SOS Calculation
        power_map = final_teams.set_index('team')['overall_power'].to_dict()
        sos_list = []
        
        for t in final_teams['team']:
            # Find opponents
            games = schedule[(schedule['home_team'] == t) | (schedule['away_team'] == t)]
            opps = [g['away_team'] if g['home_team'] == t else g['home_team'] for _, g in games.iterrows()]
            opp_powers = [power_map.get(o, 50) for o in opps]
            sos_list.append(np.mean(opp_powers) if opp_powers else 50)
            
        final_teams['true_sos'] = [round(x, 1) for x in sos_list]
        
        # Save Teams
        try:
            with engine.connect() as conn:
                final_teams.to_sql('team_power_rankings', conn, if_exists='replace', index=False)
                conn.commit()
        except: pass

    # --- PART 3: PREDICTION ENGINE (NO TIES) ---
    print("   ↳ 3. Predicting Scores...")
    
    col_w = 'wins' if 'wins' in standings.columns else 'w'
    
    # Handle standings if empty or missing columns
    if not standings.empty and col_w in standings.columns:
        # Normalize column name for lookup
        if 'team' not in standings.columns and 'team_abbr' in standings.columns:
             standings = standings.rename(columns={'team_abbr': 'team'})
        
        win_map = standings.set_index('team')[col_w].to_dict()
    else:
        win_map = {}
    
    predictions = []
    
    for _, game in schedule.iterrows():
        home, away = game['home_team'], game['away_team']
        
        # Factors
        h_pwr = power_map.get(home, 50)
        a_pwr = power_map.get(away, 50)
        
        # Momentum (Wins)
        h_mom = win_map.get(home, 0) * 0.5
        a_mom = win_map.get(away, 0) * 0.5
        
        # Formula
        home_edge = 2.5 + (h_pwr - a_pwr)/2 + (h_mom - a_mom)
        
        # Base Score
        base = 20
        
        # Adjust for Offense Strength vs Def Weakness
        h_proj = base + (h_pwr - 50)*0.4 + (home_edge/2)
        a_proj = base + (a_pwr - 50)*0.4 - (home_edge/2)
        
        # --- TIE BREAKER LOGIC ---
        final_h = round(h_proj)
        final_a = round(a_proj)
        
        if final_h == final_a:
            if h_proj > a_proj: final_h += 1
            else: final_a += 1
        
        predictions.append({
            'game_id': game['game_id'],
            'home_team': home,
            'away_team': away,
            'home_proj_score': int(final_h),
            'away_proj_score': int(final_a),
            'win_prob': round(50 + (home_edge * 3), 1)
        })

    # Save Predictions
    df_pred = pd.DataFrame(predictions)
    try:
        with engine.connect() as conn:
            df_pred.to_sql('game_predictions', conn, if_exists='replace', index=False)
            conn.commit()
            print("✅ Predictions Synced.")
    except Exception as e:
        print(f"❌ Predict Error: {e}")

if __name__ == "__main__":
    run_analysis_system()