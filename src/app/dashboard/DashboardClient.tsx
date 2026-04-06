"use client";

import { useEffect, useState } from 'react';
import UnifiedChat from '@/components/dashboard/UnifiedChat';
import { Activity, Bell, MessageSquare, List, Layout, Play, RefreshCw, Users, Settings, Zap } from 'lucide-react';

interface DashboardClientProps {
  user: any;
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeOverlays, setActiveOverlays] = useState({
    AlertBox: true,
    GoalBar: true,
    ChatBox: true,
    EventList: true,
  });

  // Fetch initial sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/events/sessions');
        const data = await res.json();
        setSessions(data);
      } catch (err) {
        console.error("Failed to fetch sessions", err);
      }
    };
    fetchSessions();

    // Listen for session updates via SSE on 'admin' channel
    const eventSource = new EventSource('/api/events?channel=admin');
    
    eventSource.onmessage = (event) => {
      try {
        const appEvent = JSON.parse(event.data);
        if (appEvent.type === 'system') {
          if (appEvent.data.action === 'session_joined') {
            setSessions((prev) => {
               // Avoid duplicates
               if (prev.find(s => s.id === appEvent.data.session.id)) return prev;
               return [...prev, appEvent.data.session];
            });
          } else if (appEvent.data.action === 'session_left') {
            setSessions((prev) => prev.filter((s) => s.id !== appEvent.data.sessionId));
          }
        }
      } catch (e) {
        // SSE heartbeat or junk
      }
    };

    return () => eventSource.close();
  }, []);

  const triggerTestEvent = async (type: string, data: any) => {
    try {
      await fetch('/api/events/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, channel: 'global' }),
      });
    } catch (err) {
      console.error("Failed to trigger event", err);
    }
  };

  const toggleOverlay = async (name: keyof typeof activeOverlays) => {
    const newState = !activeOverlays[name];
    setActiveOverlays(prev => ({ ...prev, [name]: newState }));
    
    // Broadcast toggle event to global channel for overlays
    await triggerTestEvent('system', { 
      action: 'toggle_overlay', 
      overlay: name, 
      enabled: newState 
    });
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans selection:bg-yellow-400 selection:text-black">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b-8 border-white pb-10 space-y-6 md:space-y-0">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Zap className="text-yellow-400 fill-yellow-400" size={48} />
            <h1 className="text-7xl md:text-[9rem] font-black tracking-tighter uppercase leading-[0.8] italic">
              MAIK<span className="text-zinc-800">.</span>OP
            </h1>
          </div>
          <p className="text-2xl md:text-3xl font-black text-zinc-500 tracking-widest uppercase">
            OPERATIONS <span className="text-white">DASHBOARD</span> // V1.0
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-3 bg-zinc-900 border-4 border-white p-6 rounded-3xl shadow-[0_15px_0_rgba(255,255,255,0.1)]">
           <div className="flex items-center gap-4">
             <div className="w-5 h-5 bg-green-500 rounded-full animate-ping" />
             <span className="font-black text-2xl uppercase tracking-tighter">System Online</span>
           </div>
           <div className="text-sm font-bold text-zinc-500 uppercase tracking-[0.2em]">
             Authenticated: {user.firstName || user.email}
           </div>
        </div>
      </header>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-12 gap-10">
        
        {/* SIDEBAR: CONTROLS (COL-4) */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-10">
          
          {/* EVENT SIMULATOR CARD */}
          <section className="bg-zinc-950 border-8 border-white rounded-[3rem] p-10 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Play size={200} fill="white" />
            </div>
            <h2 className="text-5xl font-black uppercase tracking-tighter mb-10 flex items-center gap-4 relative">
              <Activity className="text-yellow-400" size={48} strokeWidth={3} />
              Simulator
            </h2>
            
            <div className="space-y-6 relative">
              <button 
                onClick={() => triggerTestEvent('donation', { amount: 50.00, message: 'BIG HYPE!' })}
                className="w-full py-8 bg-white text-black font-black text-3xl rounded-[1.5rem] hover:bg-yellow-400 transition-all transform hover:scale-[1.02] active:scale-95 uppercase shadow-[0_12px_0_rgb(180,180,180)] active:translate-y-2 active:shadow-none"
              >
                DONATION
              </button>
              
              <button 
                onClick={() => triggerTestEvent('verification', { user: 'NewUser_' + Math.floor(Math.random() * 1000) })}
                className="w-full py-8 bg-zinc-900 text-white font-black text-3xl rounded-[1.5rem] hover:bg-green-600 transition-all transform hover:scale-[1.02] active:scale-95 uppercase border-4 border-white shadow-[0_12px_0_rgba(255,255,255,0.1)]"
              >
                VERIFY
              </button>
              
              <button 
                onClick={() => triggerTestEvent('chat', { author: 'MaikBot', message: 'Welcome to the Universe!', platform: 'youtube' })}
                className="w-full py-8 bg-zinc-900 text-white font-black text-3xl rounded-[1.5rem] hover:bg-blue-600 transition-all transform hover:scale-[1.02] active:scale-95 uppercase border-4 border-white shadow-[0_12px_0_rgba(255,255,255,0.1)]"
              >
                TEST CHAT
              </button>
            </div>
          </section>

          {/* OVERLAY TOGGLES CARD */}
          <section className="bg-zinc-950 border-8 border-white rounded-[3rem] p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
            <h2 className="text-5xl font-black uppercase tracking-tighter mb-10 flex items-center gap-4">
              <Layout className="text-blue-500" size={48} strokeWidth={3} />
              Overlays
            </h2>
            
            <div className="grid grid-cols-1 gap-5">
              {Object.entries(activeOverlays).map(([name, enabled]) => (
                <button 
                  key={name}
                  onClick={() => toggleOverlay(name as any)}
                  className={`relative p-8 font-black text-2xl rounded-[1.5rem] transition-all flex justify-between items-center group overflow-hidden ${
                    enabled ? 'bg-zinc-800 text-white border-4 border-green-500' : 'bg-zinc-900/30 text-zinc-700 border-4 border-zinc-800'
                  }`}
                >
                  <span className="relative z-10">{name.toUpperCase()}</span>
                  <div className={`w-12 h-12 rounded-full relative z-10 flex items-center justify-center ${enabled ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-zinc-800'}`}>
                    <div className={`w-4 h-4 rounded-full ${enabled ? 'bg-white animate-pulse' : 'bg-black'}`} />
                  </div>
                  {enabled && (
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent opacity-50" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* ACTIVE CLIENTS CARD */}
          <section className="bg-white text-black border-8 border-white rounded-[3rem] p-10">
            <h2 className="text-5xl font-black uppercase tracking-tighter mb-8 flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <Users className="text-black" size={48} strokeWidth={3} />
                 Clients
               </div>
               <span className="bg-black text-white px-6 py-2 rounded-full text-2xl">{sessions.length}</span>
            </h2>
            
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-4 scrollbar-custom">
              {sessions.length === 0 ? (
                <div className="text-zinc-400 italic font-black text-2xl py-10 text-center uppercase border-4 border-dashed border-zinc-200 rounded-3xl">
                  Awaiting Connections...
                </div>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="p-6 bg-zinc-100 border-4 border-black rounded-[1.5rem] hover:bg-black hover:text-white transition-all group">
                    <div className="font-black text-xl uppercase mb-1 flex justify-between">
                        <span className="truncate w-32">{s.id.split('-')[0]}...</span>
                        <span className="text-sm font-bold opacity-50">{new Date(s.connectedAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-sm font-black text-zinc-500 group-hover:text-yellow-400 uppercase tracking-widest flex items-center gap-2">
                       <RefreshCw size={14} className="animate-spin-slow" />
                       Channel: {s.channel}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* MAIN AREA: UNIFIED CHAT (COL-8) */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 h-[calc(100vh-280px)] min-h-[800px]">
          <UnifiedChat />
        </div>
        
      </div>

      {/* FOOTER */}
      <footer className="mt-20 pt-10 border-t-8 border-white/10 flex justify-between items-center text-zinc-500 font-black uppercase text-sm tracking-[0.5em]">
         <div>MAIKS.YT NETWORK // STREAM OPERATIONS</div>
         <div className="flex gap-10">
            <span className="text-zinc-800">EST 2024</span>
            <span className="text-zinc-800">NULL_PTR PROTECTION ACTIVE</span>
         </div>
      </footer>
    </div>
  );
}
