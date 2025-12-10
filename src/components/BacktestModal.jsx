// src/components/BacktestModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Sliders, RefreshCw, Save } from 'lucide-react';

export function BacktestModal({ games, leagueStats, onClose, onSaveWeights }) {
  // Default Weights (The "knobs" you can turn)
  const [weights, setWeights] = useState({
    power: 1.0,  // Importance of Overall Power Rank
    qb: 1.0,     // Importance of QB Grade
    def: 1.0,    // Importance of Defense Grade
    home: 2.0    // Home Field Advantage Points
  });

  const [bestResult, setBestResult] = useState({ pct: 0, weights: null });

  // RUN THE SIMULATION
  // This runs instantly every time you move a slider
  const results = useMemo(() => {
    let correct = 0;
    let total = 0;

    games.forEach(game => {
      // 1. Skip if game isn't finished or scores are invalid
      const hScore = parseFloat(game.home_score);
      const aScore = parseFloat(game.away_score);
      if (game.home_score === null || isNaN(hScore) || isNaN(aScore)) return;

      // 2. Identify Teams
      const hTeam = leagueStats[game.home_team];
      const aTeam = leagueStats[game.away_team];
      
      // If we don't have stats for a team, we can't predict
      if (!hTeam || !aTeam) return;

      // 3. Calculate "Team Score" based on your Slider Weights
      // Formula: (Rank * W) + (QB * W) + (Def * W) + HomeBonus
      const hStrength = ((hTeam.rank || 50) * weights.power) + ((hTeam.qb || 50) * weights.qb) + ((hTeam.def || 50) * weights.def) + weights.home;
      const aStrength = ((aTeam.rank || 50) * weights.power) + ((aTeam.qb || 50) * weights.qb) + ((aTeam.def || 50) * weights.def);

      // 4. Predicted Winner vs Actual Winner
      const predictedHomeWin = hStrength > aStrength;
      const actualHomeWin = hScore > aScore;

      if (predictedHomeWin === actualHomeWin) correct++;
      total++;
    });

    const pct = total === 0 ? 0 : ((correct / total) * 100).toFixed(1);
    return { correct, total, pct };
  }, [games, leagueStats, weights]);

  // Track "High Score" during this session
  useEffect(() => {
    if (parseFloat(results.pct) > bestResult.pct) {
      setBestResult({ pct: parseFloat(results.pct), weights: { ...weights } });
    }
  }, [results, weights, bestResult.pct]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" /> Algorithm Lab
            </h2>
            <p className="text-xs text-slate-400 mt-1">Adjust weights to backtest and improve accuracy.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="p-6 overflow-y-auto space-y-8">
          
          {/* RESULTS DASHBOARD */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 rounded-xl p-4 border border-white/10 text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
               <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Simulated Accuracy</p>
               <div className="text-4xl font-mono font-bold text-white flex items-center justify-center gap-2">
                 {results.pct}%
                 {parseFloat(results.pct) > 52.4 ? <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">PROFITABLE</span> : <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded">LOSS</span>}
               </div>
               <p className="text-xs text-slate-600 mt-2">{results.correct} Correct / {results.total} Games</p>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-white/10 text-center opacity-70">
               <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Session High Score</p>
               <div className="text-2xl font-mono font-bold text-emerald-400">{bestResult.pct > 0 ? bestResult.pct : '-'}%</div>
               <p className="text-[10px] text-slate-600 mt-1">Best Config Found</p>
            </div>
          </div>

          {/* SLIDERS */}
          <div className="space-y-6">
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 font-bold">Power Rank Weight</span>
                <span className="font-mono text-indigo-400">{weights.power.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0" max="5" step="0.1" 
                value={weights.power}
                onChange={(e) => setWeights({...weights, power: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[10px] text-slate-500">How much does the overall ESPN/PFF rank matter?</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 font-bold">QB Grade Weight</span>
                <span className="font-mono text-indigo-400">{weights.qb.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0" max="5" step="0.1" 
                value={weights.qb}
                onChange={(e) => setWeights({...weights, qb: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[10px] text-slate-500">How much do you value the QB performance?</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 font-bold">Defense Weight</span>
                <span className="font-mono text-indigo-400">{weights.def.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0" max="5" step="0.1" 
                value={weights.def}
                onChange={(e) => setWeights({...weights, def: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 font-bold">Home Field Advantage</span>
                <span className="font-mono text-indigo-400">+{weights.home.toFixed(1)} pts</span>
              </div>
              <input 
                type="range" min="0" max="10" step="0.5" 
                value={weights.home}
                onChange={(e) => setWeights({...weights, home: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[10px] text-slate-500">Free points added to the Home team's score.</p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
            <button onClick={() => setWeights({power:1, qb:1, def:1, home:2})} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-2">
                <RefreshCw className="w-3 h-3" /> Reset
            </button>
            <button 
                onClick={() => onSaveWeights(weights)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
            >
                <Save className="w-3 h-3" /> Save Model Config
            </button>
        </div>
      </div>
    </div>
  );
}