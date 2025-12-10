import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import os
import warnings

warnings.simplefilter(action='ignore', category=FutureWarning)

# --- CONFIGURATION ---
if "SUPABASE_DB_URL" in os.environ:
    DB_CONNECTION_STR = os.environ["SUPABASE_DB_URL"]
else:
    # Your Connection String
    DB_CONNECTION_STR = "postgresql://postgres.tvjklvwddqzpkgtkpixm:r24s15t28c3g10s15@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

engine = create_engine(DB_CONNECTION_STR)

# --- HELPER: NORMALIZE (0-100 Scale) ---
def normalize(series, inverted=False):
    if series.empty: return series
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val: return series.apply(lambda x: 75)
    
    if inverted:
        return 50 + ((max_val - series) / (max_val - min_val)) * 49
    else:
        return 50 + ((series - min_val) / (max_val - min_val)) * 49

def normalize_to_99(series):
    """ Scales best team to 99, worst to ~60 """
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val: return series.apply(lambda x: 75)
    return 60 + ((series - min_val) / (max_val - min_val)) * 39


# ==========================================
# PART 1: PLAYER GRADING ENGINE
# ==========================================
def run_player_grading(conn, target_season):
    print(f"   ↳ 1. Grading Players for {target_season}...")
    
    # Fetch Data
    query = text(f"""
        SELECT posteam, defteam, play_type, epa, sack, interception,
               passer_player_id, receiver_player_id, rusher_player_id,
               sack_player_id, interception_player_id
        FROM play_by_play 
        WHERE season = {target_season} AND play_type IN ('pass', 'run', 'no_play')
    """)
    pbp = pd.read_sql(query, conn)
    roster = pd.read_sql(text(f"SELECT * FROM rosters WHERE season = {target_season}"), conn)

    if pbp.empty: return pd.DataFrame()

    # Fix Roster Names
    name_col = next((c for c in ['player_name', 'full_name', 'name'] if c in roster.columns), 'full_name')
    roster = roster.rename(columns={name_col: 'full_name'})
    roster = roster[['player_id', 'full_name', 'position', 'team']].drop_duplicates(subset=['player_id'])

    grades = []

    # A. O-Line
    ol_stats = pbp[pbp['play_type'] == 'pass'].groupby('posteam')['sack'].mean().reset_index()
    ol_stats['grade'] = normalize(ol_stats['sack'], inverted=True)
    ol_map = ol_stats.set_index('posteam')['grade'].to_dict()
    
    linemen = roster[roster['position'].isin(['T','G','C','OT','OG','OL'])].copy()
    linemen['grade'] = linemen['team'].map(ol_map).fillna(50)
    grades.append(linemen[['player_id', 'team', 'grade']])

    # B. Defense (Sacks/INTs)
    sacks = pbp.groupby('sack_player_id').size().reset_index(name='sacks')
    ints = pbp.groupby('interception_player_id').size().reset_index(name='ints')
    def_df = pd.merge(sacks, ints, left_on='sack_player_id', right_on='interception_player_id', how='outer').fillna(0)
    def_df['player_id'] = def_df['sack_player_id'].combine_first(def_df['interception_player_id'])
    def_df['grade'] = normalize((def_df['sacks']*5) + (def_df['ints']*10))
    
    def_roster = def_df.merge(roster, on='player_id')
    def_roster = def_roster[def_roster['position'].isin(['DE','DT','LB','ILB','OLB','NT','CB','S','DB'])]
    grades.append(def_roster[['player_id', 'team', 'grade']])

    # C. Skill Players (EPA)
    # QBs
    qbs = pbp[pbp['play_type']=='pass'].groupby(['passer_player_id','posteam'])['epa'].mean().reset_index()
    qbs.columns = ['player_id','team','epa']
    qbs['grade'] = normalize(qbs['epa'])
    grades.append(qbs[['player_id','team','grade']])

    # RBs
    rbs = pbp[pbp['play_type']=='run'].groupby(['rusher_player_id','posteam'])['epa'].mean().reset_index()
    rbs.columns = ['player_id','team','epa']
    rbs['grade'] = normalize(rbs['epa'])
    grades.append(rbs[['player_id','team','grade']])

    # WRs
    recs = pbp.groupby(['receiver_player_id','posteam'])['epa'].mean().reset_index()
    recs.columns = ['player_id','team','epa']
    recs['grade'] = normalize(recs['epa'])
    grades.append(recs[['player_id','team','grade']])

    # Compile
    full_df = pd.concat(grades)
    full_df = full_df.merge(roster[['player_id', 'full_name', 'position']], on='player_id', how='left')
    
    # Cleanup
    if 'team_x' in full_df.columns: full_df['team'] = full_df['team_x'].fillna(full_df['team_y'])
    full_df = full_df[['player_id', 'full_name', 'team', 'position', 'grade']]
    full_df['grade'] = full_df['grade'].fillna(50)
    
    # Save to DB immediately
    print(f"   ✅ Saving {len(full_df)} Player Grades...")
    full_df.to_sql('player_season_grades', conn, if_exists='replace', index=False)
    conn.commit()
    
    return full_df


