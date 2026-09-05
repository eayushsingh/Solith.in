import React from 'react';
import { Crown } from 'lucide-react';

export default function PremiumBadge({ className = "", showText = true }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.15)] group relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
      <Crown className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)] group-hover:animate-pulse" />
      {showText && (
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 drop-shadow-sm group-hover:text-amber-300 transition-colors">
          VIP
        </span>
      )}
    </div>
  );
}
