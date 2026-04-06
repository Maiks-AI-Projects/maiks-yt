import { SUBDOMAINS } from "@/lib/subdomains";
import { notFound } from "next/navigation";
import ServerStatus from "@/components/minecraft/ServerStatus";
import BlueprintGallery from "@/components/shared/BlueprintGallery";
import { Suspense } from "react";

interface SubdomainPageProps {
  params: Promise<{
    subdomain: string;
  }>;
}

const GALLERY_LABELS: Record<string, string> = {
  mc: "Minecraft Schematics",
  sf: "Satisfactory Blueprints",
  "3dp": "3D Print Designs",
  electronics: "Circuit Blueprints",
  coding: "Code Snippets",
};

const PLACEHOLDER_ITEMS = [
  {
    title: "Standard Prototype v1",
    description: "A robust foundational design optimized for resource efficiency and structural durability in complex environments.",
    link: "#",
    linkText: "Download_Archive"
  },
  {
    title: "Advanced Module X-2",
    description: "Features high-density component integration and enhanced throughput for large-scale industrial applications.",
    link: "#",
    linkText: "View_Schematic"
  },
  {
    title: "Experimental Core Revision",
    description: "The latest iteration of our core system, implementing several key optimizations discovered during field testing.",
    link: "#",
    linkText: "Access_Source"
  }
];

const CODING_ITEMS = [
  {
    title: "Next.js Middleware Auth",
    description: "Robust authentication middleware for Next.js 15, handling subdomain routing and session validation.",
    link: "#",
    language: "typescript",
    code: `export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host");
  const subdomain = getSubdomain(hostname);

  if (subdomain) {
    return NextResponse.rewrite(
      new URL(\`/\${subdomain}\${url.pathname}\`, request.url)
    );
  }
}`
  },
  {
    title: "Tailwind Component Factory",
    description: "A utility function to generate reusable Tailwind CSS components with dynamic variants.",
    link: "#",
    language: "typescript",
    code: `import { cva, type VariantProps } from "class-variance-authority";

export const button = cva("font-black uppercase tracking-widest", {
  variants: {
    intent: {
      primary: "bg-primary text-black hover:bg-white",
      secondary: "bg-zinc-800 text-white",
    },
    size: {
      lg: "px-8 py-4 text-xl",
      md: "px-6 py-3 text-sm",
    }
  }
});`
  },
  {
    title: "Prisma Stream Hook",
    description: "Custom React hook for handling real-time data streaming from Prisma ORM via Server-Sent Events.",
    link: "#",
    language: "typescript",
    code: `export function usePrismaStream<T>(url: string) {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setData(prev => [...prev, payload]);
    };
    return () => eventSource.close();
  }, [url]);

  return data;
}`
  }
];

/**
 * Basic landing page for hobby subdomains.
 * This route is reached via middleware rewrite (e.g., mc.maiks.yt -> /mc)
 * or by direct navigation (e.g., maiks.yt/mc).
 */
export default async function SubdomainPage({ params }: SubdomainPageProps) {
  const { subdomain } = await params;
  const metadata = SUBDOMAINS[subdomain];

  if (!metadata) {
    return notFound();
  }

  const showGallery = Object.keys(GALLERY_LABELS).includes(subdomain);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 py-12">
      <h1 
        className="text-5xl font-extrabold tracking-tight sm:text-6xl mb-4 text-primary"
      >
        {metadata.title}
      </h1>
      <p className="text-xl text-gray-400 max-w-2xl mb-8">
        Welcome to the {subdomain} channel. This experience is uniquely tailored 
        to our hobby community.
      </p>
      
      {subdomain === "mc" && (
        <div className="w-full max-w-4xl flex flex-col items-center gap-12 mb-20">
          <Suspense fallback={
            <div className="bg-black/80 border-4 border-dashed border-zinc-700 p-8 rounded-none w-full max-w-2xl h-80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-zinc-700 border-t-[#FFAA00] animate-spin rounded-full" />
                <span className="text-zinc-600 font-mono font-black uppercase tracking-[0.4em]">Establishing_Uplink...</span>
              </div>
            </div>
          }>
            <ServerStatus host="mc.hypixel.net" />
          </Suspense>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl">
            <div className="p-6 bg-zinc-900 border-2 border-zinc-800 text-left hover:border-[#FFAA00] transition-colors group cursor-pointer">
              <h4 className="text-[#FFAA00] font-black uppercase text-xs mb-3 tracking-widest group-hover:underline">Join Tutorial</h4>
              <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                Step-by-step instructions on how to access our dedicated survival realm and the community whitelist.
              </p>
            </div>
            <div className="p-6 bg-zinc-900 border-2 border-zinc-800 text-left hover:border-[#55FF55] transition-colors group cursor-pointer">
              <h4 className="text-[#55FF55] font-black uppercase text-xs mb-3 tracking-widest group-hover:underline">Visual Packs</h4>
              <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                Optimize your visuals with our recommended resource packs, including custom items and skybox assets.
              </p>
            </div>
            <div className="p-6 bg-zinc-900 border-2 border-zinc-800 text-left hover:border-accent transition-colors group cursor-pointer">
              <h4 className="text-accent font-black uppercase text-xs mb-3 tracking-widest group-hover:underline">Live Feed</h4>
              <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                Follow our community build progress via real-time Dynmap integration and weekly cinematic highlights.
              </p>
            </div>
          </div>
        </div>
      )}

      {showGallery ? (
        <div className="w-full">
          <BlueprintGallery 
            title={GALLERY_LABELS[subdomain]} 
            items={subdomain === 'coding' ? CODING_ITEMS : PLACEHOLDER_ITEMS} 
            subdomain={subdomain}
          />
        </div>
      ) : (
        subdomain !== "mc" && (
          <div className="flex flex-col items-center gap-8">
            <div 
              className="px-12 py-10 bg-accent/5 border-2 border-dashed border-accent/20 rounded-none max-w-lg"
            >
              <h3 className="text-3xl font-black text-accent mb-4 italic tracking-tighter uppercase underline decoration-4 underline-offset-8 decoration-accent/30">
                Module: Offline
              </h3>
              <p className="text-gray-400 font-medium leading-relaxed mb-6">
                The <span className="text-accent font-black">{subdomain}</span> operations module is currently in development. 
                Our engineers are configuring the dynamic skinning protocols for this channel.
              </p>
              <div className="flex items-center gap-2 text-xs font-black text-accent/50 uppercase tracking-[0.2em] justify-center">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Deployment Pending
              </div>
            </div>
            
            <div className="mt-8 flex flex-col items-center">
              <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary/60 mb-6">
                Palette_Reference
              </h2>
              <div className="flex gap-6">
                <div className="group flex flex-col items-center">
                  <div className="w-14 h-14 rounded-none bg-primary shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)] mb-3 border-2 border-primary/20 transition-all group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none" />
                  <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Pri</span>
                </div>
                <div className="group flex flex-col items-center">
                  <div className="w-14 h-14 rounded-none bg-secondary shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)] mb-3 border-2 border-secondary/20 transition-all group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none" />
                  <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Sec</span>
                </div>
                <div className="group flex flex-col items-center">
                  <div className="w-14 h-14 rounded-none bg-accent shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)] mb-3 border-2 border-accent/20 transition-all group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none" />
                  <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Acc</span>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
