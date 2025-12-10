// src/App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { LayoutGrid, Activity, Shield, Settings2 } from 'lucide-react';
import { TeamLogo, Badge } from './components/UI';
import { HeroMatchup, HeroSkeleton } from './components/HeroMatchup';
import { SosLeaderboard } from './components/SosLeaderboard';
import { MatchupOverlay } from './components/MatchupOverlay';
import { TeamDetail } from './components/TeamDetail';
import { BacktestModal } from './components/BacktestModal';
import { getDynamicSeason, getDynamicWeek, formatGameTime } from './utils/nflHelpers';

export default function App() {
  const currentSeason = getDynamicSeason();
  const currentWeek = getDynamicWeek(currentSeason);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const [weekGames, setWeekGames] = useState([]);
  const [leagueStats, setLeagueStats] = useState({});
  const [allGames, setAllGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  
  // NEW: Store the weights here so they can be shared
  const [modelWeights, setModelWeights] = useState({
    power: 2.3, // Defaults matching your Python script
    qb: 1.0,
    def: 1.0,
    home: 2.0
  });
  
  const [showBacktest, setShowBacktest] = useState(false);
  const [view, setView] = useState('dashboard');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null); 

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // 1. Schedule (Selected Week)
      const { data: currentGames } = await supabase
        .from('schedules')
        .select('*')
        .eq('season', currentSeason)
        .eq('week', selectedWeek) 
        .order('gameday');
      setWeekGames(currentGames || []);

      // 2. Schedule (History)
      const { data: history } = await supabase.from('schedules').select('*').eq('season', currentSeason);
      setAllGames(history || []);

      // 3. Power Rankings
      const { data: powerData } = await supabase.from('team_power_rankings').select('*').order('true_sos', { ascending: false }); 
      
      // 4. Predictions
      const { data: predData } = await supabase.from('game_predictions').select('*');
      const predMap = {};
      if (predData) predData.forEach(p => predMap[p.game_id] = p);
      setPredictions(predMap);

      // Build League Stats
      const stats = {};
      if (powerData) {
        powerData.forEach(p => {
            stats[p.team] = {
                sos: p.true_sos, 
                rank: p.overall_power, 
                qb: p.qb_grade, 
                def: p.defense_grade,
                wins: 0, losses: 0
            };
        });
      }
      
      // Calc Records
      if (history) {
          const records = {}; 
          history.forEach(g => {
             if (!records[g.home_team]) records[g.home_team] = {w:0, l:0};
             if (!records[g.away_team]) records[g.away_team] = {w:0, l:0};
             if (g.home_score !== null) {
                 const hs = parseFloat(g.home_score); const as = parseFloat(g.away_score);
                 if (hs > as) { records[g.home_team].w++; records[g.away_team].l++; }
                 else if (as > hs) { records[g.away_team].w++; records[g.home_team].l++; }
             }
          });

          history.forEach(g => {
              const h = g.home_team; const a = g.away_team;
              if (!stats[h]) stats[h] = { wins:0, losses:0, rank:50, sos:0, qb:50, def:50 };
              if (!stats[a]) stats[a] = { wins:0, losses:0, rank:50, sos:0, qb:50, def:50 };

              if (g.home_score !== null) {
                 if (records[h]) { stats[h].wins = records[h].w; stats[h].losses = records[h].l; }
                 if (records[a]) { stats[a].wins = records[a].w; stats[a].losses = records[a].l; }
              }
          });
      }
      setLeagueStats(stats);
      setLoading(false);
    }
    loadData();
  }, [currentSeason, selectedWeek]);

  // --- PREDICTION ACCURACY CALCULATOR ---
  const accuracyStats = useMemo(() => {
    let seasonCorrect = 0;
    let seasonTotal = 0;
    let weekCorrect = 0;
    let weekTotal = 0;

    allGames.forEach(game => {
        if (game.home_score !== null && predictions[game.game_id]) {
            const hScore = parseFloat(game.home_score);
            const aScore = parseFloat(game.away_score);
            if (isNaN(hScore) || isNaN(aScore)) return;

            const actualWinner = hScore > aScore ? game.home_team : game.away_team;
            const p = predictions[game.game_id];
            const predictedWinner = parseFloat(p.home_score) > parseFloat(p.away_score) ? game.home_team : game.away_team;

            const isCorrect = actualWinner === predictedWinner;

            seasonTotal++;
            if (isCorrect) seasonCorrect++;

            if (game.week === selectedWeek) {
                weekTotal++;
                if (isCorrect) weekCorrect++;
            }
        }
    });

    const calcPct = (c, t) => t === 0 ? 0 : Math.round((c / t) * 100);

    return {
        season: { correct: seasonCorrect, total: seasonTotal, pct: calcPct(seasonCorrect, seasonTotal) },
        week:   { correct: weekCorrect,   total: weekTotal,   pct: calcPct(weekCorrect, weekTotal) }
    };
  }, [allGames, predictions, selectedWeek]);


  const getAccColor = (pct) => {
      if (pct >= 55) return 'text-emerald-400';
      if (pct >= 50) return 'text-yellow-400';
      return 'text-rose-400';
  };

  const sortedByImportance = [...weekGames].sort((a, b) => {
    const pA = (leagueStats[a.home_team]?.rank || 0) + (leagueStats[a.away_team]?.rank || 0);
    const pB = (leagueStats[b.home_team]?.rank || 0) + (leagueStats[b.away_team]?.rank || 0);
    return pB - pA; 
  });
  const heroGame = sortedByImportance[0];
  const fmt = (val) => val ? val.toFixed(1) : '-';
  const heroHomeRec = heroGame ? `PWR ${fmt(leagueStats[heroGame.home_team]?.rank)}` : '0-0';
  const heroAwayRec = heroGame ? `PWR ${fmt(leagueStats[heroGame.away_team]?.rank)}` : '0-0';
  
  const rankedData = Object.keys(leagueStats)
    .map(team => ({ team, ...leagueStats[team] }))
    .sort((a, b) => b.sos - a.sos).slice(0, 15);



  if (view === 'team') {
    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 md:p-8">
            <TeamDetail 
              teamId={selectedTeam} 
              games={allGames} 
              leagueStats={leagueStats} 
              predictions={predictions}
              modelWeights={modelWeights} /* <--- ADD THIS PROP */
              onBack={() => setView('dashboard')} 
            />
        </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <nav className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <LayoutGrid className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-none">NFL<span className="text-indigo-400">NEXUS</span></h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em] mt-1">PRO ANALYTICS</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto">
            <button 
               onClick={() => setShowBacktest(true)}
               className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-indigo-300 transition-colors mr-4"
            >
               <Settings2 className="w-3 h-3" /> Tune Model
            </button>

            <div className="hidden md:flex items-center gap-4 mr-4 border-r border-white/10 pr-6">
                <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Season</p>
                    <p className={`text-sm font-mono font-bold ${getAccColor(accuracyStats.season.pct)}`}>
                        {accuracyStats.season.pct}% <span className="text-slate-600 text-[10px]">({accuracyStats.season.correct}/{accuracyStats.season.total})</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Week {selectedWeek}</p>
                    <p className={`text-sm font-mono font-bold ${getAccColor(accuracyStats.week.pct)}`}>
                        {accuracyStats.week.pct}% <span className="text-slate-600 text-[10px]">({accuracyStats.week.correct}/{accuracyStats.week.total})</span>
                    </p>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-xs font-mono text-slate-400 hidden sm:block">
                {currentSeason}
            </div>
            <div className="relative">
                <select 
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="appearance-none bg-white/5 border border-white/10 hover:border-indigo-500/50 text-indigo-300 text-xs font-mono font-bold py-2 pl-4 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                >
                {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w} className="bg-slate-900 text-slate-300">WEEK {w} {w === currentWeek ? '(CURRENT)' : ''}</option>
                ))}
                </select>
            </div>
          </div>
        </nav>
        
        {/* MOBILE HEADER STATS */}
        <div className="md:hidden flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/10">
            <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Season Acc</p>
                <p className={`text-lg font-mono font-bold ${getAccColor(accuracyStats.season.pct)}`}>{accuracyStats.season.pct}%</p>
            </div>
             <button 
               onClick={() => setShowBacktest(true)}
               className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg text-xs font-bold text-indigo-300 transition-colors"
            >
               <Settings2 className="w-4 h-4" /> Tune
            </button>
            <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Week {selectedWeek}</p>
                <p className={`text-lg font-mono font-bold ${getAccColor(accuracyStats.week.pct)}`}>{accuracyStats.week.pct}%</p>
            </div>
        </div>

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
                const hScore = parseFloat(game.home_score);
                const isFinal = game.home_score !== null && !isNaN(hScore) && hScore < 200;
                
                let predStatus = null; 
                if (isFinal && predictions[game.game_id]) {
                    const actualWinner = hScore > parseFloat(game.away_score) ? game.home_team : game.away_team;
                    const p = predictions[game.game_id];
                    const predictedWinner = parseFloat(p.home_score) > parseFloat(p.away_score) ? game.home_team : game.away_team;
                    predStatus = actualWinner === predictedWinner ? 'correct' : 'incorrect';
                }

                return (
                  <div key={game.game_id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => setSelectedGame(game)}>
                    <div className="w-24 flex-shrink-0 text-center">
                        {isFinal ? <Badge variant={predStatus === 'correct' ? 'success' : predStatus === 'incorrect' ? 'danger' : 'default'}>{predStatus === 'correct' ? 'HIT' : predStatus === 'incorrect' ? 'MISS' : 'FINAL'}</Badge> : 
                        <div className="flex flex-col items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">{game.weekday}</span><span className="text-xs font-mono text-slate-300">{formatGameTime(game.gametime)}</span></div>}
                    </div>
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
                    <th className="px-4 py-3 font-normal">Team</th>
                    <th className="px-4 py-3 font-normal text-right">Power</th>
                    <th className="px-4 py-3 font-normal text-right">QB</th>
                    <th className="px-4 py-3 font-normal text-right">Def</th>
                    <th className="px-4 py-3 font-normal text-right">SOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.keys(leagueStats).sort((a,b) => (leagueStats[b].rank || 0) - (leagueStats[a].rank || 0)).map(teamId => {
                    const d = leagueStats[teamId];
                    return (
                      <tr key={teamId} className="hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { setSelectedTeam(teamId); setView('team'); }}>
                        <td className="px-4 py-2 flex items-center gap-3"><TeamLogo team={teamId} size="w-6 h-6" /><span className="font-bold text-slate-200">{teamId}</span></td>
                        <td className="px-4 py-2 text-right font-mono text-white font-bold">{d.rank ? d.rank.toFixed(1) : '-'}</td>
                        <td className="px-4 py-2 text-right font-mono text-indigo-400">{d.qb ? d.qb.toFixed(1) : '-'}</td>
                        <td className="px-4 py-2 text-right font-mono text-emerald-400">{d.def ? d.def.toFixed(1) : '-'}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-400">{d.sos ? d.sos.toFixed(1) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* OVERLAYS */}
      {selectedGame && (
        <MatchupOverlay 
            game={selectedGame} 
            leagueStats={leagueStats} 
            predictions={predictions} 
            customWeights={modelWeights} // PASS WEIGHTS DOWN
            onClose={() => setSelectedGame(null)} 
        />
      )}
      
      {showBacktest && (
        <BacktestModal 
          games={allGames} 
          leagueStats={leagueStats} 
          onClose={() => setShowBacktest(false)} 
          onSaveWeights={(w) => {
             setModelWeights(w); // SAVE WEIGHTS TO STATE
             setShowBacktest(false);
          }} 
        />
      )}
    </div>
  );
}