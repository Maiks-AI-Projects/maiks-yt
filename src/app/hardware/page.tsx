import React from 'react';
import Navigation from '@/components/Navigation';
import HardwareTransparency from '@/components/hardware/HardwareTransparency';
import { prisma } from '@/lib/prisma';

export default async function HardwarePage() {
  // Fetch actual data from DB
  const parts = await prisma.projectPart.findMany({
    orderBy: { price: 'desc' },
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono selection:bg-indigo-600 selection:text-white">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-6 py-20">
        <header className="mb-20 space-y-6">
          <div className="w-32 h-6 bg-indigo-600 mb-8" />
          <h1 className="text-8xl md:text-[12rem] font-black uppercase tracking-tighter leading-[0.8]">
            Hardware <br />
            <span className="text-indigo-600">Transparency</span>
          </h1>
          <p className="text-3xl font-black max-w-4xl tracking-tight leading-none text-zinc-500 uppercase">
            Full visibility into the physical components powering our projects. 
            Help us bridge the gap between digital vision and physical reality.
          </p>
        </header>

        <section className="mb-32">
          <HardwareTransparency parts={parts} />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-16 border-t-8 border-white/5 pt-20 pb-32">
          <div>
            <h2 className="text-5xl font-black uppercase mb-8 italic underline decoration-indigo-600 decoration-8">Why Hardware?</h2>
            <p className="text-xl text-zinc-400 font-bold leading-relaxed mb-6">
              Our projects often require specialized hardware – from edge computing nodes for local AI inference to high-fidelity audio interfaces for immersive experiences.
            </p>
            <p className="text-xl text-zinc-400 font-bold leading-relaxed">
              By listing every part, we ensure that every contribution goes directly to the physical tools needed to move the mission forward. No hidden costs. No fluff. Just copper, silicon, and steel.
            </p>
          </div>
          <div className="bg-indigo-600/10 p-12 border-4 border-indigo-600/30">
            <h2 className="text-5xl font-black uppercase mb-8 italic">Verification</h2>
            <p className="text-xl text-zinc-400 font-bold leading-relaxed mb-8">
              Once a part is fully funded, the receipt and a photo of the installed component are linked directly to the ledger entry for that project.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 text-2xl font-black uppercase">
                <div className="w-8 h-8 bg-green-500 rounded-full" />
                <span>Verified Purchase</span>
              </div>
              <div className="flex items-center gap-4 text-2xl font-black uppercase opacity-50">
                <div className="w-8 h-8 bg-zinc-800 rounded-full" />
                <span>Installation Pending</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-20 bg-indigo-900/20 border-t-8 border-indigo-600 text-center">
        <div className="text-4xl font-black italic tracking-tighter uppercase mb-2">
          Building the Future, One Part at a Time
        </div>
        <div className="text-zinc-600 font-bold uppercase tracking-[0.3em]">
          Maiks.yt Hardware Initiative // 2024
        </div>
      </footer>
    </div>
  );
}
