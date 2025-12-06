import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './supabaseClient'; 
import { Activity, Trophy, Calendar, ArrowRight, Shield, Flame, LayoutGrid, Users, X, TrendingUp, BarChart3, ChevronLeft } from 'lucide-react';
import './index.css';

// --- UTILS ---
const getDynamicSeason = () => {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
};

const getDynamicWeek = (seasonYear) => {
  const now = new Date();
  const seasonStart = new Date(`${seasonYear}-09-05`);
  if (now < seasonStart) return 1;
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  const diffTime = Math.abs(now - seasonStart);
  const weekNum = Math.ceil(diffTime / msPerWeek);
  return Math.min(Math.max(1, weekNum), 18); 
};

const formatGameTime = (timeStr) => {
  if (!timeStr) return "TBD";
  const [hourStr, minute] = timeStr.split(':');
  let hour = parseInt(hourStr);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${hour}:${minute} ${ampm}`;
};

const TEAM_MAP = {
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF', 'CAR': 'CAR', 
  'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN', 
  'DET': 'DET', 'GB':  'GB',  'HOU': 'HOU', 'IND': 'IND', 'JAX': 'JAX', 
  'KC':  'KC',  'LAC': 'LAC', 'LAR': 'LAR', 'LA':  'LAR', 'LV':  'LV',  
  'MIA': 'MIA', 'MIN': 'MIN', 'NE':  'NE',  'NO':  'NO',  'NYG': 'NYG', 
  'NYJ': 'NYJ', 'PHI': 'PHI', 'PIT': 'PIT', 'SEA': 'SEA', 'SF':  'SF',  
  'TB':  'TB',  'TEN': 'TEN', 'WAS': 'WSH', 'WSH': 'WSH' 
};

// --- COMPONENTS ---

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

const StatBar = ({ label, value1, value2, color1="bg-emerald-500", color2="bg-rose-500", label1, label2 }) => {
  const max = Math.max(value1, value2, 1) * 1.2;
  const w1 = (value1 / max) * 100;
  const w2 = (value2 / max) * 100;

  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-slate-400 mb-1 font-mono uppercase tracking-wider">
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2 h-6">
        <div className="flex-1 flex flex-col items-end">
           <div className={`h-2 rounded-full ${color1}`} style={{ width: `${w1}%` }}></div>
           <span className="text-[10px] text-white font-bold">{parseFloat(value1).toFixed(1)} {label1}</span>
        </div>
        <div className="w-px h-full bg-slate-700"></div>
        <div className="flex-1 flex flex-col items-start">
           <div className={`h-2 rounded-full ${color2}`} style={{ width: `${w2}%` }}></div>
           <span className="text-[10px] text-white font-bold">{parseFloat(value2).toFixed(1)} {label2}</span>
        </div>
      </div>
    </div>
  );
};

const SosLeaderboard = ({ data, onSelectTeam }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((item, index) => {
        let tierColor = 'bg-slate-500';
        let tierText = 'AVG';
        const displayScore = item.sos; 
        if (displayScore > 85) { tierColor = 'bg-rose-500'; tierText = 'BRUTAL'; }
        else if (displayScore > 75) { tierColor = 'bg-amber-500'; tierText = 'TOUGH'; }
        else { tierColor = 'bg-emerald-500'; tierText = 'EASY'; }

        return (
          <div 
            key={item.team} 
            onClick={() => onSelectTeam(item.team)}
            className="group flex items-center gap-4 p-3 rounded-xl bg-slate-900/40 border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer"
          >
            <div className="font-mono text-sm text-slate-500 w-6 text-center">#{index + 1}</div>
            <TeamLogo team={item.team} size="w-10 h-10" />
            <div className="flex-1">
              <div className="font-bold text-white text-sm">{item.team}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                 PWR: <span className="text-white">{item.rank ? item.rank.toFixed(1) : '-'}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded text-white ${tierColor} bg-opacity-20 border border-white/10`}>
                {tierText}
              </span>
              <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${tierColor}`} style={{ width: `${(displayScore - 50) * 2}%` }}></div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
};

// --- MATCHUP MODAL ---
const MatchupOverlay = ({ game, leagueStats, onClose }) => {
  if (!game) return null;
  const teamId = game.home_team;
  const opponent = game.away_team;
  
  const getStats = (id) => {
      const s = leagueStats[id] || {};
      return {
          rank: parseFloat(s.rank) || 50,
          qb: parseFloat(s.qb) || 50,
          def: parseFloat(s.def) || 50,
          ppg: parseFloat(s.ppg) || 0,
          papg: parseFloat(s.papg) || 0
      };
  };

  const homeStats = getStats(teamId);
  const awayStats = getStats(opponent);

  const homeAdvantage = 2.5; 
  const powerDiff = homeStats.rank - awayStats.rank;
  const spread = (powerDiff / 2) + homeAdvantage; 
  
  const homePredScore = 20 + ((homeStats.qb - 50) / 5) - ((awayStats.def - 50) / 5);
  const awayPredScore = 20 + ((awayStats.qb - 50) / 5) - ((homeStats.def - 50) / 5);
  
  const finalHome = Math.max(0, Math.round(homePredScore + homeAdvantage));
  const finalAway = Math.max(0, Math.round(awayPredScore));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors z-10">
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <div className="p-8 pb-0 flex flex-col items-center border-b border-white/5 bg-slate-900/50">
          <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Deep Dive Analysis
          </h2>
          <div className="flex items-center justify-between w-full max-w-lg mb-8">
             <div className="flex flex-col items-center gap-2">
                <TeamLogo team={teamId} size="w-24 h-24" />
                <h1 className="text-4xl font-black text-white">{teamId}</h1>
                <span className="text-xs text-slate-500 font-mono bg-white/5 px-2 py-1 rounded">HOME</span>
             </div>
             <div className="flex flex-col items-center">
                <div className="text-slate-600 font-black text-2xl mb-2">VS</div>
                <div className="text-xs font-mono text-slate-500">{game.weekday}</div>
             </div>
             <div className="flex flex-col items-center gap-2">
                <TeamLogo team={opponent} size="w-24 h-24" />
                <h1 className="text-4xl font-black text-white">{opponent}</h1>
                <span className="text-xs text-slate-500 font-mono bg-white/5 px-2 py-1 rounded">AWAY</span>
             </div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                    <Flame className="w-3 h-3" /> Power Ratings (0-99)
                </h3>
                <StatBar label="Overall Power" value1={homeStats.rank} value2={awayStats.rank} label1="" label2="" color1="bg-indigo-500" color2="bg-indigo-500" />
                <StatBar label="QB Efficiency" value1={homeStats.qb} value2={awayStats.qb} label1="" label2="" color1="bg-emerald-500" color2="bg-emerald-500" />
                <StatBar label="Defense Grade" value1={homeStats.def} value2={awayStats.def} label1="" label2="" color1="bg-rose-500" color2="bg-rose-500" />
            </div>
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                    <BarChart3 className="w-3 h-3" /> Scoring Stats
                </h3>
                <StatBar label="Points Per Game" value1={homeStats.ppg} value2={awayStats.ppg} label1="" label2="" color1="bg-blue-500" color2="bg-blue-500" />
                <StatBar label="Points Allowed" value1={homeStats.papg} value2={awayStats.papg} label1="" label2="" color1="bg-amber-500" color2="bg-amber-500" />
            </div>
          </div>

          <div className="flex flex-col gap-6">
             <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-8 border border-white/10 flex flex-col items-center text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> AI Prediction Model
                </h3>
                <div className="flex items-end gap-2 mb-2">
                    <span className="text-5xl font-black text-white">{finalHome > finalAway ? teamId : opponent}</span>
                    <span className="text-lg text-slate-400 font-bold mb-2">to Win</span>
                </div>
                <div className="text-xs text-slate-500 font-mono mb-8">Confidence: <span className="text-white">{Math.min(99, 50 + Math.abs(spread) * 3).toFixed(0)}%</span></div>
                <div className="w-full flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-center"><div className="text-[10px] text-slate-500 uppercase">Home</div><div className="text-2xl font-mono font-bold text-white">{finalHome}</div></div>
                    <div className="text-xs text-slate-600 font-mono italic">Projected Score</div>
                    <div className="text-center"><div className="text-[10px] text-slate-500 uppercase">Away</div><div className="text-2xl font-mono font-bold text-white">{finalAway}</div></div>
                </div>
             </div>
             <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 text-center">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Matchup Key</div>
                <p className="text-sm text-slate-300 leading-relaxed">
                   This game features the <span className="text-white font-bold">#{homeStats.rank > awayStats.rank ? homeStats.rank.toFixed(0) : awayStats.rank.toFixed(0)}</span> ranked Power Team vs the <span className="text-white font-bold">#{homeStats.rank < awayStats.rank ? homeStats.rank.toFixed(0) : awayStats.rank.toFixed(0)}</span> ranked team. 
                   The spread suggests a <span className="text-indigo-400 font-bold">{Math.abs(spread).toFixed(1)} point</span> advantage for {spread > 0 ? teamId : opponent}.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- ROSTER VIEW ---
const RosterView = ({ teamId }) => {
  const [fullRoster, setFullRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Offense'); 
  const [posFilter, setPosFilter] = useState('All');

  const GROUPS = useMemo(() => ({
    'Offense': ['QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'FB'],
    'Defense': ['DL', 'DE', 'DT', 'LB', 'ILB', 'OLB', 'CB', 'DB', 'S', 'SS', 'FS'],
    'Special Teams': ['K', 'P', 'LS']
  }), []);

  useEffect(() => {
    async function fetchRoster() {
      const { data } = await supabase.from('rosters').select('*').eq('team', teamId).order('season', { ascending: false }); 
      const uniquePlayers = []; const seenIds = new Set();
      if (data) {
        data.forEach(p => { if (!seenIds.has(p.player_id)) { seenIds.add(p.player_id); uniquePlayers.push(p); } });
      }
      setFullRoster(uniquePlayers);
      setLoading(false);
    }
    fetchRoster();
  }, [teamId]);

  const categoryRoster = fullRoster.filter(p => GROUPS[category]?.includes(p.position));
  const availablePositions = ['All', ...new Set(categoryRoster.map(p => p.position).sort())];
  const displayRoster = categoryRoster.filter(p => posFilter === 'All' || p.position === posFilter);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Roster...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-900/50 p-4 border-b border-white/5 space-y-4">
        <div className="flex bg-slate-950 p-1 rounded-lg w-fit border border-white/10">
          {Object.keys(GROUPS).map(group => (
            <button key={group} onClick={() => { setCategory(group); setPosFilter('All'); }} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${category === group ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{group}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {availablePositions.map(pos => (
            <button key={pos} onClick={() => setPosFilter(pos)} className={`px-3 py-1 rounded-full text-[10px] font-mono border transition-colors ${posFilter === pos ? 'bg-white text-slate-900 border-white font-bold' : 'bg-slate-800 text-slate-400 border-transparent hover:border-slate-600'}`}>{pos}</button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-sm z-10">
            <tr className="text-[10px] text-slate-500 border-b border-white/10 uppercase tracking-wider">
              <th className="px-4 py-3">Player</th><th className="px-4 py-3">Pos</th><th className="px-4 py-3 text-right">Jersey</th><th className="px-4 py-3 text-right">Yrs Exp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayRoster.map((player) => (
              <tr key={player.player_id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-white/10 shrink-0">
                     {player.headshot_url ? <img src={player.headshot_url} className="w-full h-full object-cover" /> : <span className="text-[10px] text-slate-500">{player.position}</span>}
                  </div>
                  <span className="font-bold text-white text-sm">{player.player_name || player.player || player.full_name}</span>
                </td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">{player.position}</td>
                <td className="px-4 py-2 text-right text-slate-500 font-mono">{player.jersey_number}</td>
                <td className="px-4 py-2 text-right text-slate-500 font-mono">{player.years_exp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- TEAM DETAIL ---
const TeamDetail = ({ teamId, games, leagueStats, onBack }) => {
  const [activeTab, setActiveTab] = useState('schedule'); 
  const [selectedGame, setSelectedGame] = useState(null);
  const [teamStanding, setTeamStanding] = useState(null);
  const [projection, setProjection] = useState(null);

  useEffect(() => {
    async function fetchData() {
        const { data: std } = await supabase.from('standings').select('*').eq('team', teamId).order('season', { ascending: false }).limit(1).single();
        setTeamStanding(std);
        const { data: proj } = await supabase.from('team_projections').select('*').eq('team', teamId).limit(1).single();
        setProjection(proj);
    }
    fetchData();
  }, [teamId]);

  const teamGames = games.filter(g => g.home_team === teamId || g.away_team === teamId).sort((a,b) => parseInt(a.week) - parseInt(b.week));
  const bgStyle = { background: `linear-gradient(to bottom right, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 1))` };
  const getOddsColor = (odds) => { if (odds === 0) return 'text-rose-500 font-black'; if (odds >= 99) return 'text-emerald-400 font-black'; if (odds >= 50) return 'text-blue-400'; return 'text-amber-400'; };

  const seedInfo = teamStanding ? { 
      text: teamStanding.seed ? `Seed #${teamStanding.seed}` : 'In the Hunt', 
      color: teamStanding.seed <= 7 ? 'text-emerald-400' : 'text-slate-400' 
  } : { text: '-', color: 'text-slate-500' };

  return (
    <div className="animate-in max-w-5xl mx-auto">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"><ChevronLeft className="w-4 h-4" /> Back to Dashboard</button>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 mb-8" style={bgStyle}>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
             <TeamLogo team={teamId} size="w-24 h-24 md:w-32 md:h-32" />
             <div>
                <h1 className="text-6xl font-black text-white tracking-tighter leading-none">{teamId}</h1>
                <div className="text-slate-400 text-sm font-mono mt-1 uppercase tracking-widest">{teamStanding ? (teamStanding.division || teamStanding.division_name) : 'NFL Division'}</div>
             </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
             <div className="bg-black/20 p-4 rounded-xl border border-white/5"><div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Record</div><div className="text-2xl font-mono font-bold text-white">{teamStanding ? `${teamStanding.wins}-${teamStanding.losses}` : '-'}</div></div>
             <div className="bg-black/20 p-4 rounded-xl border border-white/5"><div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Proj. Wins</div><div className="text-2xl font-mono font-bold text-indigo-400">{projection ? parseFloat(projection.projected_wins).toFixed(1) : '-'}</div></div>
             <div className="bg-black/20 p-4 rounded-xl border border-white/5"><div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Playoff Odds</div><div className={`text-2xl font-mono font-bold ${getOddsColor(projection?.playoff_odds)}`}>{projection ? `${projection.playoff_odds}%` : '-'}</div></div>
             <div className="bg-black/20 p-4 rounded-xl border border-white/5"><div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status</div><div className={`text-lg font-mono font-bold leading-tight ${getOddsColor(projection?.playoff_odds)}`}>{projection ? projection.playoff_status : '-'}</div></div>
          </div>
        </div>
      </div>
      <div className="flex gap-4 mb-6 border-b border-white/5 pb-1">
        <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'schedule' ? 'text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}>Schedule & Analysis</button>
        <button onClick={() => setActiveTab('roster')} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'roster' ? 'text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}>Active Roster</button>
      </div>
      <div className="glass-panel rounded-xl overflow-hidden border border-white/10 bg-slate-900/50 min-h-[400px]">
        {activeTab === 'roster' && <RosterView teamId={teamId} />}
        {activeTab === 'schedule' && (
          <div className="divide-y divide-white/5">
            {teamGames.map((g, i) => {
              const isHome = g.home_team === teamId;
              const opponent = isHome ? g.away_team : g.home_team;
              const hScore = parseFloat(g.home_score);
              const isFinished = g.home_score !== null && !isNaN(hScore) && hScore < 200;
              const win = isFinished && ((isHome && hScore > parseFloat(g.away_score)) || (!isHome && parseFloat(g.away_score) > hScore));
              return (
                <div key={i} onClick={() => setSelectedGame(g)} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4 w-1/3"><span className="text-xs font-mono text-slate-500 w-8">WK {g.week}</span><div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-400 w-4">{isHome ? 'vs' : '@'}</span><TeamLogo team={opponent} size="w-8 h-8" /><span className="font-bold text-white text-lg">{opponent}</span></div></div>
                  <div className="flex items-center gap-4">{isFinished ? <span className={`font-mono font-bold text-lg ${win ? 'text-emerald-400' : 'text-rose-400'}`}>{win ? 'W' : 'L'} {g.away_score}-{g.home_score}</span> : <div className="flex items-center gap-2 group-hover:text-indigo-400 transition-colors"><span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Analyze Matchup</span><BarChart3 className="w-4 h-4 text-slate-600 group-hover:text-indigo-400" /></div>}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {selectedGame && <MatchupOverlay game={selectedGame} leagueStats={leagueStats} onClose={() => setSelectedGame(null)} />}
    </div>
  );
};

// --- HERO MATCHUP ---
const HeroSkeleton = () => <div className="h-48 animate-pulse bg-slate-900/50 rounded-xl mb-8"></div>;

const HeroMatchup = ({ game, homeRec, awayRec }) => {
  if (!game) return null;
  return (
    <div className="w-full relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl mb-8 group cursor-pointer hover:border-indigo-500/50 transition-all animate-in fade-in">
       <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 opacity-90"></div>
       <div className="absolute top-0 left-1/4 w-64 h-full bg-indigo-500/10 blur-[50px] skew-x-12"></div>
       <div className="absolute top-0 right-1/4 w-64 h-full bg-indigo-500/10 blur-[50px] skew-x-12"></div>
       <div className="relative z-10 flex flex-col md:flex-row items-center justify-center px-6 py-8 md:py-10 h-full w-full max-w-5xl mx-auto">
          <div className="flex-1 flex flex-col items-center md:items-end justify-center gap-2 text-center md:text-right w-full">
             <TeamLogo team={game.away_team} size="w-20 h-20 md:w-24 md:h-24" />
             <div>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-none tracking-tighter">{game.away_team}</h2>
                <div className="flex items-center justify-center md:justify-end gap-2 mt-2"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Away</span><span className="w-1 h-1 bg-slate-600 rounded-full"></span><span className="font-mono text-sm text-white">{awayRec}</span></div>
             </div>
          </div>
          <div className="flex-shrink-0 mx-8 md:mx-16 my-6 md:my-0 flex flex-col items-center justify-center w-32">
             <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-2 text-center whitespace-nowrap">Matchup of the Week</span>
             <div className="text-6xl font-black text-white font-mono italic leading-none">VS</div>
             <div className="text-xs font-mono text-slate-400 mt-2 text-center bg-white/5 px-3 py-1 rounded-lg border border-white/5">{game.weekday} • {formatGameTime(game.gametime)}</div>
          </div>
          <div className="flex-1 flex flex-col items-center md:items-start justify-center gap-2 text-center md:text-left w-full">
             <TeamLogo team={game.home_team} size="w-20 h-20 md:w-24 md:h-24" />
             <div>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-none tracking-tighter">{game.home_team}</h2>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2"><span className="font-mono text-sm text-white">{homeRec}</span><span className="w-1 h-1 bg-slate-600 rounded-full"></span><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Home</span></div>
             </div>
          </div>
       </div>
    </div>
  );
}

// --- MAIN APP ---
function App() {
  const [weekGames, setWeekGames] = useState([]);
  const [leagueStats, setLeagueStats] = useState({});
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null); 
  const currentSeason = getDynamicSeason();
  const currentWeek = getDynamicWeek(currentSeason);

  useEffect(() => {
    async function loadData() {
      // 1. Get Schedule
      const { data: currentGames } = await supabase.from('schedules').select('*').eq('season', currentSeason).eq('week', currentWeek).order('gameday');
      setWeekGames(currentGames || []);

      // FIX: Ensure we are fetching full rows for history (using select '*') instead of specific columns
      // This prevents the 'undefined' error when TeamDetail tries to use columns we didn't fetch
      const { data: history } = await supabase.from('schedules').select('*').eq('season', currentSeason);
      setAllGames(history || []);

      // 3. Get Power Rankings
      const { data: powerData } = await supabase.from('team_power_rankings').select('*').order('true_sos', { ascending: false }); 
      
      const stats = {};
      if (powerData) {
        powerData.forEach(p => {
            stats[p.team] = {
                sos: p.true_sos, 
                rank: p.overall_power,
                qb: p.qb_grade,
                def: p.defense_grade,
                wins: 0, losses: 0, ppg: 0, papg: 0
            };
        });
      }
      
      if (history) {
          history.forEach(g => {
              const h = g.home_team; const a = g.away_team;
              if (!stats[h]) stats[h] = { wins:0, losses:0, ppg:0, papg:0, games:0 };
              if (!stats[a]) stats[a] = { wins:0, losses:0, ppg:0, papg:0, games:0 };

              if (g.home_score !== null) {
                 const hs = parseFloat(g.home_score); const as = parseFloat(g.away_score);
                 if (!stats[h].games) stats[h].games = 0; stats[h].games++;
                 if (!stats[a].games) stats[a].games = 0; stats[a].games++;
                 
                 stats[h].ppg = (stats[h].ppg * (stats[h].games-1) + hs) / stats[h].games;
                 stats[a].ppg = (stats[a].ppg * (stats[a].games-1) + as) / stats[a].games;
                 
                 stats[h].papg = (stats[h].papg * (stats[h].games-1) + as) / stats[h].games;
                 stats[a].papg = (stats[a].papg * (stats[a].games-1) + hs) / stats[a].games;

                 if (hs > as) { stats[h].wins++; stats[a].losses++; }
                 else if (as > hs) { stats[a].wins++; stats[h].losses++; }
              }
          });
      }

      setLeagueStats(stats);
      setLoading(false);
    }
    loadData();
  }, [currentSeason, currentWeek]);

  // Hero Logic
  const sortedByImportance = [...weekGames].sort((a, b) => {
    const pA = (leagueStats[a.home_team]?.rank || 0) + (leagueStats[a.away_team]?.rank || 0);
    const pB = (leagueStats[b.home_team]?.rank || 0) + (leagueStats[b.away_team]?.rank || 0);
    return pB - pA; 
  });
  const heroGame = sortedByImportance[0];
  const heroHomeRec = heroGame ? `PWR ${leagueStats[heroGame.home_team]?.rank || '-'}` : '0-0';
  const heroAwayRec = heroGame ? `PWR ${leagueStats[heroGame.away_team]?.rank || '-'}` : '0-0';

  const rankedData = Object.keys(leagueStats)
    .map(team => ({ team, ...leagueStats[team] }))
    .sort((a, b) => b.sos - a.sos)
    .slice(0, 15);

  if (view === 'team') return <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 md:p-8"><TeamDetail teamId={selectedTeam} games={allGames} leagueStats={leagueStats} onBack={() => setView('dashboard')} /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <nav className="flex items-center justify-between py-4 border-b border-white/5">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20"><LayoutGrid className="text-white w-6 h-6" /></div><div><h1 className="text-xl font-bold text-white tracking-tight leading-none">NFL<span className="text-indigo-400">NEXUS</span></h1><p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em] mt-1">PRO ANALYTICS</p></div></div>
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-xs font-mono text-indigo-300">{currentSeason} • WEEK {currentWeek}</div>
        </nav>

        {loading ? <HeroSkeleton /> : <HeroMatchup game={heroGame} homeRec={heroHomeRec} awayRec={heroAwayRec} />}

        <div className="glass-panel p-6 rounded-xl border border-white/10 mb-8 bg-slate-900/50">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400" /> Toughest Remaining Schedules</h3>
          <SosLeaderboard data={rankedData} onSelectTeam={(t) => { setSelectedTeam(t); setView('team'); }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-panel rounded-xl overflow-hidden border border-white/10 bg-slate-900/50 h-fit">
            <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex justify-between"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Schedule</span><span className="text-xs text-slate-500">{weekGames.length} GAMES</span></div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
              {loading ? <div className="p-8 text-center text-slate-500 italic">Syncing...</div> : weekGames.map((game) => {
                const isFinal = game.home_score !== null && !isNaN(parseFloat(game.home_score)) && parseFloat(game.home_score) < 200;
                return (
                  <div key={game.game_id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => setSelectedGame(game)}>
                    <div className="w-24 flex-shrink-0 text-center">{isFinal ? <Badge>FINAL</Badge> : <div className="flex flex-col items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">{game.weekday}</span><span className="text-xs font-mono text-slate-300">{formatGameTime(game.gametime)}</span></div>}</div>
                    <div className="flex-1 flex items-center justify-center gap-4">
                        <div className="flex items-center gap-3 justify-end w-24"><span className="font-bold text-white text-sm hidden sm:block">{game.away_team}</span><TeamLogo team={game.away_team} /></div>
                        <div className="w-16 text-center font-mono font-bold text-white text-lg">{isFinal ? `${parseInt(game.away_score)}-${parseInt(game.home_score)}` : <span className="text-xs font-bold text-slate-600 bg-white/5 px-2 py-1 rounded">VS</span>}</div>
                        <div className="flex items-center gap-3 justify-start w-24"><TeamLogo team={game.home_team} /><span className="font-bold text-white text-sm hidden sm:block">{game.home_team}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-panel rounded-xl overflow-hidden border border-white/10 bg-slate-900/50 h-fit">
            <div className="px-6 py-4 bg-white/5 border-b border-white/5">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-3 h-3" /> Detailed Team Grades</h3>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] text-slate-500 border-b border-white/10 uppercase tracking-wider sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10">
                    <th className="px-4 py-3 font-normal">Team</th><th className="px-4 py-3 font-normal text-right">Power</th><th className="px-4 py-3 font-normal text-right">QB</th><th className="px-4 py-3 font-normal text-right">Def</th><th className="px-4 py-3 font-normal text-right">SOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.keys(leagueStats).sort((a,b) => leagueStats[b].rank - leagueStats[a].rank).map(teamId => {
                    const d = leagueStats[teamId];
                    return (
                      <tr key={teamId} className="hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { setSelectedTeam(teamId); setView('team'); }}>
                        <td className="px-4 py-2 flex items-center gap-3"><TeamLogo team={teamId} size="w-6 h-6" /><span className="font-bold text-slate-200">{teamId}</span></td>
                        <td className="px-4 py-2 text-right font-mono text-white font-bold">{d.rank}</td>
                        <td className="px-4 py-2 text-right font-mono text-indigo-400">{d.qb}</td>
                        <td className="px-4 py-2 text-right font-mono text-emerald-400">{d.def}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-400">{d.sos}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {selectedGame && <MatchupOverlay game={selectedGame} leagueStats={leagueStats} onClose={() => setSelectedGame(null)} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);