// src/utils/nflHelpers.js

export const getDynamicSeason = () => {
  const now = new Date();
  // If it's Jan/Feb/Mar, we are still in the 'previous' year's season
  return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
};

export const getDynamicWeek = (seasonYear) => {
  const now = new Date();

  // 1. Handle the "5 AM Update" rule
  // We shift the current time BACK by 5 hours. 
  // If it's Tuesday 4:00 AM, this makes it Monday 11:00 PM (keeping it in the old week).
  // If it's Tuesday 6:00 AM, this makes it Tuesday 1:00 AM (pushing it to the new week).
  const adjustedNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));

  // 2. Dynamically find the "Anchor Tuesday" for Week 1
  // NFL Week 1 always follows Labor Day (First Monday of Sept).
  // So, our "UI Week" starts on the Tuesday after Labor Day.
  const getWeekOneTuesday = (year) => {
    let date = new Date(year, 8, 1); // September 1st (Month 8 is Sept)
    
    // Find the first Monday (Labor Day)
    while (date.getDay() !== 1) { 
      date.setDate(date.getDate() + 1);
    }
    
    // Add 1 day to get Tuesday
    date.setDate(date.getDate() + 1); 
    // Reset to midnight for clean math
    date.setHours(0, 0, 0, 0); 
    return date;
  };

  const seasonStartTuesday = getWeekOneTuesday(seasonYear);

  // 3. If we are before the season starts, default to Week 1
  if (adjustedNow < seasonStartTuesday) return 1;

  // 4. Calculate Weeks Passed
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  const diffTime = adjustedNow - seasonStartTuesday;
  
  // We use floor() because we want 0-6 days to be Week 1 (index 0), 7-13 days to be Week 2 (index 1)
  const weeksPassed = Math.floor(diffTime / msPerWeek);
  
  // Add 1 because we start at Week 1, not Week 0
  const currentWeek = weeksPassed + 1;

  // Cap at 18 weeks (Regular Season)
  return Math.min(Math.max(1, currentWeek), 18);
};

export const formatGameTime = (timeStr) => {
  if (!timeStr) return "TBD";
  const [hourStr, minute] = timeStr.split(':');
  let hour = parseInt(hourStr);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${hour}:${minute} ${ampm}`;
};

export const TEAM_MAP = {
  // DB Value : ESPN Image Code
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF', 'CAR': 'CAR', 
  'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN', 
  'DET': 'DET', 'GB':  'GB',  'HOU': 'HOU', 'IND': 'IND', 'JAX': 'JAX', 
  'KC':  'KC',  'LAC': 'LAC', 'LAR': 'LAR', 'LA':  'LAR', 
  
  // FIX: Map LVR (Database) to LV (ESPN)
  'LVR': 'LV',  'LV': 'LV',

  'MIA': 'MIA', 'MIN': 'MIN', 'NE':  'NE',  'NO':  'NO',  'NYG': 'NYG', 
  'NYJ': 'NYJ', 'PHI': 'PHI', 'PIT': 'PIT', 'SEA': 'SEA', 'SF':  'SF',  
  'TB':  'TB',  'TEN': 'TEN', 'WAS': 'WSH', 'WSH': 'WSH' 
};