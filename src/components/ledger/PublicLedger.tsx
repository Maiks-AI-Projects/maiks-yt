import React from 'react';
import { format } from 'date-fns';
import { LedgerType, LedgerCategory } from '@prisma/client';

interface LedgerEntry {
  id: string;
  timestamp: Date;
  type: LedgerType;
  category: LedgerCategory;
  amount: number | string;
  description: string | null;
}

export default async function PublicLedger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="w-full bg-black text-white p-8 font-mono border-8 border-white shadow-[20px_20px_0px_0px_rgba(255,255,255,1)]">
      <h2 className="text-6xl font-black mb-10 tracking-tighter uppercase italic">
        Public Ledger
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-8 border-white">
              <th className="py-6 px-4 text-2xl uppercase font-black">Date</th>
              <th className="py-6 px-4 text-2xl uppercase font-black">Type</th>
              <th className="py-6 px-4 text-2xl uppercase font-black">Category</th>
              <th className="py-6 px-4 text-2xl uppercase font-black">Amount</th>
              <th className="py-6 px-4 text-2xl uppercase font-black">Description</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b-4 border-white/30 hover:bg-white/10 transition-colors">
                <td className="py-6 px-4 text-xl">{format(new Date(entry.timestamp), 'yyyy-MM-dd')}</td>
                <td className="py-6 px-4">
                  <span className={`inline-block px-4 py-2 text-xl font-black rounded-none border-4 ${
                    entry.type === LedgerType.INCOME ? 'bg-green-500 border-white text-black' : 'bg-red-500 border-white text-black'
                  }`}>
                    {entry.type}
                  </span>
                </td>
                <td className="py-6 px-4">
                  <span className="text-xl font-bold uppercase tracking-widest">{entry.category}</span>
                </td>
                <td className={`py-6 px-4 text-3xl font-black ${
                  entry.type === LedgerType.INCOME ? 'text-green-400' : 'text-red-400'
                }`}>
                  {entry.type === LedgerType.INCOME ? '+' : '-'}${Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-6 px-4 text-lg italic opacity-80">{entry.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {entries.length === 0 && (
        <div className="py-20 text-center text-4xl font-black uppercase opacity-20">
          No transactions recorded
        </div>
      )}
    </div>
  );
}