# ==========================================
# PART 2: 2-LAYER SOS ENGINE
# ==========================================
def calculate_sos(conn, target_season):
    print("   ↳ 2. Calculating Advanced SOS...")
    games = pd.read_sql(text(f"SELECT home_team, away_team, home_score, away_score FROM schedules WHERE season={target_season} AND home_score IS NOT NULL"), conn)
    
    team_data = {}
    all_teams = set(games['home_team']).union(set(games['away_team']))
    for t in all_teams: team_data[t] = {'wins':0, 'games':0, 'opps':[]}

    for _, g in games.iterrows():
        h, a = g['home_team'], g['away_team']
        team_data[h]['games'] += 1; team_data[a]['games'] += 1
        team_data[h]['opps'].append(a); team_data[a]['opps'].append(h)
        
        if g['home_score'] > g['away_score']: team_data[h]['wins'] += 1
        elif g['away_score'] > g['home_score']: team_data[a]['wins'] += 1
        else: team_data[h]['wins'] += 0.5; team_data[a]['wins'] += 0.5

    # Layer 1: Win Pct
    wp = {t: (d['wins']/d['games'] if d['games']>0 else 0) for t,d in team_data.items()}
    
    # Layer 2: Opponent Win Pct (OWP)
    owp = {}
    for t, d in team_data.items():
        opp_wps = [wp[o] for o in d['opps'] if o in wp]
        owp[t] = sum(opp_wps)/len(opp_wps) if opp_wps else 0.5
        
    # Layer 3: Opponents' Opponent Win Pct (OOWP)
    oowp = {}
    for t, d in team_data.items():
        opp_owps = [owp[o] for o in d['opps'] if o in owp]
        oowp[t] = sum(opp_owps)/len(opp_owps) if opp_owps else 0.5

    sos_list = []
    for t in all_teams:
        # RPI Formula: 25% WP, 50% OWP, 25% OOWP (NCAA Style)
        # We just want the Schedule Strength part:
        raw_sos = (owp.get(t, 0.5) * 0.67) + (oowp.get(t, 0.5) * 0.33)
        sos_list.append({'team': t, 'win_pct': wp.get(t, 0), 'raw_sos': raw_sos})
        
    return pd.DataFrame(sos_list)


# ==========================================
# PART 3: MASTER AGGREGATION
# ==========================================
def run_full_system():
    print("🚀 Starting NFL Nexus Logic Engine...")
    
    with engine.connect() as conn:
        season = conn.execute(text("SELECT MAX(season) FROM schedules")).scalar()
        
        # 1. Run Player Grading
        player_df = run_player_grading(conn, season)
        
        # 2. Run SOS
        sos_df = calculate_sos(conn, season)
        
        # 3. Aggregation
        print("   ↳ 3. merging Talent + Performance...")
        
        talent_list = []
        for t in player_df['team'].unique():
            roster = player_df[player_df['team'] == t]
            if roster.empty: continue
            
            qb = roster[roster['position']=='QB']['grade'].max() or 50
            # Offense: QB(40%) + Skill(30%) + OL(30%)
            skill = roster[roster['position'].isin(['WR','RB','TE'])]['grade'].mean() or 50
            ol = roster[roster['position'].isin(['T','G','C','OT','OL'])]['grade'].mean() or 50
            off_score = (qb*0.4) + (skill*0.3) + (ol*0.3)
            
            # Defense: Top 15 players
            def_top = roster[roster['position'].isin(['DE','DT','LB','CB','S'])].nlargest(15, 'grade')
            def_score = def_top['grade'].mean() or 50
            
            talent_list.append({'team': t, 'off_grade': off_score, 'def_grade': def_score, 'qb_grade': qb})
            
        talent_df = pd.DataFrame(talent_list)
        
        # Final Merge
        master = pd.merge(sos_df, talent_df, on='team')
        
        # Normalization
        master['norm_off'] = normalize_to_99(master['off_grade'])
        master['norm_def'] = normalize_to_99(master['def_grade'])
        master['norm_sos'] = 50 + (master['raw_sos'] * 50) # Scale SOS to 50-100 range
        
        # --- THE MASTER FORMULA ---
        # 40% Talent | 40% Winning | 20% Strength of Schedule
        master['raw_power'] = (
            (master['norm_off'] * 0.20) + 
            (master['norm_def'] * 0.20) + 
            (master['win_pct'] * 100 * 0.40) + 
            (master['norm_sos'] * 0.20)
        )
        
        master['overall_power'] = normalize_to_99(master['raw_power'])
        
        # Formatting for DB
        final_db = master[['team', 'overall_power', 'norm_off', 'norm_def', 'qb_grade', 'norm_sos']].copy()
        final_db.columns = ['team', 'overall_power', 'offense_grade', 'defense_grade', 'qb_grade', 'true_sos']
        final_db = final_db.round(1).sort_values('overall_power', ascending=False)
        
        print("\n🏆 TOP 5 POWER RANKINGS:")
        print(final_db.head(5))
        
        final_db.to_sql('team_power_rankings', conn, if_exists='replace', index=False)
        conn.commit()
        print("✅ SYSTEM COMPLETE. All tables updated.")

if __name__ == "__main__":
    run_full_system()