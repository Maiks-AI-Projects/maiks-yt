'use client';

import { useParams } from 'next/navigation';
import { useEvents } from '@/hooks/useEvents';
import AlertBox from '@/components/overlays/AlertBox';
import GoalBar from '@/components/overlays/GoalBar';
import ChatBox from '@/components/overlays/ChatBox';
import EventList from '@/components/overlays/EventList';

export default function OverlayPage() {
  const params = useParams();
  const scene = params.scene as string;
  const { events, lastEvent } = useEvents();

  // Mock goal data (in real apps, fetch this from an API or SSE)
  const goal = { current: 450, target: 1000, label: 'PC Upgrade' };

  return (
    <main className="w-screen h-screen bg-transparent relative overflow-hidden text-white font-sans">
      {/* Universal Alerts */}
      <AlertBox lastEvent={lastEvent} />

      {scene === 'in-game' && (
        <>
          <div className="absolute bottom-10 left-10">
            <ChatBox events={events} />
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
            <GoalBar current={goal.current} target={goal.target} label={goal.label} />
          </div>
          <div className="absolute top-10 right-10">
            <EventList events={events} />
          </div>
        </>
      )}

      {scene === 'just-talking' && (
        <>
          <div className="absolute top-1/2 left-10 -translate-y-1/2">
            <ChatBox events={events} />
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
            <GoalBar current={goal.current} target={goal.target} label={goal.label} />
          </div>
          <div className="absolute bottom-10 right-10">
            <EventList events={events} />
          </div>
        </>
      )}

      {/* Fallback if scene is unknown */}
      {!['in-game', 'just-talking'].includes(scene) && (
        <div className="flex items-center justify-center h-full">
           <div className="bg-black/80 border-4 border-red-600 p-8 text-center shadow-[10px_10px_0px_0px_rgba(255,0,0,0.5)]">
             <h1 className="text-4xl font-black uppercase italic mb-2">Unknown Scene</h1>
             <p className="font-bold">Please specify /overlays/in-game or /overlays/just-talking</p>
           </div>
        </div>
      )}
    </main>
  );
}
