import React, { useState } from 'react';
import { Info, ArrowLeft, Globe, Zap, Shield, Sparkles, BookOpen, MessageSquare, Award, HelpCircle, CheckCircle2, ChevronDown, Rocket, Users, Heart } from 'lucide-react';
import { Meteors } from './Meteors';

export default function AboutView({ onBack, onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="w-full min-h-[100dvh] bg-[#090A0F] relative overflow-x-hidden text-white flex flex-col items-center">
      {/* Background Meteors Shimmer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <Meteors number={15} />
      </div>

      <div className="w-full max-w-[900px] mx-auto py-10 px-5 sm:px-8 relative z-20">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-[#888A92] hover:text-white transition-colors group"
        >
          <div className="bg-[#12141C] p-2 rounded-xl group-hover:bg-[#1A1D27] transition-colors border border-[#1E212B]">
            <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2} />
          </div>
          <span className="font-bold tracking-[0.15em] text-[11px] uppercase">Back</span>
        </button>

        {/* Hero Header */}
        <div className="flex flex-col items-start mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A1D27] border border-[#2A2E3B] mb-5 shadow-sm">
            <Info className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#3B82F6]">About solith.in</span>
          </div>
          <h1 className="text-[36px] sm:text-[48px] font-extrabold text-white tracking-tight leading-tight mb-3">
            Master Languages Through Live Voice Conversations
          </h1>
          <p className="text-[#888A92] font-medium text-[16px] sm:text-[18px] max-w-2xl leading-relaxed">
            The free, global audio platform connecting language learners worldwide for real-world speaking practice with zero barriers.
          </p>
        </div>
      </div>
    </div>
  );
}
