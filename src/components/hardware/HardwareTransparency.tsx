import React from 'react';
import { ExternalLink } from 'lucide-react';

interface ProjectPart {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  funded: number | string;
  link: string | null;
}

export default async function HardwareTransparency({ parts }: { parts: ProjectPart[] }) {
  return (
    <div className="w-full bg-slate-900 text-white p-8 font-mono border-[12px] border-indigo-600 shadow-[30px_30px_0px_0px_rgba(79,70,229,1)]">
      <h2 className="text-6xl font-black mb-12 tracking-tight uppercase underline decoration-indigo-600 decoration-[16px]">
        Hardware Roadmap
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {parts.map((part) => {
          const price = Number(part.price);
          const funded = Number(part.funded);
          const percent = Math.min(Math.round((funded / price) * 100), 100);
          
          return (
            <div key={part.id} className="p-8 border-8 border-white bg-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-4xl font-black uppercase leading-none">{part.name}</h3>
                  {part.link && (
                    <a 
                      href={part.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-4 bg-white text-slate-900 border-4 border-indigo-600 hover:bg-indigo-600 hover:text-white transition-all transform active:scale-90"
                    >
                      <ExternalLink size={32} strokeWidth={3} />
                    </a>
                  )}
                </div>
                
                <p className="text-xl italic opacity-70 mb-8 border-l-8 border-indigo-600 pl-4">
                  {part.description || "Mission-critical hardware component."}
                </p>
                
                <div className="flex justify-between items-end mb-4">
                  <span className="text-2xl font-black opacity-50 uppercase">Funding Status</span>
                  <span className="text-5xl font-black text-indigo-400">
                    ${funded.toLocaleString()} / ${price.toLocaleString()}
                  </span>
                </div>
                
                {/* PROGRESS BAR - Dash Style */}
                <div className="h-12 w-full border-4 border-white bg-black relative overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 border-r-4 border-white transition-all duration-1000 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center mix-blend-difference font-black text-3xl">
                    {percent}% FUNDED
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <button className="w-full py-6 bg-green-500 text-black text-3xl font-black uppercase border-8 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">
                  Fund This Part
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {parts.length === 0 && (
        <div className="py-20 text-center text-4xl font-black uppercase opacity-20 border-8 border-dashed border-white/20">
          No hardware requested at this time
        </div>
      )}
    </div>
  );
}
