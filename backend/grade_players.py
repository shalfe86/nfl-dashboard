import pandas as pd
from sqlalchemy import create_engine, text
import numpy as np
import os
import datetime

# --- CONFIGURATION ---
if "SUPABASE_DB_URL" in os.environ:
    DB_CONNECTION_STR = os.environ["SUPABASE_DB_URL"]
else:
    DB_CONNECTION_STR = "postgresql://postgres.tvjklvwddqzpkgtkpixm:r24s15t28c3g10s15@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

# Dynamic Season
now = datetime.datetime.now()
CURRENT_SEASON = now.year - 1 if now.month < 4 else now.year

def normalize(series):
    """ Scales a column of numbers to be between 50 and 99 """
    min_val = series.min()
    max_val = series.max()
    # Formula: 50 + ( (Value - Min) / (Max - Min) ) * 49
    return 50 + ((series - min_val) / (max_val - min_val)) * 49

def run_grading_system():
    print(f"🧠 Starting Player & Team Grading for {CURRENT_SEASON}...")
    
    engine = create_engine(DB_CONNECTION_STR)
    
    # 1. FETCH RAW PLAYS
    try:
        with engine.connect() as conn:
            # We only want plays that actually happened (no timeouts, no penalties that negate play)
            query = text(f"""
                SELECT posteam, defteam, passer_player_name, receiver_player_name, 
                       rusher_player_name, epa, play_type, cpoe, success 
                FROM play_by_play 
                WHERE season = {CURRENT_SEASON} 
                  AND play_type IN ('pass', 'run')
                  AND epa IS NOT NULL
            """)
            pbp = pd.read_sql(query, conn)
    except Exception as e:
        print(f"❌ DB Error: {e}")
        return

    if pbp.empty:
        print("❌ No play data found.")
        return

    print(f"   ↳ Processing {len(pbp)} plays...")

    # --- 2. GRADE QUARTERBACKS ---
    # Group by Passer -> Avg EPA + Total Dropbacks
    qbs = pbp[pbp['play_type'] == 'pass'].groupby(['passer_player_name', 'posteam']).agg({
        'epa': 'mean',
        'cpoe': 'mean', # Completion % Over Expected
        'play_type': 'count'
    }).reset_index()
    
    # Filter: Minimum 50 dropbacks to get a grade
    qbs = qbs[qbs['play_type'] > 50].copy()
    
    # Create the 0-100 Grade
    # Weight: 70% EPA (Efficiency), 30% CPOE (Accuracy)
    qbs['raw_score'] = (qbs['epa'] * 0.7) + (qbs['cpoe'] * 0.03) 
    qbs['qb_grade'] = normalize(qbs['raw_score'])
    
    # Save QB grades for reference
    team_qb_grades = qbs.groupby('posteam')['qb_grade'].max().to_dict()

    # --- 3. GRADE DEFENSES ---
    # Group by Defense Team -> Avg EPA Allowed (Lower is better)
    defs = pbp.groupby('defteam').agg({
        'epa': 'mean'
    }).reset_index()
    
    # Invert EPA because negative EPA is good for defense
    defs['raw_score'] = defs['epa'] * -1 
    defs['def_grade'] = normalize(defs['raw_score'])
    
    team_def_grades = defs.set_index('defteam')['def_grade'].to_dict()

    # --- 4. CALCULATE TEAM POWER SCORE ---
    # Combine QB Performance + Defensive Performance
    teams = []
    
    all_teams = set(pbp['posteam'].dropna().unique())
    
    for team in all_teams:
        qb_score = team_qb_grades.get(team, 50) # Default to 50 if rookie/backup
        def_score = team_def_grades.get(team, 50)
        
        # THE SECRET SAUCE FORMULA
        # Good teams usually have Great QBs (45%) or Elite Defenses (40%)
        # We give slight weight to "Rest of Offense" implicitly via QB EPA
        total_grade = (qb_score * 0.50) + (def_score * 0.50)
        
        teams.append({
            'team': team,
            'season': CURRENT_SEASON,
            'qb_grade': round(qb_score, 1),
            'defense_grade': round(def_score, 1),
            'overall_power': round(total_grade, 1)
        })

    # --- 5. CALCULATE "TRUE SOS" ---
    # SOS = Average Power Score of Opponents Played So Far
    
    # Fetch schedule to find opponents
    try:
        with engine.connect() as conn:
            sched = pd.read_sql(text(f"SELECT home_team, away_team, result FROM schedules WHERE season = {CURRENT_SEASON}"), conn)
    except: sched = pd.DataFrame()

    # Create a map for fast lookup
    power_map = {t['team']: t['overall_power'] for t in teams}
    
    final_data = []
    for team_obj in teams:
        team = team_obj['team']
        
        # Find opponents
        home_games = sched[sched['home_team'] == team]
        away_games = sched[sched['away_team'] == team]
        
        opponents = pd.concat([home_games['away_team'], away_games['home_team']])
        
        # Calculate Average Power of those opponents
        opp_powers = [power_map.get(opp, 50) for opp in opponents]
        true_sos = np.mean(opp_powers) if opp_powers else 50.0
        
        team_obj['true_sos'] = round(true_sos, 1)
        final_data.append(team_obj)

    # --- 6. SAVE TO DB ---
    df_power = pd.DataFrame(final_data)
    print("   ↳ Top 5 Teams by Power Grade:")
    print(df_power.sort_values('overall_power', ascending=False).head())

    try:
        with engine.connect() as conn:
            df_power.to_sql('team_power_rankings', conn, if_exists='replace', index=False)
            conn.commit()
            print("✅ Team Grades & SOS Synced.")
    except Exception as e:
        print(f"❌ Upload Error: {e}")

if __name__ == "__main__":
    run_grading_system()