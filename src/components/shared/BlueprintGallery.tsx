import React from 'react';
import CodeBlock from './CodeBlock';

/**
 * BlueprintGallery Component
 * A high-contrast, bold "Living Room Dashboard" style component 
 * for displaying a grid of blueprints, schematics, or snippets.
 */

interface BlueprintItem {
  title: string;
  description: string;
  image?: string;
  link: string;
  linkText?: string;
  code?: string;
  language?: string;
}

interface BlueprintGalleryProps {
  title: string;
  items: BlueprintItem[];
  subdomain?: string;
}

const BlueprintGallery: React.FC<BlueprintGalleryProps> = ({ title, items, subdomain }) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-16">
      {/* Bold Header Section */}
      <div className="flex flex-col mb-16 relative">
        <span className="text-primary font-black uppercase text-sm tracking-[0.5em] mb-2 px-2 border-l-4 border-primary">
          Archives_Module
        </span>
        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white leading-none">
          {title}
        </h2>
        <div className="h-1 w-24 bg-primary mt-6" />
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {items.map((item, index) => (
          <div 
            key={index} 
            className="group relative flex flex-col h-full bg-zinc-900 border-[6px] border-zinc-800 hover:border-primary transition-all duration-300 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.4)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 cursor-pointer"
          >
            {/* Index Badge */}
            <div className="absolute -top-4 -left-4 bg-zinc-800 border-4 border-zinc-900 text-primary font-black px-4 py-2 z-20 group-hover:bg-primary group-hover:text-black transition-colors">
              0{index + 1}
            </div>

            {/* Image / Code / Placeholder Area */}
            <div className="aspect-[16/10] bg-zinc-950 border-b-[6px] border-zinc-800 overflow-hidden relative">
              {subdomain === 'coding' && item.code ? (
                <div className="w-full h-full p-4 overflow-hidden">
                  <div className="scale-75 origin-top-left w-[133.33%] h-[133.33%] pointer-events-none grayscale group-hover:grayscale-0 transition-all">
                    <CodeBlock 
                      code={item.code} 
                      language={item.language || 'typescript'} 
                      className="h-full border-[2px] shadow-none"
                    />
                  </div>
                </div>
              ) : item.image ? (
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8">
                  <div className="w-full h-full border-4 border-dashed border-zinc-800 group-hover:border-primary/30 flex items-center justify-center transition-colors">
                    <span className="text-zinc-800 group-hover:text-primary/10 font-black text-4xl uppercase -rotate-12 transition-colors">
                      {subdomain === 'coding' ? 'Snippet' : 'Blueprint'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="bg-black text-white px-6 py-2 font-black uppercase tracking-widest translate-y-4 group-hover:translate-y-0 transition-transform">
                  Access_Entry
                </span>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-10 flex flex-col flex-grow">
              <h3 className="text-3xl font-black uppercase mb-6 text-white group-hover:text-primary transition-colors leading-tight">
                {item.title}
              </h3>
              
              <p className="text-zinc-500 font-bold leading-relaxed mb-12 flex-grow text-lg">
                {item.description}
              </p>
              
              <a 
                href={item.link}
                className="mt-auto inline-flex items-center justify-center w-full bg-zinc-800 text-white font-black uppercase py-6 text-xl tracking-widest hover:bg-primary hover:text-black transition-all active:scale-95"
              >
                {item.linkText || (subdomain === 'coding' ? 'View_Source' : 'Download_Archive')}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlueprintGallery;
