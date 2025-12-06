import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './supabaseClient'; 
import { Activity, Trophy, Calendar, ArrowRight, Shield } from 'lucide-react';
import './index.css';

// --- DYNAMIC DATE ENGINE ---
const getDynamicSeason = () => {
  const now = new Date();
  const month = now.getMonth(); // 0 = Jan, 11 = Dec
  const year = now.getFullYear();
  // If it's Jan(0), Feb(1), or Mar(2), we are in the tail end of the PREVIOUS season
  return month < 3 ? year - 1 : year;
};

const getDynamicWeek = (seasonYear) => {
  const now = new Date();
  // Approximate Start: First Thursday after Sept 1st
  // (Hardcoding Sept 5th is usually safe enough for estimation)
  const seasonStart = new Date(`${seasonYear}-09-05`);
  
  // If we are before the season starts, default to Week 1
  if (now < seasonStart) return 1;

  // Calculate difference in time
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  const diffTime = Math.abs(now - seasonStart);
  const weekNum = Math.ceil(diffTime / msPerWeek);

  // Clamp between Week 1 and Week 18 (Reg Season) or higher (Playoffs)
  return Math.max(1, weekNum);
};

// --- LOGO FIXER ---
const TEAM_MAP = {
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF', 'CAR': 'CAR', 
  'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN', 
  'DET': 'DET', 'GB':  'GB',  'HOU': 'HOU', 'IND': 'IND', 'JAX': 'JAX', 
  'KC':  'KC',  'LAC': 'LAC', 'LAR': 'LAR', 'LA':  'LAR', 'LV':  'LV',  
  'MIA': 'MIA', 'MIN': 'MIN', 'NE':  'NE',  'NO':  'NO',  'NYG': 'NYG', 
  'NYJ': 'NYJ', 'PHI': 'PHI', 'PIT': 'PIT', 'SEA': 'SEA', 'SF':  'SF',  
  'TB':  'TB',  'TEN': 'TEN', 'WAS': 'WSH', 'WSH': 'WSH' 
};

const TeamLogo = ({ team, size = "w-8 h-8" }) => {
  const abbr = TEAM_MAP[team] || team;
  const url = `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`;
  return <img src={url} alt={team} className={`${size} object-contain drop-shadow-sm`} 
    onError={(e) => { e.target.src = 'https://a.espncdn.com/i/teamlogos/nfl/500/nfl.png' }} />;
};

