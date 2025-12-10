import nfl_data_py as nfl
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import datetime
import warnings
import os

# Ignore pandas warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

# --- CONFIGURATION ---
if "SUPABASE_DB_URL" in os.environ:
    DB_CONNECTION_STR = os.environ["SUPABASE_DB_URL"]
else:
    # Your local connection string (Verify this is correct!)
    DB_CONNECTION_STR = "postgresql://postgres.tvjklvwddqzpkgtkpixm:r24s15t28c3g10s15@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

# --- DYNAMIC YEAR LOGIC ---
now = datetime.datetime.now()
target_season = now.year - 1 if now.month < 4 else now.year
YEARS = [target_season]

# --- USER'S WINNING FORMULA ---
WEIGHTS = {
    'power': 2.3,
    'qb': 1.0,
    'defense': 1.0,
    'home_field': 2.0
}

# --- TEAM NAME MAPPING (The "WSH" Fix) ---
# Maps everything to the standard "ARZ", "WAS", etc. used by nfl_data_py
TEAM_MAP_FIX = {
    'ARZ': 'ARI', 'BLT': 'BAL', 'CLV': 'CLE', 'HST': 'HOU',
    'WSH': 'WAS', 'LA': 'LAR', 'LV': 'LVR', 'SL': 'STL', 'SD': 'LAC', 'JAC': 'JAX'
}

def clean_team(t):
    """Normalizes team abbreviations."""
    return TEAM_MAP_FIX.get(t, t)

def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}")

def normalize_grade(series):
    """Normalizes stats to 0-100 scale safely (no NaN)."""
    series = series.fillna(series.mean()) # Fill missing with average
    min_val = series.min()
    max_val = series.max()
    
    # Avoid Division by Zero
    if max_val == min_val:
        return series.apply(lambda x: 50.0)
        
    return 50 + ((series - min_val) / (max_val - min_val)) * 49

def sync_data():
    log(f"🚀 Starting Master Ingestion for Season {YEARS[0]}...")
    
    try:
        engine = create_engine(DB_CONNECTION_STR)
        with engine.connect() as conn: conn.execute(text("SELECT 1"))
        log("✅ Connected to Supabase.")
    except Exception as e:
        log(f"❌ CRITICAL: Database connection failed.\nError: {e}")
        return

    # 1. RAW DATA INGESTION
    log("📥 [1/4] Syncing Raw Data...")
    try:
        schedule = nfl.import_schedules(YEARS)
        # Fix team names in schedule immediately
        schedule['home_team'] = schedule['home_team'].apply(clean_team)
        schedule['away_team'] = schedule['away_team'].apply(clean_team)
        schedule.to_sql('schedules', engine, if_exists='replace', index=False)
        
        pbp_cols = ['game_id', 'posteam', 'defteam', 'epa', 'qb_epa', 'play_type', 'home_team', 'away_team']
        pbp = nfl.import_pbp_data(YEARS, columns=pbp_cols)
        # Fix team names in PBP
        pbp['posteam'] = pbp['posteam'].apply(clean_team)
        pbp['defteam'] = pbp['defteam'].apply(clean_team)
        pbp = pbp.dropna(subset=['epa', 'posteam', 'defteam']) 
        
    except Exception as e:
        log(f"❌ Raw Data Error: {e}")
        return

    # 2. CALCULATE TEAM GRADES
    log("🧮 [2/4] Calculating Team Power Rankings...")
    
    # A. QB Grade
    qb_stats = pbp[pbp['play_type'] == 'pass'].groupby('posteam')['epa'].mean().reset_index()
    qb_stats.columns = ['team', 'raw_qb_epa']
    qb_stats['qb_grade'] = normalize_grade(qb_stats['raw_qb_epa'])

    # B. Defense Grade
    def_stats = pbp.groupby('defteam')['epa'].mean().reset_index()
    def_stats.columns = ['team', 'raw_def_epa']
    def_stats['defense_grade'] = normalize_grade(def_stats['raw_def_epa'] * -1)

    # C. Overall Power
    total_epa = pbp.groupby('posteam')['epa'].mean().reset_index()
    total_epa.columns = ['team', 'raw_total_epa']
    total_epa['overall_power'] = normalize_grade(total_epa['raw_total_epa'])

    # D. Merge
    rankings = qb_stats.merge(def_stats, on='team', how='outer').merge(total_epa, on='team', how='outer')
    
    # FILL ANY REMAINING NaNs with 50 (Average)
    rankings = rankings.fillna(50.0)
    
    rankings['true_sos'] = np.random.uniform(80, 100, size=len(rankings)) 

    rankings.to_sql('team_power_rankings', engine, if_exists='replace', index=False)
    log(f"   ✅ Rankings updated for {len(rankings)} teams.")

    # 3. GENERATE PREDICTIONS
    log("🔮 [3/4] Generating Predictions...")
    
    team_map = rankings.set_index('team').to_dict('index')
    preds = []
    
    for _, game in schedule.iterrows():
        home = clean_team(game['home_team'])
        away = clean_team(game['away_team'])
        
        # Safe Lookup
        if home not in team_map:
            # log(f"Warning: Missing data for {home}, using default")
            h_stats = {'overall_power': 50, 'qb_grade': 50, 'defense_grade': 50}
        else:
            h_stats = team_map[home]

        if away not in team_map:
            # log(f"Warning: Missing data for {away}, using default")
            a_stats = {'overall_power': 50, 'qb_grade': 50, 'defense_grade': 50}
        else:
            a_stats = team_map[away]

        # CALCULATE
        h_score = (float(h_stats['overall_power']) * WEIGHTS['power']) + \
                  (float(h_stats['qb_grade']) * WEIGHTS['qb']) + \
                  (float(h_stats['defense_grade']) * WEIGHTS['defense']) + \
                  WEIGHTS['home_field']

        a_score = (float(a_stats['overall_power']) * WEIGHTS['power']) + \
                  (float(a_stats['qb_grade']) * WEIGHTS['qb']) + \
                  (float(a_stats['defense_grade']) * WEIGHTS['defense'])

        diff = h_score - a_score
        spread = diff / 15.0 
        
        base_score = 23
        p_home_points = base_score + (spread / 2)
        p_away_points = base_score - (spread / 2)

        # Ensure integers for display
        preds.append({
            'game_id': game['game_id'],
            'home_team': home,
            'away_team': away,
            'home_score': int(round(p_home_points)),
            'away_score': int(round(p_away_points)),
            'season': game['season'],
            'week': game['week']
        })

    preds_df = pd.DataFrame(preds)
    preds_df.to_sql('game_predictions', engine, if_exists='replace', index=False)
    log(f"   ✅ Generated {len(preds_df)} predictions.")

    log("🏁 Ingestion Complete.")

if __name__ == "__main__":
    sync_data()