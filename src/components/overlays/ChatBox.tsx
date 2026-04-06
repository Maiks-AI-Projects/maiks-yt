'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { StreamEvent } from '@/hooks/useEvents';

interface ChatBoxProps {
  events: StreamEvent[];
}

export default function ChatBox({ events }: ChatBoxProps) {
  const chatMessages = events.filter((e) => e.type === 'chat');

  return (
    <div className="w-[350px] flex flex-col gap-2 max-h-[500px] overflow-hidden">
      <AnimatePresence initial={false}>
        {chatMessages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className="flex flex-col bg-black/80 border-l-4 border-primary p-3"
          >
            <div className="flex items-center gap-2">
              <span className="font-black text-primary text-sm uppercase">
                {msg.data.user || 'Unknown'}
              </span>
              {msg.data.platform && (
                <span className={`text-[10px] px-1 font-bold ${msg.data.platform === 'twitch' ? 'bg-purple-600' : 'bg-red-600'} text-white`}>
                  {msg.data.platform.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-white font-bold leading-tight break-words">
              {msg.data.message}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
