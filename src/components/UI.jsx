// src/components/UI.jsx
import React from 'react';
import { TEAM_MAP } from '../utils/nflHelpers';

export const TeamLogo = ({ team, size = "w-8 h-8" }) => {
  const abbr = TEAM_MAP[team] || team;
  const url = `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`;
  return <img src={url} alt={team} className={`${size} object-contain drop-shadow-sm`} 
    onError={(e) => { e.target.src = 'https://a.espncdn.com/i/teamlogos/nfl/500/nfl.png' }} />;
};

export const Badge = ({ children, color="bg-slate-800 text-slate-400" }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-white/5 ${color}`}>
    {children}
  </span>
);

export const StatBar = ({ label, value1, value2, color1="bg-emerald-500", color2="bg-rose-500", label1, label2 }) => {
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