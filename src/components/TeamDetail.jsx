// src/components/TeamDetail.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronLeft, BarChart3 } from 'lucide-react';
import { TeamLogo } from './UI';
import { RosterView } from './RosterView';
import { MatchupOverlay } from './MatchupOverlay';

export const TeamDetail = ({ teamId, games, leagueStats, onBack }) => {
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

  return (
    <div className="animate-in max-w-5xl mx-auto">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"><ChevronLeft className="w-4 h-4" /> Back to Dashboard</button>
      
      {/* HERO */}
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

      {/* Tabs */}
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