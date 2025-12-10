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
    # Double check this connection string is correct!
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
    print("🧠 Starting Hybrid Grading System...")
    engine = create_engine(DB_CONNECTION_STR)
    
    try:
        with engine.connect() as conn:
            # 1. FIND CORRECT SEASON
            result = conn.execute(text("SELECT MAX(season) FROM play_by_play"))
            target_season = result.scalar()
            print(f"   ✅ Detected Data Year: {target_season}")

            # 2. FETCH DATA
            print(f"   ↳ Downloading Plays...")
            query = text(f"""
                SELECT 
                    posteam, defteam, play_type, epa, sack, interception,
                    passer_player_id, receiver_player_id, rusher_player_id,
                    sack_player_id, interception_player_id
                FROM play_by_play 
                WHERE season = {target_season} 
                  AND play_type IN ('pass', 'run', 'no_play')
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

    # --- SMART ROSTER MAPPING ---
    name_col = next((col for col in ['player_name', 'full_name', 'name'] if col in roster.columns), None)
    if not name_col:
        print("❌ Roster missing name column.")
        return
        
    roster = roster.rename(columns={name_col: 'full_name'})
    roster = roster[['player_id', 'full_name', 'position', 'team']].drop_duplicates(subset=['player_id'])

    final_grades = []

    # --- 1. GRADE OFFENSIVE LINE ---
    print("   ↳ Grading O-Line (Unit)...")
    team_ol_stats = pbp[pbp['play_type'] == 'pass'].groupby('posteam')['sack'].mean().reset_index()
    team_ol_stats['ol_grade'] = normalize(team_ol_stats['sack'], inverted=True)
    ol_grade_map = team_ol_stats.set_index('posteam')['ol_grade'].to_dict()
    
    linemen = roster[roster['position'].isin(['T', 'G', 'C', 'OT', 'OG', 'OL'])].copy()
    linemen['grade'] = linemen['team'].map(ol_grade_map).fillna(50)
    linemen['snaps'] = 100 
    if not linemen.empty: final_grades.append(linemen[['player_id', 'team', 'grade', 'snaps']])

    # --- 2. GRADE DEFENSE ---
    print("   ↳ Grading Defenders...")
    sacks = pbp[pbp['sack_player_id'].notnull()].groupby('sack_player_id').size().reset_index(name='sacks')
    ints = pbp[pbp['interception_player_id'].notnull()].groupby('interception_player_id').size().reset_index(name='ints')
    def_impact = pd.merge(sacks, ints, left_on='sack_player_id', right_on='interception_player_id', how='outer')
    def_impact['player_id'] = def_impact['sack_player_id'].combine_first(def_impact['interception_player_id'])
    def_impact = def_impact.fillna(0)
    
    def_impact['raw_score'] = (def_impact['sacks'] * 5) + (def_impact['ints'] * 10)
    def_impact['grade'] = normalize(def_impact['raw_score'])
    
    def_impact = def_impact.merge(roster, on='player_id', how='inner')
    def_roster = def_impact[def_impact['position'].isin(['DE', 'DT', 'LB', 'ILB', 'OLB', 'NT', 'CB', 'S', 'DB', 'FS', 'SS'])].copy()
    if not def_roster.empty:
        def_roster['snaps'] = 50
        final_grades.append(def_roster[['player_id', 'team', 'grade', 'snaps']])

    # --- 3. GRADE SKILL PLAYERS ---
    print("   ↳ Grading Skill Players...")
    # QBs
    qbs = pbp[pbp['play_type'] == 'pass'].groupby(['passer_player_id', 'posteam']).agg({'epa': 'mean'}).reset_index()
    qbs = qbs.rename(columns={'passer_player_id': 'player_id'})
    qbs['grade'] = normalize(qbs['epa'])
    qbs['snaps'] = 100
    final_grades.append(qbs)
    
    # RBs
    rbs = pbp[pbp['play_type'] == 'run'].groupby(['rusher_player_id', 'posteam']).agg({'epa': 'mean'}).reset_index()
    rbs = rbs.rename(columns={'rusher_player_id': 'player_id'})
    rbs['grade'] = normalize(rbs['epa'])
    rbs['snaps'] = 50
    final_grades.append(rbs)
    
    # WRs
    recs = pbp[(pbp['play_type'] == 'pass') & (pbp['receiver_player_id'].notnull())].groupby(['receiver_player_id', 'posteam']).agg({'epa': 'mean'}).reset_index()
    recs = recs.rename(columns={'receiver_player_id': 'player_id'})
    recs['grade'] = normalize(recs['epa'])
    recs['snaps'] = 50
    final_grades.append(recs)

    # --- 4. SAVE ---
    if final_grades:
        full_df = pd.concat(final_grades)
        save_df = full_df.merge(roster[['player_id', 'full_name', 'position']], on='player_id', how='left')
        
        # Cleanup
        if 'posteam' in save_df.columns: save_df['team'] = save_df['team'].fillna(save_df['posteam'])
        save_df = save_df[['player_id', 'full_name', 'team', 'position', 'grade', 'snaps']]
        save_df = save_df.rename(columns={'full_name': 'player_name'})
        save_df['grade'] = save_df['grade'].fillna(50).round(1)
        save_df = save_df.sort_values('grade', ascending=False).drop_duplicates(subset=['player_id'])
        
        print(f"   ↳ Saving {len(save_df)} graded players...")
        with engine.connect() as conn:
            save_df.to_sql('player_season_grades', conn, if_exists='replace', index=False)
            conn.commit()
            print("✅ Success: All players graded.")
    else:
        print("⚠️ No players graded.")

if __name__ == "__main__":
    run_grading_system()