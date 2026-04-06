'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { StreamEvent } from '@/hooks/useEvents';

interface EventListProps {
  events: StreamEvent[];
}

export default function EventList({ events }: EventListProps) {
  const filteredEvents = events.filter((e) => ['join', 'event', 'donation', 'verification'].includes(e.type));

  return (
    <div className="w-[300px] flex flex-col gap-1">
      <div className="bg-black text-white px-2 py-1 font-black uppercase text-xs tracking-widest border-l-4 border-accent">
        Recent Activity
      </div>
      <AnimatePresence initial={false}>
        {filteredEvents.slice(0, 5).map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-black/60 text-white p-2 border-b border-white/10 flex items-center gap-2 overflow-hidden"
          >
             <span className="text-[10px] uppercase font-black text-accent">{e.type}</span>
             <span className="text-sm font-bold truncate">
                {e.type === 'join' ? `${e.data.user || 'Someone'} joined` : 
                 e.type === 'donation' ? `${e.data.user || 'Someone'} sent ${e.data.amount}${e.data.currency}` : 
                 e.data.message || `${e.data.user || 'Someone'} did something`}
             </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
