import Link from "next/link";
import { auth, getSignInUrl, getSignUpUrl, signOut } from "@workos-inc/authkit-nextjs";

export default async function Navigation() {
  const { user } = await auth();
  const signInUrl = await getSignInUrl();
  const signUpUrl = await getSignUpUrl();

  return (
    <nav className="flex items-center justify-between px-8 py-6 bg-black/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-3xl font-black tracking-tighter text-white hover:text-primary transition-colors">
          MAIKS.YT
        </Link>
      </div>
      
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-6">
            <span className="text-zinc-400 hidden sm:inline font-bold uppercase text-xs tracking-widest">
              User: <span className="text-white">{user.firstName || user.email}</span>
            </span>
            <Link 
              href="https://dev.maiks.yt/profile" 
              className="px-6 py-3 bg-white text-black font-black rounded-full hover:bg-primary hover:text-white transition-all transform hover:scale-105 active:scale-95 text-xs uppercase tracking-widest shadow-xl shadow-white/5"
            >
              Main Profile
            </Link>
            <form action={async () => {
              'use server';
              await signOut();
            }}>
              <button className="text-zinc-500 hover:text-red-500 font-bold uppercase text-[10px] tracking-widest transition-colors">
                Sign Out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link 
              href={signInUrl} 
              className="text-white font-bold hover:text-primary transition-colors uppercase text-xs tracking-widest"
            >
              Sign In
            </Link>
            <Link 
              href={signUpUrl} 
              className="px-6 py-3 bg-white text-black font-black rounded-full hover:bg-primary hover:text-white transition-all transform hover:scale-105 active:scale-95 text-xs uppercase tracking-widest"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
