import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import os
import datetime
import warnings

warnings.simplefilter(action='ignore', category=FutureWarning)

# --- CONFIGURATION ---
if "SUPABASE_DB_URL" in os.environ:
    DB_CONNECTION_STR = os.environ["SUPABASE_DB_URL"]
else:
    # UPDATE THIS IF NEEDED
    DB_CONNECTION_STR = "postgresql://postgres.tvjklvwddqzpkgtkpixm:r24s15t28c3g10s15@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

engine = create_engine(DB_CONNECTION_STR)

# --- HELPER: NORMALIZE TO 50-99 ---
def normalize_to_99(series):
    """ Scales any dataset so the absolute best team is 99 and the worst is ~60. """
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val: return series.apply(lambda x: 75)
    return 60 + ((series - min_val) / (max_val - min_val)) * 39

# ==========================================
# PART 1: ADVANCED STRENGTH OF SCHEDULE (SOS)
# ==========================================
def calculate_complex_sos(target_season):
    print(f"📊 Analyzing Schedule for {target_season}...")
    
    # 1. Get Completed Games
    query = text(f"""
        SELECT home_team, away_team, home_score, away_score 
        FROM schedules 
        WHERE season = {target_season} 
        AND home_score IS NOT NULL
    """)
    with engine.connect() as conn:
        games = pd.read_sql(query, conn)

    # 2. Build Record Dictionary
    # team_data = { 'PHI': { 'wins': 8, 'games': 10, 'opponents': ['DAL', 'WAS', ...] } }
    team_data = {}
    all_teams = set(games['home_team']).union(set(games['away_team']))
    
    for t in all_teams:
        team_data[t] = {'wins': 0, 'games': 0, 'opponents': []}

    for _, row in games.iterrows():
        h, a = row['home_team'], row['away_team']
        h_score, a_score = row['home_score'], row['away_score']
        
        # Track Opponents
        team_data[h]['opponents'].append(a)
        team_data[a]['opponents'].append(h)
        team_data[h]['games'] += 1
        team_data[a]['games'] += 1
        
        # Track Wins
        if h_score > a_score: team_data[h]['wins'] += 1
        elif a_score > h_score: team_data[a]['wins'] += 1
        else: # Tie
            team_data[h]['wins'] += 0.5
            team_data[a]['wins'] += 0.5

    # 3. Calculate Layer 1: Win Percentage
    win_pct = {}
    for t, data in team_data.items():
        if data['games'] > 0:
            win_pct[t] = data['wins'] / data['games']
        else:
            win_pct[t] = 0.0

    # 4. Calculate Layer 2: Opponent Win % (OWP)
    # "How strong were the teams I played?"
    owp_scores = {}
    for t, data in team_data.items():
        opp_win_pcts = [win_pct[opp] for opp in data['opponents'] if opp in win_pct]
        if opp_win_pcts:
            owp_scores[t] = sum(opp_win_pcts) / len(opp_win_pcts)
        else:
            owp_scores[t] = 0.5

    # 5. Calculate Layer 3: Opponents' Opponent Win % (OOWP)
    # "How strong were the teams my opponents played?"
    # This catches the "Chargers" scenario: If Chargers played weak teams, their OOWP drops.
    oowp_scores = {}
    for t, data in team_data.items():
        opp_owp_scores = [owp_scores[opp] for opp in data['opponents'] if opp in owp_scores]
        if opp_owp_scores:
            oowp_scores[t] = sum(opp_owp_scores) / len(opp_owp_scores)
        else:
            oowp_scores[t] = 0.5

    # 6. Final SOS Score
    # Formula: 2/3 OWP + 1/3 OOWP (Standard RPI weighting)
    final_sos = []
    for t in all_teams:
        sos_val = (owp_scores.get(t, 0.5) * 0.67) + (oowp_scores.get(t, 0.5) * 0.33)
        final_sos.append({'team': t, 'raw_sos': sos_val, 'win_pct': win_pct.get(t, 0)})
    
    return pd.DataFrame(final_sos)


