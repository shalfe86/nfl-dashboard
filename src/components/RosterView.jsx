// src/components/RosterView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

export const RosterView = ({ teamId }) => {
  const [fullRoster, setFullRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Offense'); 
  const [posFilter, setPosFilter] = useState('All');

  const GROUPS = useMemo(() => ({
    'Offense': ['QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'FB'],
    'Defense': ['DL', 'DE', 'DT', 'LB', 'ILB', 'OLB', 'CB', 'DB', 'S', 'SS', 'FS'],
    'Special Teams': ['K', 'P', 'LS']
  }), []);

  useEffect(() => {
    async function fetchRoster() {
      // 1. Fetch Roster
      const { data: rosterData } = await supabase
        .from('rosters')
        .select('*')
        .eq('team', teamId)
        .order('season', { ascending: false }); 

      // 2. Fetch Grades
      const { data: gradeData } = await supabase
        .from('player_season_grades')
        .select('player_id, grade')
        .eq('team', teamId);

      const gradeMap = {};
      if (gradeData) { gradeData.forEach(g => gradeMap[g.player_id] = g.grade); }
        
      const uniquePlayers = [];
      const seenIds = new Set();
      if (rosterData) {
        rosterData.forEach(p => {
          if (!seenIds.has(p.player_id)) {
            seenIds.add(p.player_id);
            p.grade = gradeMap[p.player_id] || null;
            uniquePlayers.push(p);
          }
        });
      }
      setFullRoster(uniquePlayers);
      setLoading(false);
    }
    fetchRoster();
  }, [teamId]);

  const categoryRoster = fullRoster.filter(p => GROUPS[category]?.includes(p.position));
  const availablePositions = ['All', ...new Set(categoryRoster.map(p => p.position).sort())];
  const displayRoster = categoryRoster.filter(p => posFilter === 'All' || p.position === posFilter);

  const getGradeColor = (grade) => {
      if (!grade) return 'text-slate-500';
      if (grade >= 90) return 'text-emerald-400 font-black'; 
      if (grade >= 80) return 'text-emerald-500 font-bold'; 
      if (grade >= 70) return 'text-blue-400'; 
      if (grade >= 60) return 'text-slate-300'; 
      return 'text-rose-400'; 
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Roster...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-900/50 p-4 border-b border-white/5 space-y-4">
        <div className="flex bg-slate-950 p-1 rounded-lg w-fit border border-white/10">
          {Object.keys(GROUPS).map(group => (
            <button key={group} onClick={() => { setCategory(group); setPosFilter('All'); }} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${category === group ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{group}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {availablePositions.map(pos => (
            <button key={pos} onClick={() => setPosFilter(pos)} className={`px-3 py-1 rounded-full text-[10px] font-mono border transition-colors ${posFilter === pos ? 'bg-white text-slate-900 border-white font-bold' : 'bg-slate-800 text-slate-400 border-transparent hover:border-slate-600'}`}>{pos}</button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-sm z-10">
            <tr className="text-[10px] text-slate-500 border-b border-white/10 uppercase tracking-wider">
              <th className="px-4 py-3">Player</th><th className="px-4 py-3">Pos</th><th className="px-4 py-3 text-right">Jersey</th><th className="px-4 py-3 text-right">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayRoster.map((player) => (
              <tr key={player.player_id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-white/10 shrink-0">
                     {player.headshot_url ? <img src={player.headshot_url} className="w-full h-full object-cover" /> : <span className="text-[10px] text-slate-500">{player.position}</span>}
                  </div>
                  <span className="font-bold text-white text-sm">{player.player_name || player.player || player.full_name}</span>
                </td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">{player.position}</td>
                <td className="px-4 py-2 text-right text-slate-500 font-mono">{player.jersey_number}</td>
                <td className={`px-4 py-2 text-right font-mono ${getGradeColor(player.grade)}`}>{player.grade || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};