import nfl_data_py as nfl
import pandas as pd
from sqlalchemy import create_engine, text
import datetime
import warnings
import os  # <--- NEW: Needed to read GitHub Secrets

# Ignore pandas warnings to keep logs clean
warnings.simplefilter(action='ignore', category=FutureWarning)

# --- CONFIGURATION ---
# LOGIC: Check if running on GitHub Actions (Secret) OR Local (Hardcoded)
if "SUPABASE_DB_URL" in os.environ:
    # This runs when GitHub Actions executes the script
    DB_CONNECTION_STR = os.environ["SUPABASE_DB_URL"]
else:
    # This runs when YOU execute the script manually in Codespaces
    # Your local hardcoded connection string:
    DB_CONNECTION_STR = "postgresql://postgres.tvjklvwddqzpkgtkpixm:r24s15t28c3g10s15@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

# --- DYNAMIC YEAR LOGIC ---
# Automatically decide which season to download based on today's date
now = datetime.datetime.now()
if now.month < 4:
    # If it's Jan, Feb, or Mar, we want the season that started last year (Playoffs)
    target_season = now.year - 1
else:
    # If it's April through Dec, we want the current calendar year
    target_season = now.year

# Set the target year
YEARS = [target_season]

def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}")

def sync_data():
    log(f"🚀 Starting Master Ingestion for Season {YEARS[0]}...")
    
    # 1. Connect to Database
    try:
        engine = create_engine(DB_CONNECTION_STR)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        log("✅ Connected to Supabase.")
    except Exception as e:
        log(f"❌ CRITICAL: Database connection failed.\nError: {e}")
        return

    # 2. Schedule
    log("📥 [1/4] Downloading Schedule...")
    try:
        schedule = nfl.import_schedules(YEARS)
        schedule.to_sql('schedules', engine, if_exists='replace', index=False)
        log(f"   ✅ Schedules synced: {len(schedule)} games.")
    except Exception as e: log(f"   ❌ Schedule Error: {e}")

    # 3. Rosters
    log("📥 [2/4] Downloading Rosters...")
    try:
        rosters = nfl.import_seasonal_rosters(YEARS)
        rosters.to_sql('rosters', engine, if_exists='replace', index=False)
        log(f"   ✅ Rosters synced: {len(rosters)} players.")
    except Exception as e: log(f"   ❌ Roster Error: {e}")

    # 4. Play-by-Play
    log("📥 [3/4] Downloading PBP (Standard)...")
    try:
        pbp = nfl.import_pbp_data(YEARS)
        pbp.to_sql('play_by_play', engine, if_exists='replace', index=False)
        log(f"   ✅ PBP synced: {len(pbp)} plays.")
    except Exception as e: log(f"   ❌ PBP Error: {e}")

    # 5. Participation (The "Linemen" Data) - WITH FALLBACK
    log("📥 [4/4] Downloading Participation...")
    try:
        # Try the library function first
        if hasattr(nfl, 'import_pbp_participation'):
            part = nfl.import_pbp_participation(YEARS)
        else:
            # FALLBACK: Download directly if library is old
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