# ==========================================
# PART 2: TEAM TALENT AGGREGATION
# ==========================================
def calculate_team_talent():
    print("🧠 Aggregating Team Talent from Player Grades...")
    
    # Check if player grades exist
    try:
        with engine.connect() as conn:
            grades = pd.read_sql("SELECT * FROM player_season_grades", conn)
    except:
        print("❌ Error: 'player_season_grades' table not found. Please run the grading script first.")
        return pd.DataFrame()

    if grades.empty: return pd.DataFrame()

    # Define Position Groups
    off_pos = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C', 'OT', 'OG', 'OL']
    def_pos = ['DE', 'DT', 'LB', 'ILB', 'OLB', 'CB', 'S', 'DB', 'FS', 'SS', 'NT']

    team_talent = []
    
    teams = grades['team'].unique()
    for t in teams:
        roster = grades[grades['team'] == t]
        
        # OFFENSE SCORE (Weighted heavily by QB)
        qb_grade = roster[roster['position'] == 'QB']['grade'].max() or 50
        skill_grade = roster[roster['position'].isin(['WR', 'RB', 'TE'])]['grade'].mean() or 50
        ol_grade = roster[roster['position'].isin(['T', 'G', 'C', 'OT', 'OL'])]['grade'].mean() or 50
        
        # Formula: QB (40%) + Skill (30%) + OL (30%)
        off_score = (qb_grade * 0.4) + (skill_grade * 0.3) + (ol_grade * 0.3)
        
        # DEFENSE SCORE
        # Simply average the top 15 defenders (starters + key rotation)
        top_def = roster[roster['position'].isin(def_pos)].nlargest(15, 'grade')
        def_score = top_def['grade'].mean() or 50
        
        team_talent.append({
            'team': t,
            'off_grade': off_score,
            'def_grade': def_score,
            'qb_grade': qb_grade
        })
        
    return pd.DataFrame(team_talent)


# ==========================================
# PART 3: MASTER MERGE & RANK
# ==========================================
def generate_power_rankings():
    # 1. Detect Season
    with engine.connect() as conn:
        season = conn.execute(text("SELECT MAX(season) FROM schedules")).scalar()

    # 2. Run Computations
    sos_df = calculate_complex_sos(season)
    talent_df = calculate_team_talent()
    
    if talent_df.empty: return

    # 3. Merge
    df = pd.merge(sos_df, talent_df, on='team', how='inner')
    
    # 4. CALCULATE FINAL POWER 0-99
    # We normalize the inputs first to ensure they are on same scale
    df['norm_off'] = normalize_to_99(df['off_grade'])
    df['norm_def'] = normalize_to_99(df['def_grade'])
    
    # Normalize SOS (0-1 scale -> 50-99 scale)
    df['norm_sos'] = 50 + (df['raw_sos'] * 50) 
    
    # --- THE "PERFECTION" FORMULA ---
    # 40% Talent (Off/Def Split) + 40% Performance (Win Pct) + 20% Schedule Difficulty
    # This means a 9-0 team with a hard schedule will be #1 (Perfection)
    
    df['raw_power'] = (
        (df['norm_off'] * 0.25) + 
        (df['norm_def'] * 0.25) + 
        (df['win_pct'] * 100 * 0.30) + 
        (df['norm_sos'] * 0.20)
    )

    # Final Normalization: Map the highest calculated score to 99.9
    df['overall_power'] = normalize_to_99(df['raw_power'])
    
    # Renaming for DB Compatibility
    final_df = df[['team', 'overall_power', 'norm_off', 'norm_def', 'qb_grade', 'norm_sos']].copy()
    final_df.columns = ['team', 'overall_power', 'offense_grade', 'defense_grade', 'qb_grade', 'true_sos']
    
    # Rounding
    final_df = final_df.round(1)
    final_df = final_df.sort_values('overall_power', ascending=False)
    
    print("\n🏆 TOP 5 POWER RANKINGS:")
    print(final_df.head(5))

    # 5. Upload
    print(f"\n📤 Uploading {len(final_df)} teams to Supabase...")
    with engine.connect() as conn:
        final_df.to_sql('team_power_rankings', conn, if_exists='replace', index=False)
        print("✅ Done.")

if __name__ == "__main__":
    generate_power_rankings()