// src/utils/nflHelpers.js

export const getDynamicSeason = () => {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
};

export const getDynamicWeek = (seasonYear) => {
  const now = new Date();
  const seasonStart = new Date(`${seasonYear}-09-05`);
  if (now < seasonStart) return 1;
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  const diffTime = Math.abs(now - seasonStart);
  const weekNum = Math.ceil(diffTime / msPerWeek);
  return Math.min(Math.max(1, weekNum), 18); 
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
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF', 'CAR': 'CAR', 
  'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN', 
  'DET': 'DET', 'GB':  'GB',  'HOU': 'HOU', 'IND': 'IND', 'JAX': 'JAX', 
  'KC':  'KC',  'LAC': 'LAC', 'LAR': 'LAR', 'LA':  'LAR', 'LV':  'LV',  
  'MIA': 'MIA', 'MIN': 'MIN', 'NE':  'NE',  'NO':  'NO',  'NYG': 'NYG', 
  'NYJ': 'NYJ', 'PHI': 'PHI', 'PIT': 'PIT', 'SEA': 'SEA', 'SF':  'SF',  
  'TB':  'TB',  'TEN': 'TEN', 'WAS': 'WSH', 'WSH': 'WSH' 
};