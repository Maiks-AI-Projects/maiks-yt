import Navigation from "@/components/Navigation";
import { auth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import VerifiedCharacters from "@/components/profile/VerifiedCharacters";
import { updateProfile } from "./actions";

/**
 * Profile Page
 * Displays WorkOS user info, Prisma profile data, and verified game characters.
 * Implements a Server Action form for profile updates.
 */
export default async function ProfilePage() {
  const { user } = await auth();

  // Protect the page - redirect to home if not logged in
  if (!user) {
    redirect("/");
  }

  // Fetch local profile and game verification data from Prisma
  const dbUser = await prisma.user.findUnique({
    where: { workosId: user.id },
    include: {
      profile: true,
      gameVerifications: true,
    },
  });

  const profile = dbUser?.profile;
  const verifications = dbUser?.gameVerifications || [];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-6 py-20 md:py-32">
        {/* Header: WorkOS User Info */}
        <header className="mb-24 space-y-12">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-12">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-primary to-zinc-800 rounded-[3.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              {user.profilePictureUrl ? (
                <img 
                  src={user.profilePictureUrl} 
                  alt={`${user.firstName} ${user.lastName}`} 
                  className="relative w-48 h-48 rounded-[3rem] border-8 border-white/5 bg-zinc-950 shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                />
              ) : (
                <div className="relative w-48 h-48 rounded-[3rem] border-8 border-white/5 bg-zinc-900 flex items-center justify-center text-7xl font-black text-zinc-700">
                  {user.firstName?.charAt(0) || user.email?.charAt(0)}
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="w-16 h-3 bg-white" />
              <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase leading-[0.8]">
                {user.firstName || "Anon"}<br />
                <span className="text-zinc-700">{user.lastName || "User"}</span>
              </h1>
              <div className="flex items-center gap-4">
                <span className="text-zinc-500 font-bold uppercase text-xs tracking-[0.3em] bg-zinc-900 px-4 py-2 rounded-full border border-white/5">
                  {user.email}
                </span>
                <span className="hidden md:inline text-zinc-800 font-bold uppercase text-[10px] tracking-widest">
                  ID: {user.id}
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Main Content: Form and Characters */}
          <div className="lg:col-span-8 space-y-24">
            <div className="space-y-12">
              <div className="flex items-center gap-6">
                <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">
                  Account Details<span className="text-primary">.</span>
                </h2>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              
              <form action={updateProfile} className="space-y-10">
                <div className="grid grid-cols-1 gap-10">
                  <div className="space-y-4">
                    <label htmlFor="username" className="block text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em] ml-2">
                      Universal Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      defaultValue={profile?.username || ""}
                      placeholder="e.g. MAIKS_MASTER"
                      className="w-full bg-zinc-950 border-4 border-white/5 rounded-3xl py-8 px-10 text-2xl font-black focus:outline-none focus:border-white transition-all placeholder:text-zinc-800 text-white uppercase tracking-tighter"
                      required
                    />
                  </div>

                  <div className="space-y-4">
                    <label htmlFor="bio" className="block text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em] ml-2">
                      User Bio / Narrative
                    </label>
                    <textarea
                      id="bio"
                      name="bio"
                      defaultValue={profile?.bio || ""}
                      placeholder="Write your legacy here..."
                      rows={4}
                      className="w-full bg-zinc-950 border-4 border-white/5 rounded-3xl py-8 px-10 text-xl font-bold focus:outline-none focus:border-white transition-all placeholder:text-zinc-800 text-zinc-300 resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="group relative w-full py-8 bg-white text-black font-black rounded-[2rem] hover:bg-primary hover:text-white transition-all transform hover:scale-[1.01] active:scale-[0.98] text-2xl uppercase tracking-tighter shadow-2xl shadow-black overflow-hidden"
                >
                  <span className="relative z-10">Update Profile Data</span>
                  <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
              </form>
            </div>

            {/* Integrate VerifiedCharacters Component */}
            <VerifiedCharacters verifications={verifications} />
          </div>

          {/* Sidebar: Meta Info */}
          <aside className="lg:col-span-4 space-y-12">
            <div className="p-12 bg-zinc-950 border-8 border-white/5 rounded-[3rem] space-y-8 sticky top-32">
              <div className="space-y-2">
                <div className="w-8 h-1 bg-primary" />
                <h3 className="text-2xl font-black uppercase tracking-tighter">Identity Status</h3>
              </div>
              
              <div className="space-y-6">
                <div className="flex flex-col gap-2 border-b border-white/5 pb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Verification Level</span>
                  <span className="text-xl font-black text-white uppercase tracking-tighter">
                    {verifications.some(v => v.verified) ? 'Elite Member' : 'Initiate'}
                  </span>
                </div>
                
                <div className="flex flex-col gap-2 border-b border-white/5 pb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Legacy Age</span>
                  <span className="text-xl font-black text-white uppercase tracking-tighter">
                    {dbUser ? Math.floor((Date.now() - new Date(dbUser.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0} Days
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Security Clearence</span>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-lg font-black text-green-500 uppercase tracking-tighter">Authorized</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 mt-8 border-t border-white/5">
                <p className="text-[9px] font-bold text-zinc-700 uppercase leading-loose tracking-[0.2em]">
                  Maiks.yt Internal Protocol // User {user.id.slice(-8)}
                </p>
              </div>
            </div>
          </aside>
        </section>
      </main>

      <footer className="py-20 border-t-8 border-white/5 text-center px-6">
        <div className="text-zinc-800 font-black text-6xl md:text-9xl leading-none opacity-10 select-none">
          PROFILE
        </div>
      </footer>
    </div>
  );
}
