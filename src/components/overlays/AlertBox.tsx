'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { StreamEvent } from '@/hooks/useEvents';

interface AlertBoxProps {
  lastEvent: StreamEvent | null;
}

export default function AlertBox({ lastEvent }: AlertBoxProps) {
  const [currentAlert, setCurrentAlert] = useState<StreamEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (lastEvent && (lastEvent.type === 'donation' || lastEvent.type === 'verification')) {
      setCurrentAlert(lastEvent);
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  return (
    <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <AnimatePresence>
        {isVisible && currentAlert && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="bg-primary border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 min-w-[400px] text-white"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-black uppercase tracking-widest bg-black text-white px-2 py-1">
                {currentAlert.type === 'donation' ? 'NEW DONATION' : 'VERIFICATION'}
              </span>
              <h2 className="text-4xl font-black italic uppercase">
                {currentAlert.data.user || 'Unknown'}
              </h2>
              {currentAlert.data.amount && (
                <p className="text-5xl font-black text-accent drop-shadow-md">
                  {currentAlert.data.amount} {currentAlert.data.currency || 'EUR'}
                </p>
              )}
              {currentAlert.data.message && (
                <p className="text-xl font-bold bg-white text-black p-2 border-2 border-black mt-2">
                  "{currentAlert.data.message}"
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
