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

def run_grading_system():
    print("🧠 Starting Smart Grading System...")
    engine = create_engine(DB_CONNECTION_STR)
    
    try:
        with engine.connect() as conn:
            # 1. FIND CORRECT SEASON
            result = conn.execute(text("SELECT MAX(season) FROM play_by_play"))
            target_season = result.scalar()
            print(f"   ✅ Detected Data Year: {target_season}")

            # 2. FETCH DATA
            print(f"   ↳ Downloading Plays + Participation for {target_season}...")
            
            # Try robust join
            query = text(f"""
                SELECT 
                    p.play_id, p.game_id, p.posteam, p.defteam, p.play_type, 
                    p.epa, p.yards_gained, p.sack, p.fumble, p.interception, p.complete_pass,
                    p.passer_player_id, p.receiver_player_id, p.rusher_player_id,
                    p.sack_player_id, p.interception_player_id,
                    part.offense_players, part.defense_players
                FROM play_by_play p
                LEFT JOIN participation part 
                    ON p.play_id = part.play_id 
                    AND (
                        p.game_id = part.nflverse_game_id 
                        OR 
                        CAST(p.old_game_id AS TEXT) = CAST(part.old_game_id AS TEXT)
                    )
                WHERE p.season = {target_season} 
                  AND p.play_type IN ('pass', 'run')
            """)
            pbp = pd.read_sql(query, conn)
            
            # 3. FETCH ROSTER
            print("   ↳ Downloading Roster...")
            roster = pd.read_sql(text(f"SELECT * FROM rosters WHERE season = {target_season}"), conn)

    except Exception as e:
        print(f"❌ DB Error: {e}")
        return

    if pbp.empty:
        print("❌ No play data found.")
        return

    # --- SMART ROSTER COLUMN DETECTION ---
    name_col = next((col for col in ['player_name', 'full_name', 'name'] if col in roster.columns), None)
    if not name_col:
        print(f"❌ Roster missing name column. Available: {roster.columns.tolist()}")
        return
        
    roster = roster.rename(columns={name_col: 'full_name'})
    roster = roster[['player_id', 'full_name', 'position', 'team']].drop_duplicates(subset=['player_id'])

    # --- CHECK FOR PARTICIPATION DATA ---
    has_participation = not pbp['offense_players'].isnull().all()
    
    if has_participation:
        # === PLAN A: FULL GRADING (WITH LINEMEN) ===
        print(f"   ✅ Participation Linked. Processing Snap Counts...")
        
        player_stats = {}
        def update_stat(pid, metric, val=1):
            if pid not in player_stats:
                player_stats[pid] = {'snaps': 0, 'epa_sum': 0, 'sacks_on_field': 0, 'indiv_sacks': 0, 'indiv_int': 0}
            player_stats[pid][metric] += val

        for _, play in pbp.iterrows():
            if play['offense_players']:
                try:
                    for pid in str(play['offense_players']).split(';'):
                        update_stat(pid, 'snaps')
                        update_stat(pid, 'epa_sum', play['epa'] or 0)
                        if play['sack'] == 1: update_stat(pid, 'sacks_on_field')
                except: pass
            if play['defense_players']:
                try:
                    for pid in str(play['defense_players']).split(';'):
                        update_stat(pid, 'snaps')
                        if play['sack_player_id'] == pid: update_stat(pid, 'indiv_sacks')
                        if play['interception_player_id'] == pid: update_stat(pid, 'indiv_int')
                except: pass

        df = pd.DataFrame.from_dict(player_stats, orient='index').reset_index().rename(columns={'index': 'player_id'})
        df = df.merge(roster, on='player_id', how='inner')
        df = df[df['snaps'] > 25].copy()

        final_grades = []
        # OL
        mask = df['position'].isin(['T', 'G', 'C', 'OT', 'OG', 'OL'])
        if mask.any():
            sub = df[mask].copy()
            sub['sack_rate'] = (sub['sacks_on_field'] / sub['snaps']) * 100
            sub['grade'] = normalize(sub['sack_rate'], inverted=True)
            final_grades.append(sub)
        # Defense
        mask = df['position'].isin(['DE', 'DT', 'LB', 'ILB', 'OLB', 'NT', 'DL', 'CB', 'S', 'FS', 'SS', 'DB'])
        if mask.any():
            sub = df[mask].copy()
            sub['prod'] = ((sub['indiv_sacks'] * 5) + (sub['indiv_int'] * 10)) / sub['snaps']
            sub['grade'] = normalize(sub['prod'])
            final_grades.append(sub)
        # Skill
        mask = df['position'].isin(['QB', 'RB', 'WR', 'TE'])
        if mask.any():
            sub = df[mask].copy()
            sub['prod'] = sub['epa_sum'] / sub['snaps']
            sub['grade'] = normalize(sub['prod'])
            final_grades.append(sub)

        if final_grades:
            full_df = pd.concat(final_grades)
            save_df = full_df[['player_id', 'full_name', 'team', 'position', 'grade', 'snaps']]

    else:
        # === PLAN B: FAIL-SAFE (SKILL ONLY) ===
        print("   ⚠️ Participation Missing. Switching to Skill-Position Only Grading...")
        
        # QBs
        qbs = pbp[pbp['play_type'] == 'pass'].groupby(['passer_player_id', 'posteam']).agg({'epa': 'mean', 'play_type': 'count'}).reset_index()
        qbs = qbs[qbs['play_type'] > 20].rename(columns={'passer_player_id': 'player_id', 'play_type': 'snaps'})
        qbs['grade'] = normalize(qbs['epa'])
        
        # RBs
        rbs = pbp[pbp['play_type'] == 'run'].groupby(['rusher_player_id', 'posteam']).agg({'epa': 'mean', 'play_type': 'count'}).reset_index()
        rbs = rbs[rbs['play_type'] > 15].rename(columns={'rusher_player_id': 'player_id', 'play_type': 'snaps'})
        rbs['grade'] = normalize(rbs['epa'])
        
        # WRs
        recs = pbp[(pbp['play_type'] == 'pass') & (pbp['receiver_player_id'].notnull())].groupby(['receiver_player_id', 'posteam']).agg({'epa': 'mean', 'play_type': 'count'}).reset_index()
        recs = recs[recs['play_type'] > 10].rename(columns={'receiver_player_id': 'player_id', 'play_type': 'snaps'})
        recs['grade'] = normalize(recs['epa'])

        final_grades = [qbs, rbs, recs]
        full_df = pd.concat(final_grades)
        
        # Merge with Roster to get names/positions
        # FIX: Use 'team' not 'team_x' because there is no column collision (full_df has 'posteam', roster has 'team')
        save_df = full_df.merge(roster[['player_id', 'full_name', 'position', 'team']], on='player_id', how='left')
        save_df = save_df[['player_id', 'full_name', 'team', 'position', 'grade', 'snaps']]

    # --- SAVE ---
    if not save_df.empty:
        save_df = save_df.rename(columns={'full_name': 'player_name'})
        save_df['grade'] = save_df['grade'].fillna(50).round(1)
        
        print(f"   ↳ Saving {len(save_df)} graded players...")
        try:
            with engine.connect() as conn:
                save_df.to_sql('player_season_grades', conn, if_exists='replace', index=False)
                conn.commit()
                print("✅ Success: Players graded.")
        except Exception as e:
            print(f"❌ Upload Error: {e}")
    else:
        print("⚠️ No players graded.")

if __name__ == "__main__":
    run_grading_system()