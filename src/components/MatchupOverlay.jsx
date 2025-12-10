// src/components/MatchupOverlay.jsx
import React, { useMemo } from 'react';
import { X, TrendingUp, Sliders } from 'lucide-react';
import { TeamLogo } from './UI';

export function MatchupOverlay({ game, leagueStats, predictions, customWeights, onClose }) {
  if (!game) return null;

  const hStats = leagueStats[game.home_team] || { rank: 50, qb: 50, def: 50 };
  const aStats = leagueStats[game.away_team] || { rank: 50, qb: 50, def: 50 };
  

// LOGIC: Use DB prediction OR Calculate Live based on Custom Weights
  const liveData = useMemo(() => {
    // 1. Calculate weighted score using Python formula
    const hScoreVal = 
        (hStats.rank * customWeights.power) + 
        (hStats.qb * customWeights.qb) + 
        (hStats.def * customWeights.def) + 
        customWeights.home;

    const aScoreVal = 
        (aStats.rank * customWeights.power) + 
        (aStats.qb * customWeights.qb) + 
        (aStats.def * customWeights.def);

    // 2. Convert raw weighted score difference into Points
    const diff = hScoreVal - aScoreVal;
    
    const spread = diff / 15.0; 
    const baseScore = 23; 
    
    let pHome = Math.round(baseScore + (spread / 2));
    let pAway = Math.round(baseScore - (spread / 2));
    
    // --- TIE BREAKER LOGIC ---
    if (pHome === pAway) {
        if (diff >= 0) {
            pHome += 1; // Home had slight edge (or exact tie), give them the point
        } else {
            pAway += 1; // Away had slight edge, give them the point
        }
    }
    // -------------------------

    // 3. Determine Winner & Confidence
    const projectedWinner = pHome > pAway ? game.home_team : game.away_team;
    const absSpread = Math.abs(pHome - pAway);
    // Simple confidence calc: 50% base + spread multiplier, capped at 99%
    const confidence = Math.min(50 + (absSpread * 3.5), 99).toFixed(1);

    return {
        winner: projectedWinner,
        pHome,
        pAway,
        confidence
    };
  }, [hStats, aStats, customWeights, game.home_team, game.away_team]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl bg-[#0b1120] border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">Matchup Analysis</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3">
          
          {/* LEFT: AWAY TEAM */}
          <div className="p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10 bg-gradient-to-br from-slate-900 to-slate-950">
            <TeamLogo team={game.away_team} size="w-24 h-24" />
            <h2 className="text-3xl font-black text-white mt-4">{game.away_team}</h2>
            <div className="mt-4 space-y-2 w-full">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Power Rank</span><span className="font-mono text-white">{aStats.rank ? aStats.rank.toFixed(1) : '-'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">QB Grade</span><span className="font-mono text-indigo-400">{aStats.qb ? aStats.qb.toFixed(1) : '-'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Defense</span><span className="font-mono text-emerald-400">{aStats.def ? aStats.def.toFixed(1) : '-'}</span></div>
            </div>
          </div>

          {/* CENTER: PREDICTION */}
          <div className="p-8 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-indigo-500/5 radial-gradient" />
            
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Sliders className="w-3 h-3" /> Live Model
            </h3>
            
            <div className="text-center space-y-6 relative z-10">
                <div>
                    <div className="text-6xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                        {liveData.winner}
                    </div>
                    <div className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">
                        to Win
                    </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Confidence</div>
                    <div className={`text-2xl font-mono font-bold ${parseFloat(liveData.confidence) > 65 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {liveData.confidence}%
                    </div>
                </div>

                <div className="flex items-center justify-center gap-8 pt-4 border-t border-white/5">
                    <div className="text-center">
                        <div className="text-xl font-bold text-white">{liveData.pAway}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{game.away_team}</div>
                    </div>
                    <div className="text-xs font-bold text-slate-600">PROJ SCORE</div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-white">{liveData.pHome}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{game.home_team}</div>
                    </div>
                </div>
            </div>
          </div>

          {/* RIGHT: HOME TEAM */}
          <div className="p-8 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-white/10 bg-gradient-to-bl from-slate-900 to-slate-950">
            <TeamLogo team={game.home_team} size="w-24 h-24" />
            <h2 className="text-3xl font-black text-white mt-4">{game.home_team}</h2>
            <div className="mt-4 space-y-2 w-full">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Power Rank</span><span className="font-mono text-white">{hStats.rank ? hStats.rank.toFixed(1) : '-'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">QB Grade</span><span className="font-mono text-indigo-400">{hStats.qb ? hStats.qb.toFixed(1) : '-'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Defense</span><span className="font-mono text-emerald-400">{hStats.def ? hStats.def.toFixed(1) : '-'}</span></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}