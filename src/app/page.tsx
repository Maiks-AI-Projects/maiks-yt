import Navigation from "@/components/Navigation";
import { SUBDOMAINS } from "@/lib/subdomains";
import Link from "next/link";

/**
 * Main landing page for Maiks.yt.
 * Displays all hobby subdomains as high-contrast "Living Room Dashboard" style cards.
 */
export default function HomePage() {
  const subdomains = Object.entries(SUBDOMAINS);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans">
      {/* Ensure Navigation component is used */}
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <header className="mb-24 space-y-6">
          <div className="w-24 h-4 bg-white mb-8" />
          <h1 className="text-7xl md:text-[10rem] font-black tracking-tighter leading-[0.85] uppercase">
            Maiks<span className="text-zinc-500">.</span><br />
            Universe
          </h1>
          <p className="text-2xl md:text-4xl text-zinc-400 max-w-4xl font-bold tracking-tight leading-tight">
            A hyper-focused ecosystem of gaming, technology, and niche hobbies.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {subdomains.map(([key, metadata]) => (
            <div 
              key={key} 
              className={`group relative p-10 rounded-[3rem] border-8 border-white/5 bg-zinc-900/40 hover:bg-zinc-900 hover:border-white/10 transition-all duration-500 flex flex-col justify-between theme-${key}`}
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
                  <span className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">
                    {key}.dev.maiks.yt
                  </span>
                </div>
                
                <h2 className="text-5xl font-black tracking-tighter leading-none group-hover:text-primary transition-colors uppercase break-words">
                  {metadata.title}
                </h2>
              </div>
              
              <div className="mt-16">
                <Link 
                  href={`https://${key}.dev.maiks.yt`}
                  className="inline-block w-full py-6 px-8 bg-white text-black text-center font-black rounded-3xl hover:bg-primary hover:text-white transition-all transform group-hover:scale-[1.05] active:scale-95 uppercase tracking-tighter text-xl shadow-2xl shadow-black"
                >
                  Visit Channel
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
      
      <footer className="py-32 border-t-8 border-white/5 text-center px-6">
        <div className="text-zinc-700 font-black tracking-[0.5em] uppercase text-xs mb-8">
          Established 2024 / Maiks.yt Global Network
        </div>
        <div className="text-zinc-800 font-black text-8xl md:text-[15rem] leading-none opacity-20 pointer-events-none select-none">
          MAIKS
        </div>
      </footer>
    </div>
  );
}
