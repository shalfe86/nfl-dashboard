// src/components/MatchupOverlay.jsx
import React from 'react';
import { X, Activity, Flame, TrendingUp, Zap, BarChart3 } from 'lucide-react';
import { TeamLogo, StatBar } from './UI';
import { formatGameTime } from '../utils/nflHelpers';

export const MatchupOverlay = ({ game, leagueStats, onClose }) => {
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