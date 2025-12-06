// src/components/HeroMatchup.jsx
import React from 'react';
import { Flame } from 'lucide-react';
import { TeamLogo } from './UI';
import { formatGameTime } from '../utils/nflHelpers';

export const HeroSkeleton = () => (
  <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-white/5 mb-8 h-24 flex items-center justify-between px-6 animate-pulse">
    <div className="flex items-center gap-4 flex-1">
      <div className="w-12 h-12 bg-slate-800 rounded-full"></div>
      <div className="h-6 w-32 bg-slate-800 rounded"></div>
    </div>
    <div className="h-4 w-24 bg-slate-800 rounded"></div>
    <div className="flex items-center gap-4 flex-1 justify-end">
      <div className="h-6 w-32 bg-slate-800 rounded"></div>
      <div className="w-12 h-12 bg-slate-800 rounded-full"></div>
    </div>
  </div>
);

export const HeroMatchup = ({ game, homeRec, awayRec }) => {
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
                <div className="flex items-center justify-center md:justify-end gap-2 mt-2">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Away</span>
                   <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                   <span className="font-mono text-sm text-white">{awayRec}</span>
                </div>
             </div>
          </div>

          <div className="flex-shrink-0 mx-8 md:mx-16 my-6 md:my-0 flex flex-col items-center justify-center w-32">
             <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-2 text-center whitespace-nowrap">Matchup of the Week</span>
             <div className="text-6xl font-black text-white font-mono italic leading-none">VS</div>
             <div className="text-xs font-mono text-slate-400 mt-2 text-center bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                {game.weekday} • {formatGameTime(game.gametime)}
             </div>
          </div>

          <div className="flex-1 flex flex-col items-center md:items-start justify-center gap-2 text-center md:text-left w-full">
             <TeamLogo team={game.home_team} size="w-20 h-20 md:w-24 md:h-24" />
             <div>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-none tracking-tighter">{game.home_team}</h2>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                   <span className="font-mono text-sm text-white">{homeRec}</span>
                   <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Home</span>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};