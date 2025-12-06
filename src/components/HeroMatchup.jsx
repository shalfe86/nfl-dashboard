import React from 'react';
import { Trophy, Flame } from 'lucide-react';

const TeamLogo = ({ team, size="w-16 h-16" }) => (
  <img 
    src={`https://a.espncdn.com/i/teamlogos/nfl/500/${team}.png`} 
    alt={team} 
    className={`${size} object-contain drop-shadow-2xl`}
    onError={(e) => { e.target.src = 'https://a.espncdn.com/i/teamlogos/nfl/500/nfl.png' }} 
  />
);

export default function HeroMatchup({ game }) {
  if (!game) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-950 border border-white/10 p-8 md:p-12 mb-12 group">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Left Team */}
        <div className="flex flex-col items-center gap-4 flex-1">
          <TeamLogo team={game.away_team} size="w-24 h-24 md:w-32 md:h-32" />
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter">{game.away_team}</h2>
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-slate-400">
            AWAY • 8-4 RECORD
          </div>
        </div>

        {/* Center Info */}
        <div className="flex flex-col items-center text-center px-8">
          <div className="flex items-center gap-2 text-indigo-400 mb-2 font-bold tracking-widest text-xs uppercase">
            <Flame className="w-4 h-4" /> Game of the Week
          </div>
          <div className="text-6xl md:text-8xl font-black text-white font-mono leading-none">
            VS
          </div>
          <div className="mt-4 text-slate-400 font-mono text-sm border border-white/10 px-4 py-2 rounded-lg bg-black/20 backdrop-blur-sm">
            {game.gametime || "SUNDAY 4:25 PM"}
          </div>
        </div>

        {/* Right Team */}
        <div className="flex flex-col items-center gap-4 flex-1">
          <TeamLogo team={game.home_team} size="w-24 h-24 md:w-32 md:h-32" />
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter">{game.home_team}</h2>
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-slate-400">
            HOME • 9-3 RECORD
          </div>
        </div>

      </div>
      
      {/* "Analyze" Button Overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-black/40 backdrop-blur-[2px] cursor-pointer">
        <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-xl shadow-indigo-900/50 transition-all transform hover:scale-105 flex items-center gap-3">
          <Trophy className="w-5 h-5" /> View Matchup Analysis
        </button>
      </div>
    </div>
  );
}