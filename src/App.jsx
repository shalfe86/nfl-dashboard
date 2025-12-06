// src/App.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { LayoutGrid, Activity, Shield } from 'lucide-react';
import { TeamLogo, Badge } from './components/UI';
import { HeroMatchup, HeroSkeleton } from './components/HeroMatchup';
import { SosLeaderboard } from './components/SosLeaderboard';
import { MatchupOverlay } from './components/MatchupOverlay';
import { TeamDetail } from './components/TeamDetail';
import { getDynamicSeason, getDynamicWeek, formatGameTime } from './utils/nflHelpers';

export default function App() {
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
      const { data: currentGames } = await supabase.from('schedules').select('*').eq('season', currentSeason).eq('week', currentWeek).order('gameday');
      setWeekGames(currentGames || []);

      const { data: history } = await supabase.from('schedules').select('*').eq('season', currentSeason);
      setAllGames(history || []);

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