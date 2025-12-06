import pandas as pd
from sqlalchemy import create_engine, text
import numpy as np
import os
import datetime
import random

# --- CONFIGURATION ---
if "SUPABASE_DB_URL" in os.environ:
    DB_CONNECTION_STR = os.environ["SUPABASE_DB_URL"]
else:
    DB_CONNECTION_STR = "postgresql://postgres.tvjklvwddqzpkgtkpixm:r24s15t28c3g10s15@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

# How many seasons to simulate? (1000 is a good balance of speed/accuracy)
NUM_SIMULATIONS = 1000

# --- DYNAMIC SEASON ---
now = datetime.datetime.now()
if now.month < 4:
    CURRENT_SEASON = now.year - 1
else:
    CURRENT_SEASON = now.year

def calculate_srs(standings, schedule):
    """
    Calculates Simple Rating System (SRS).
    SRS = Margin of Victory + Strength of Schedule.
    This gives us a better 'Win Probability' than just W-L record.
    """
    print("   ↳ Calculating Power Rankings (SRS)...")
    
    teams = standings['team'].unique()
    ratings = {team: 0.0 for team in teams}
    
    # Get completed games
    played = schedule[schedule['result'].notnull()].copy()
    
    # Iterate to adjust for Opponent Strength
    for i in range(10): 
        new_ratings = {}
        for team in teams:
            home_games = played[played['home_team'] == team]
            away_games = played[played['away_team'] == team]
            
            total_mov = 0
            opp_ratings = 0
            count = 0
            
            # Cap Margin of Victory at 24 to prevent outliers
            for _, g in home_games.iterrows():
                try:
                    h_score = float(g['home_score'])
                    a_score = float(g['away_score'])
                    score_diff = min(h_score - a_score, 24)
                    score_diff = max(score_diff, -24)
                    
                    total_mov += score_diff
                    opp_ratings += ratings.get(g['away_team'], 0)
                    count += 1
                except: continue
                
            for _, g in away_games.iterrows():
                try:
                    h_score = float(g['home_score'])
                    a_score = float(g['away_score'])
                    score_diff = min(a_score - h_score, 24)
                    score_diff = max(score_diff, -24)

                    total_mov += score_diff
                    opp_ratings += ratings.get(g['home_team'], 0)
                    count += 1
                except: continue
            
            if count > 0:
                new_ratings[team] = (total_mov / count) + (opp_ratings / count)
            else:
                new_ratings[team] = 0
        
        ratings = new_ratings
        
    return ratings

def run_monte_carlo():
    print(f"🚀 Starting Monte Carlo Simulation ({NUM_SIMULATIONS} runs) for {CURRENT_SEASON}...")
    
    try:
        engine = create_engine(DB_CONNECTION_STR)
        with engine.connect() as conn:
            # Load Data
            q_stand = text(f"SELECT * FROM standings WHERE season = {CURRENT_SEASON}")
            standings = pd.read_sql(q_stand, conn)
            
            q_sched = text(f"SELECT * FROM schedules WHERE season = {CURRENT_SEASON}")
            schedule = pd.read_sql(q_sched, conn)
            
    except Exception as e:
        print(f"❌ DB Error: {e}")
        return

    if standings.empty:
        print("❌ No standings data found.")
        return

    # --- FIX COLUMN NAMES ---
    # nflverse uses 'scored', 'allowed', 'conf'. We normalize them.
    standings = standings.rename(columns={
        'scored': 'points_for', 
        'allowed': 'points_against', 
        'conf': 'conference'
    })

    if 'conference' not in standings.columns:
        print("⚠️ 'conference' column missing. Defaulting to NFL.")
        standings['conference'] = 'NFL'

    # 1. Get Power Ratings
    srs_ratings = calculate_srs(standings, schedule)
    
    # 2. Identify Future Games
    future_games = schedule[schedule['result'].isnull()].to_dict('records')
    
    # 3. Simulation Trackers
    playoff_appearances = {team: 0 for team in standings['team']}
    total_wins_accum = {team: 0 for team in standings['team']}
    
    print(f"   ↳ Simulating {len(future_games)} remaining games {NUM_SIMULATIONS} times...")

    # --- THE SIMULATION LOOP ---
    for sim in range(NUM_SIMULATIONS):
        # Start with current wins
        sim_wins = dict(zip(standings.team, standings.wins))
        
        # Play out the schedule
        for game in future_games:
            home, away = game['home_team'], game['away_team']
            
            # Rating Diff + Home Field (2.5)
            home_adv = srs_ratings.get(home, 0) + 2.5
            away_adv = srs_ratings.get(away, 0)
            diff = home_adv - away_adv
            
            # Win Probability (Sigmoid Curve)
            # Diff of 0 = 50% chance. Diff of 15 = 90% chance.
            win_prob = 1 / (1 + 10**(-diff/14)) 
            
            # Flip Coin (NO TIES)
            if random.random() < win_prob:
                if home in sim_wins: sim_wins[home] += 1
            else:
                if away in sim_wins: sim_wins[away] += 1
                
        # Track Wins
        for t, w in sim_wins.items():
            total_wins_accum[t] += w
            
        # Determine Playoffs (Top 7 per Conference)
        for conf in standings['conference'].unique():
            conf_teams = standings[standings['conference'] == conf]['team'].tolist()
            
            # Rank by Wins (Break ties with random noise for now)
            sorted_teams = sorted(conf_teams, key=lambda x: sim_wins.get(x, 0) + random.random(), reverse=True)
            
            # Top 7 make it
            for team in sorted_teams[:7]:
                playoff_appearances[team] += 1

    # --- 4. FINALIZE RESULTS ---
    results = []
    print("   ↳ Aggregating results...")
    
    for team in standings['team']:
        avg_wins = total_wins_accum[team] / NUM_SIMULATIONS
        prob = (playoff_appearances[team] / NUM_SIMULATIONS) * 100
        
        # Determine Status Label
        if prob >= 100: status = "Clinched"
        elif prob >= 90: status = "Lock"
        elif prob >= 75: status = "Likely"
        elif prob >= 40: status = "In the Hunt"
        elif prob >= 10: status = "Bubble"
        elif prob > 0: status = "Miracle"
        else: status = "Eliminated"
        
        results.append({
            'team': team,
            'season': CURRENT_SEASON,
            'projected_wins': round(avg_wins, 1),
            'playoff_odds': round(prob, 1),
            'playoff_status': status
        })

    # Upload
    df_results = pd.DataFrame(results)
    print(df_results.sort_values('playoff_odds', ascending=False).head())
    
    try:
        with engine.connect() as conn:
            df_results.to_sql('team_projections', conn, if_exists='replace', index=False)
            conn.commit()
            print("✅ Simulations Complete & Saved.")
    except Exception as e:
        print(f"❌ Upload Error: {e}")

if __name__ == "__main__":
    run_monte_carlo()