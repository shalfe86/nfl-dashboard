// src/components/SosLeaderboard.jsx
import React from 'react';
import { TeamLogo } from './UI';

export const SosLeaderboard = ({ data, onSelectTeam }) => {
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