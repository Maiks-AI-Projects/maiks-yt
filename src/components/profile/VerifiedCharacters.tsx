import VerificationBadge from "./VerificationBadge";
import Link from "next/link";

interface GameVerification {
  id: string;
  platform: string;
  externalId: string;
  verified: boolean;
  badges: any;
}

interface VerifiedCharactersProps {
  verifications: GameVerification[];
}

/**
 * VerifiedCharacters component
 * Lists all game accounts with their respective verification status and badges.
 */
export default function VerifiedCharacters({ verifications }: VerifiedCharactersProps) {
  return (
    <section className="mt-16 border-t-8 border-white/5 pt-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="space-y-2">
          <div className="w-12 h-2 bg-white mb-4" />
          <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">
            Digital Identity<span className="text-zinc-500">.</span>
          </h3>
          <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">
            Cross-platform game account verification
          </p>
        </div>
        
        <Link 
          href="/profile/verify"
          className="px-8 py-4 bg-zinc-900 text-white border-4 border-white/10 font-black rounded-2xl hover:bg-white hover:text-black transition-all transform hover:scale-105 active:scale-95 text-xs uppercase tracking-widest text-center"
        >
          Link New Game Account
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {verifications.length === 0 ? (
          <div className="col-span-full p-20 border-8 border-dashed border-zinc-900 rounded-[3rem] text-zinc-700 text-center flex flex-col items-center justify-center gap-4">
            <div className="text-6xl">🔒</div>
            <div className="font-black uppercase tracking-widest text-xl">No characters linked</div>
            <p className="max-w-xs text-sm font-bold text-zinc-800">Verify your Minecraft or HyTale account to display your prestige status.</p>
          </div>
        ) : (
          verifications.map((v) => {
            // Safely parse badges JSON
            const badges = typeof v.badges === 'string' ? JSON.parse(v.badges) : v.badges;
            const characterName = badges?.name || "Player";
            const tier = badges?.tier || "Bronze";

            return (
              <div 
                key={v.id} 
                className="group p-10 bg-zinc-950 border-8 border-white/5 rounded-[3rem] flex flex-col justify-between hover:border-white/10 transition-all duration-300"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="px-4 py-1.5 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                      {v.platform}
                    </span>
                    <VerificationBadge verified={v.verified} tier={tier} />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-4xl font-black uppercase tracking-tighter truncate group-hover:text-primary transition-colors">
                      {characterName}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-700 break-all opacity-50">
                      UUID: {v.externalId}
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex gap-4">
                  <button className="flex-1 py-4 bg-white/5 text-zinc-400 font-black rounded-2xl hover:bg-white/10 hover:text-white transition-all text-[10px] uppercase tracking-widest border border-white/5">
                    View Stats
                  </button>
                  <button className="flex-1 py-4 bg-white/5 text-zinc-400 font-black rounded-2xl hover:bg-white/10 hover:text-white transition-all text-[10px] uppercase tracking-widest border border-white/5">
                    Re-Sync
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