const Badge = ({ children, color="bg-slate-800 text-slate-400" }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-white/5 ${color}`}>
    {children}
  </span>
);

function App() {
  const [weekGames, setWeekGames] = useState([]);
  const [sosData, setSosData] = useState({});
  const [loading, setLoading] = useState(true);
  
  // CALCULATE CURRENT DATES
  const currentSeason = getDynamicSeason();
  const currentWeek = getDynamicWeek(currentSeason);

  useEffect(() => {
    async function loadData() {
      // 1. Fetch THIS WEEK'S Games
      const { data: currentGames, error: weekError } = await supabase
        .from('schedules')
        .select('*')
        .eq('season', currentSeason)
        .eq('week', currentWeek)
        .order('gameday');

      if (weekError) console.error("Error loading schedule:", weekError);
      else setWeekGames(currentGames || []);

      // 2. Fetch ALL Games (For SOS Math)
      const { data: allGames } = await supabase
        .from('schedules')
        .select('home_team, away_team, home_score, away_score, result')
        .eq('season', currentSeason);

      if (allGames) calculateStats(allGames);
      setLoading(false);
    }
    loadData();
  }, [currentSeason, currentWeek]);

  // --- MATH ENGINE ---
  const calculateStats = (games) => {
    const records = {};
    const opponents = {};

    games.forEach(g => {
        if (!records[g.home_team]) { records[g.home_team] = { w:0, l:0 }; opponents[g.home_team] = []; }
        if (!records[g.away_team]) { records[g.away_team] = { w:0, l:0 }; opponents[g.away_team] = []; }
    });

    games.forEach(g => {
        const h = g.home_team; const a = g.away_team;
        if (!h || !a) return;

        if (g.home_score !== null) {
            if (g.home_score > g.away_score) { records[h].w++; records[a].l++; }
            else if (g.away_score > g.home_score) { records[a].w++; records[h].l++; }
        } 
        
        opponents[h].push(a);
        opponents[a].push(h);
    });

    const sos = {};
    Object.keys(records).forEach(team => {
        let oppWins = 0; 
        let oppTotal = 0;
        
        opponents[team].forEach(opp => {
            if (records[opp]) {
                oppWins += records[opp].w;
                oppTotal += (records[opp].w + records[opp].l);
            }
        });

        const pct = oppTotal > 0 ? (oppWins / oppTotal).toFixed(3) : '.000';
        
        sos[team] = {
            wins: records[team].w,
            losses: records[team].l,
            sosPct: pct,
            oppRecord: `${oppWins}-${oppTotal - oppWins}`
        };
    });

    setSosData(sos);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-end justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xs text-indigo-400 font-mono mb-1">PRO DATABASE • WEEK {currentWeek}</h2>
            <h1 className="text-3xl font-bold text-white tracking-tight">{currentSeason} Season</h1>
          </div>
          <div className="text-right">
             <div className="text-2xl font-bold text-white">{weekGames.length}</div>
             <div className="text-[10px] text-slate-500 uppercase tracking-widest">Games</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: SCHEDULE */}
          <div className="glass-panel rounded-xl overflow-hidden border border-white/10 bg-slate-900/50 h-fit">
            <div className="px-6 py-4 bg-white/5 border-b border-white/5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Week {currentWeek} Matchups</span>
            </div>

            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-500 italic">Syncing with Live Database...</div>
              ) : weekGames.length === 0 ? (
                <div className="p-8 text-center text-slate-500 italic">
                  No games found for Week {currentWeek}. <br/>
                  <span className="text-xs">Run your Python Ingest script to update the data.</span>
                </div>
              ) : weekGames.map((game) => {
                const isFinal = game.home_score !== null;
                
                return (
                  <div key={game.game_id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                    {isFinal ? (
                        <>
                          <div className="w-16"><Badge>FINAL</Badge></div>
                          <div className="flex-1 flex items-center justify-center gap-4">
                              <div className="flex items-center gap-3 justify-end w-32">
                                  <span className="font-bold text-white text-sm hidden sm:block">{game.away_team}</span>
                                  <TeamLogo team={game.away_team} />
                              </div>
                              <div className="w-16 text-center font-mono font-bold text-white text-lg">
                                  {parseInt(game.away_score)}-{parseInt(game.home_score)}
                              </div>
                              <div className="flex items-center gap-3 justify-start w-32">
                                  <TeamLogo team={game.home_team} />
                                  <span className="font-bold text-white text-sm hidden sm:block">{game.home_team}</span>
                              </div>
                          </div>
                        </>
                    ) : (
                        <div className="w-full flex items-center justify-center gap-8 py-1">
                             <div className="flex items-center gap-3">
                                 <span className="font-bold text-slate-300 text-sm">{game.away_team}</span>
                                 <TeamLogo team={game.away_team} />
                             </div>
                             <div className="text-xs font-bold text-slate-600 bg-white/5 px-2 py-1 rounded">VS</div>
                             <div className="flex items-center gap-3">
                                 <TeamLogo team={game.home_team} />
                                 <span className="font-bold text-slate-300 text-sm">{game.home_team}</span>
                             </div>
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: SOS */}
          <div className="glass-panel rounded-xl overflow-hidden border border-white/10 bg-slate-900/50 h-fit">
            <div className="px-6 py-4 bg-white/5 border-b border-white/5">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3 h-3" /> Team Strength (SOS)
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] text-slate-500 border-b border-white/5 uppercase tracking-wider sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10">
                    <th className="px-4 py-3 font-normal">Team</th>
                    <th className="px-4 py-3 font-normal text-right">Rec</th>
                    <th className="px-4 py-3 font-normal text-right">Opp. Rec</th>
                    <th className="px-4 py-3 font-normal text-right">Diff.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.keys(sosData)
                    .sort((a,b) => parseFloat(sosData[b].sosPct) - parseFloat(sosData[a].sosPct))
                    .map(teamId => {
                    const d = sosData[teamId];
                    const isHard = parseFloat(d.sosPct) > 0.550;
                    
                    return (
                      <tr key={teamId} className="hover:bg-white/5 cursor-pointer transition-colors">
                        <td className="px-4 py-2 flex items-center gap-3">
                          <TeamLogo team={teamId} size="w-6 h-6" />
                          <span className="font-bold text-slate-200">{teamId}</span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-400">
                          {d.wins}-{d.losses}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-300">
                          {d.oppRecord}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isHard ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400'
                          }`}>
                            {d.sosPct}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);