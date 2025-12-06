import nfl_data_py as nfl
import pandas as pd
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
    # Your local connection string
    DB_CONNECTION_STR = "postgresql://postgres.tvjklvwddqzpkgtkpixm:r24s15t28c3g10s15@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

# --- DYNAMIC YEAR LOGIC ---
now = datetime.datetime.now()
if now.month < 4:
    target_season = now.year - 1
else:
    target_season = now.year

YEARS = [target_season]

def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}")

def sync_data():
    log(f"🚀 Starting Master Ingestion for Season {YEARS[0]}...")
    
    try:
        engine = create_engine(DB_CONNECTION_STR)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        log("✅ Connected to Supabase.")
    except Exception as e:
        log(f"❌ CRITICAL: Database connection failed.\nError: {e}")
        return

    # 1. Schedule
    log("📥 [1/5] Downloading Schedule...")
    try:
        schedule = nfl.import_schedules(YEARS)
        schedule.to_sql('schedules', engine, if_exists='replace', index=False)
        log(f"   ✅ Schedules synced: {len(schedule)} games.")
    except Exception as e: log(f"   ❌ Schedule Error: {e}")

    # 2. Rosters
    log("📥 [2/5] Downloading Rosters...")
    try:
        rosters = nfl.import_seasonal_rosters(YEARS)
        rosters.to_sql('rosters', engine, if_exists='replace', index=False)
        log(f"   ✅ Rosters synced: {len(rosters)} players.")
    except Exception as e: log(f"   ❌ Roster Error: {e}")

    # 3. Standings (DIRECT DOWNLOAD FIX)
    log("📥 [3/5] Downloading Standings & Ranks...")
    try:
        # Direct URL to the live nflverse standings file
        url = "https://github.com/nflverse/nfldata/raw/master/data/standings.csv"
        standings = pd.read_csv(url)
        
        # Filter for the current season to keep it relevant
        standings = standings[standings['season'].isin(YEARS)]
        
        standings.to_sql('standings', engine, if_exists='replace', index=False)
        log(f"   ✅ Standings synced: {len(standings)} rows.")
    except Exception as e: 
        log(f"   ❌ Standings Error: {e}")

    # 4. Play-by-Play
    log("📥 [4/5] Downloading PBP (Standard)...")
    try:
        pbp = nfl.import_pbp_data(YEARS)
        pbp.to_sql('play_by_play', engine, if_exists='replace', index=False)
        log(f"   ✅ PBP synced: {len(pbp)} plays.")
    except Exception as e: log(f"   ❌ PBP Error: {e}")

    # 5. Participation
    log("📥 [5/5] Downloading Participation...")
    try:
        if hasattr(nfl, 'import_pbp_participation'):
            part = nfl.import_pbp_participation(YEARS)
        else:
            log("   ⚠️ Library outdated, using direct download...")
            url = f"https://github.com/nflverse/nflverse-data/releases/download/pbp_participation/pbp_participation_{YEARS[0]}.csv"
            part = pd.read_csv(url)
            
        part.to_sql('participation', engine, if_exists='replace', index=False)
        log(f"   ✅ Participation synced: {len(part)} records.")
    except Exception as e:
        log(f"   ❌ Participation Error: {e}")

    log("🏁 Ingestion Complete.")

if __name__ == "__main__":
    sync_data()