import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VerificationBadgeProps {
  verified: boolean;
  tier?: 'Bronze' | 'Silver' | 'Gold' | string;
}

/**
 * VerificationBadge component
 * Displays a metallic badge based on verification status and tier.
 */
export default function VerificationBadge({ verified, tier = 'Bronze' }: VerificationBadgeProps) {
  if (!verified) {
    return (
      <span className="px-3 py-1 bg-zinc-900 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-white/5">
        Pending Verification
      </span>
    );
  }

  const gradients: Record<string, string> = {
    Bronze: "from-[#804A00] via-[#CD7F32] to-[#804A00] text-amber-100",
    Silver: "from-[#757575] via-[#C0C0C0] to-[#757575] text-slate-100",
    Gold: "from-[#BF953F] via-[#FCF6BA] via-[#B38728] via-[#FBF5B7] to-[#AA771C] text-[#5C4033] font-black shadow-[0_0_15px_rgba(252,246,186,0.3)]",
  };

  const currentGradient = gradients[tier] || gradients.Bronze;

  return (
    <span className={cn(
      "px-5 py-2 bg-gradient-to-r shadow-2xl font-black uppercase tracking-tighter text-xs rounded-md border border-white/20 inline-flex items-center justify-center min-w-[120px]",
      currentGradient
    )}>
      {tier} VERIFIED
    </span>
  );
}
