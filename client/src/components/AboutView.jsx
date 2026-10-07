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

        {/* Guided Walkthrough Steps Section */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Rocket className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-[22px] font-bold text-white tracking-tight">How solith.in Works — Step-by-Step</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-6 relative overflow-hidden group hover:border-[#3B82F6]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6] font-bold text-sm mb-4">
                01
              </div>
              <h3 className="text-white font-bold text-[17px] mb-2">Explore & Filter Live Rooms</h3>
              <p className="text-[#888A92] text-[14px] leading-relaxed">
                Browse open voice rooms filtered by practice language (English, Spanish, French, Hindi, German, Japanese) and level (Beginner to Fluent).
              </p>
            </div>

            <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-6 relative overflow-hidden group hover:border-[#3B82F6]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6] font-bold text-sm mb-4">
                02
              </div>
              <h3 className="text-white font-bold text-[17px] mb-2">Join or Host Voice Rooms</h3>
              <p className="text-[#888A92] text-[14px] leading-relaxed">
                Click to enter any room instantly with WebRTC low-latency audio. Or create your own room with custom topics and speaker limits.
              </p>
            </div>

            <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-6 relative overflow-hidden group hover:border-[#3B82F6]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6] font-bold text-sm mb-4">
                03
              </div>
              <h3 className="text-white font-bold text-[17px] mb-2">Earn XP & Maintain Streaks</h3>
              <p className="text-[#888A92] text-[14px] leading-relaxed">
                Gain XP points for every minute you speak. Build daily streaks and compete on the global Hall of Fame leaderboard.
              </p>
            </div>

            <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-6 relative overflow-hidden group hover:border-[#3B82F6]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6] font-bold text-sm mb-4">
                04
              </div>
              <h3 className="text-white font-bold text-[17px] mb-2">Connect & Direct Message</h3>
              <p className="text-[#888A92] text-[14px] leading-relaxed">
                Follow your favorite speaking partners, view their achievements, and exchange 1-on-1 direct messages to build lasting friendships.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
