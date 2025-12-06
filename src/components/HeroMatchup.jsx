// src/components/HeroMatchup.jsx
import React from 'react';
import { TeamLogo } from './UI';
import { formatGameTime } from '../utils/nflHelpers';
import { getTeamColors } from '../utils/teamColors';

export const HeroSkeleton = () => (
  <div className="relative overflow-hidden rounded-3xl bg-slate-900/50 border border-white/5 mb-10 h-64 flex items-center justify-center animate-pulse shadow-2xl">
    <div className="w-24 h-24 bg-slate-800/80 rounded-full"></div>
    <div className="mx-12 h-16 w-32 bg-slate-800/80 rounded-xl"></div>
    <div className="w-24 h-24 bg-slate-800/80 rounded-full"></div>
  </div>
);

export const HeroMatchup = ({ game, homeRec, awayRec }) => {
  if (!game) return null;

  const awayColors = getTeamColors(game.away_team);
  const homeColors = getTeamColors(game.home_team);

  // --- THE 3D CRASHING WAVE CSS ---
  const dynamicBackgroundStyle = {
    backgroundColor: '#020617', // Deep slate base
    backgroundImage: `
        /* 1. Central Impact Turbulence (bright spot in middle) */
        radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 45%),
        
        /* 2. Away Team Wave (From Left, angled down-right) */
        linear-gradient(115deg, 
            ${awayColors.primary} 0%, 
            ${awayColors.secondary} 35%, 
            rgba(0,0,0,0.8) 55%, 
            transparent 100%),
            
        /* 3. Home Team Wave (From Right, angled down-left) */
        linear-gradient(245deg, 
            ${homeColors.primary} 0%, 
            ${homeColors.secondary} 35%, 
            rgba(0,0,0,0.8) 55%, 
            transparent 100%)
    `,
    // Deep inset shadow for 3D effect + outer glow
    boxShadow: `inset 0 0 100px rgba(0,0,0,0.9), 0 20px 50px -10px ${awayColors.primary}30, 0 20px 50px -10px ${homeColors.primary}30`,
    border: `1px solid rgba(255,255,255,0.15)`
  };

  return (
    <div 
      style={dynamicBackgroundStyle}
      className="w-full relative overflow-hidden rounded-[2rem] mb-12 group cursor-pointer transition-all duration-500 hover:scale-[1.01] hover:shadow-3xl animate-in fade-in z-10"
    >
       {/* Subtle noise texture overlay for more realism */}
       <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none mix-blend-overlay"></div>

       <div className="relative z-20 flex flex-col md:flex-row items-center justify-between px-8 py-12 md:py-16 h-full w-full max-w-6xl mx-auto">
          
          {/* AWAY TEAM (Left Side) */}
          <div className="flex-1 flex flex-col items-center md:items-end justify-center gap-4 text-center md:text-right w-full relative">
             {/* Ambient light flare behind logo */}
             <div className="absolute top-1/2 left-1/2 md:left-auto md:right-0 -translate-x-1/2 md:translate-x-0 -translate-y-1/2 w-48 h-48 bg-white/10 blur-[60px] rounded-full -z-10"></div>
             <TeamLogo team={game.away_team} size="w-24 h-24 md:w-32 md:h-32 drop-shadow-2xl" />
             <div>
                <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{game.away_team}</h2>
                <div className="flex items-center justify-center md:justify-end gap-3 mt-3">
                   <span className="text-xs font-bold text-white/70 uppercase tracking-widest px-3 py-1 rounded-full bg-black/30 border border-white/10">Away</span>
                   <span className="font-mono text-lg text-white font-bold drop-shadow-md">{awayRec}</span>
                </div>
             </div>
          </div>

          {/* CENTER VS (The Crash Zone) */}
          <div className="flex-shrink-0 mx-4 md:mx-12 my-8 md:my-0 flex flex-col items-center justify-center z-30 relative">
             <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.3em] mb-2 text-center whitespace-nowrap drop-shadow-md bg-black/20 px-4 py-1 rounded-full backdrop-blur-md border border-white/10">Game of the Week</span>
             <div className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 font-mono italic leading-none drop-shadow-2xl" style={{WebkitTextStroke: '2px rgba(255,255,255,0.1)'}}>VS</div>
             <div className="text-sm font-mono text-white/90 mt-4 text-center bg-black/40 px-6 py-2 rounded-xl border border-white/10 backdrop-blur-md shadow-lg">
                {game.weekday} • {formatGameTime(game.gametime)}
             </div>
          </div>

          {/* HOME TEAM (Right Side) */}
          <div className="flex-1 flex flex-col items-center md:items-start justify-center gap-4 text-center md:text-left w-full relative">
             <div className="absolute top-1/2 left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 -translate-y-1/2 w-48 h-48 bg-white/10 blur-[60px] rounded-full -z-10"></div>
             <TeamLogo team={game.home_team} size="w-24 h-24 md:w-32 md:h-32 drop-shadow-2xl" />
             <div>
                <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{game.home_team}</h2>
                <div className="flex items-center justify-center md:justify-start gap-3 mt-3">
                   <span className="font-mono text-lg text-white font-bold drop-shadow-md">{homeRec}</span>
                   <span className="text-xs font-bold text-white/70 uppercase tracking-widest px-3 py-1 rounded-full bg-black/30 border border-white/10">Home</span>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};