import React from 'react';
import Navigation from '@/components/Navigation';
import PublicLedger from '@/components/ledger/PublicLedger';
import { prisma } from '@/lib/prisma';
import { DonationService } from '@/lib/services/DonationService';

export default async function LedgerPage() {
  // Fetch actual data from DB
  const entries = await prisma.ledger.findMany({
    orderBy: { timestamp: 'desc' },
  });

  const report = await DonationService.getIncomeExpenseReport();

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono selection:bg-white selection:text-black">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-6 py-20">
        <header className="mb-16">
          <h1 className="text-8xl font-black uppercase tracking-tighter italic mb-4">Financial Transparency</h1>
          <p className="text-2xl text-zinc-400 font-bold max-w-3xl border-l-8 border-white pl-6">
            Real-time tracking of all income and expenses across the Maiks.yt ecosystem.
          </p>
        </header>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="p-8 bg-green-600 text-black border-8 border-white shadow-[15px_15px_0px_0px_rgba(255,255,255,1)]">
            <span className="text-xl font-black uppercase opacity-60">Total Income</span>
            <div className="text-6xl font-black leading-none mt-2">
              ${report.totals.income.toLocaleString()}
            </div>
          </div>
          <div className="p-8 bg-red-600 text-white border-8 border-white shadow-[15px_15px_0px_0px_rgba(255,255,255,1)]">
            <span className="text-xl font-black uppercase opacity-60">Total Expense</span>
            <div className="text-6xl font-black leading-none mt-2">
              ${report.totals.expense.toLocaleString()}
            </div>
          </div>
          <div className="p-8 bg-white text-black border-8 border-zinc-800 shadow-[15px_15px_0px_0px_rgba(255,255,255,0.2)]">
            <span className="text-xl font-black uppercase opacity-60">Current Balance</span>
            <div className="text-6xl font-black leading-none mt-2">
              ${report.totals.balance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* CATEGORY BREAKDOWN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {Object.entries(report.categories).map(([name, stats]) => (
            <div key={name} className="p-6 border-4 border-white/20 bg-zinc-900">
              <h3 className="text-2xl font-black uppercase mb-4 border-b-4 border-white/10 pb-2">{name}</h3>
              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="opacity-50 uppercase text-xs">In</span>
                  <span className="text-green-400">+${stats.income.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="opacity-50 uppercase text-xs">Out</span>
                  <span className="text-red-400">-${stats.expense.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xl font-black pt-2 border-t border-white/10">
                  <span className="uppercase text-xs self-center">Net</span>
                  <span className={stats.balance >= 0 ? 'text-white' : 'text-red-500'}>
                    ${stats.balance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <PublicLedger entries={entries} />
      </main>
    </div>
  );
}
