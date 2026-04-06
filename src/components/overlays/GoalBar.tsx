'use client';

import { motion } from 'framer-motion';

interface GoalBarProps {
  current: number;
  target: number;
  label: string;
}

export default function GoalBar({ current, target, label }: GoalBarProps) {
  const percentage = Math.min((current / target) * 100, 100);

  return (
    <div className="w-[400px] bg-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] overflow-hidden relative">
      <div className="flex justify-between items-center px-4 py-1 text-white z-10 relative">
        <span className="font-black uppercase tracking-widest text-lg italic">{label}</span>
        <span className="font-black text-xl">{current}/{target} EUR</span>
      </div>
      <div className="h-6 bg-zinc-800 w-full relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="h-full bg-accent border-r-4 border-white"
        />
        <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-white mix-blend-difference">{percentage.toFixed(0)}% REACHED</span>
        </div>
      </div>
    </div>
  );
}
