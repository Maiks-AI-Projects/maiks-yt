import * as mc from 'minecraft-server-util';

interface ServerStatusProps {
  host?: string;
}

/**
 * ServerStatus Component
 * Fetches and displays the status of a Minecraft server.
 * Uses Server Components for efficient server-side fetching.
 */
export default async function ServerStatus({ host = 'mc.hypixel.net' }: ServerStatusProps) {
  try {
    // Note: status() is an async function that uses TCP/UDP.
    // This must run in a Node.js environment.
    const status = await mc.status(host);
    
    return (
      <div className="bg-black/90 border-4 border-[#555555] p-6 md:p-8 rounded-none shadow-[12px_12px_0px_0px_rgba(0,0,0,0.7)] max-w-2xl w-full font-mono text-left animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b-4 border-[#555555] pb-6">
          <div className="flex flex-col">
            <h3 className="text-4xl font-black text-[#FFAA00] uppercase italic tracking-tighter leading-none mb-1">
              Terminal: Status
            </h3>
            <p className="text-xs text-[#AAAAAA] font-bold uppercase tracking-[0.3em]">
              Real-time Server Telemetry
            </p>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900 px-5 py-3 border-2 border-[#55FF55] shadow-[4px_4px_0px_0px_rgba(85,255,85,0.2)]">
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-[#55FF55] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#55FF55]" />
            </div>
            <span className="text-[#55FF55] font-black text-xl tracking-widest">ONLINE</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <section>
              <p className="text-[#555555] text-xs uppercase font-black mb-2 tracking-widest border-l-2 border-[#555555] pl-2">Network Node</p>
              <p className="text-white text-2xl font-black tracking-tight">{host}</p>
            </section>

            <section>
              <p className="text-[#555555] text-xs uppercase font-black mb-2 tracking-widest border-l-2 border-[#555555] pl-2">Active Entities</p>
              <div className="flex items-end gap-3">
                <span className="text-7xl font-black text-[#55FF55] leading-none tracking-tighter">
                  {status.players.online.toLocaleString()}
                </span>
                <span className="text-[#555555] text-2xl font-black mb-1">
                  / {status.players.max.toLocaleString()}
                </span>
              </div>
            </section>
          </div>

          <div className="flex flex-col h-full">
            <section className="bg-zinc-950 p-6 border-2 border-[#555555] h-full flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-1 bg-[#555555] text-[8px] font-black text-black uppercase">Data_Stream</div>
              <p className="text-[#555555] text-xs uppercase font-black mb-3 tracking-widest">Broadcast Signal</p>
              <div className="text-[#E0E0E0] text-sm leading-relaxed whitespace-pre-wrap italic font-sans flex-grow">
                {status.motd.clean.trim()}
              </div>
            </section>
          </div>
        </div>
        
        <div className="mt-10 pt-6 border-t-2 border-[#555555] grid grid-cols-2 md:grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-[0.25em] text-[#555555]">
          <div className="flex flex-col">
            <span className="mb-1 text-zinc-600">Protocol</span>
            <span className="text-zinc-400">Ver: {status.version.name}</span>
          </div>
          <div className="flex flex-col">
            <span className="mb-1 text-zinc-600">Response</span>
            <span className="text-[#55FF55]">{status.roundTripLatency}ms LATENCY</span>
          </div>
          <div className="flex flex-col col-span-2 md:col-span-1">
            <span className="mb-1 text-zinc-600">Integrity</span>
            <span className="text-zinc-400">STABLE_CONNECTION</span>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Failed to fetch server status:', error);
    return (
      <div className="bg-black/95 border-4 border-[#AA0000] p-8 rounded-none shadow-[12px_12px_0px_0px_rgba(170,0,0,0.3)] max-w-2xl w-full font-mono text-left animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center justify-between mb-8 border-b-4 border-[#AA0000] pb-6">
          <h3 className="text-4xl font-black text-[#FF5555] uppercase italic tracking-tighter leading-none">
            Terminal: Error
          </h3>
          <div className="flex items-center gap-3 bg-red-950/30 px-5 py-3 border-2 border-[#FF5555]">
            <span className="h-4 w-4 rounded-full bg-[#FF5555] shadow-[0_0_10px_#FF5555]" />
            <span className="text-[#FF5555] font-black text-xl tracking-widest">OFFLINE</span>
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-[#FF5555] text-lg font-bold uppercase tracking-widest leading-relaxed">
            CRITICAL_CONNECTION_FAILURE
          </p>
          <p className="text-[#AAAAAA] text-sm font-medium border-l-2 border-red-800 pl-4 py-2">
            The target node <span className="text-white font-bold">{host}</span> refused to respond or is currently unreachable from this relay station. Check DNS or verify server is active.
          </p>
        </div>
      </div>
    );
  }
}
