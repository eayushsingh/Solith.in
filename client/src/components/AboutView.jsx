import React, { useState } from 'react';
import { Info, ArrowLeft, Globe, Zap, Shield, Sparkles, BookOpen, MessageSquare, Award, HelpCircle, CheckCircle2, ChevronDown, Rocket, Users, Heart, Search } from 'lucide-react';
import { Meteors } from './Meteors';
import { ABOUT_FAQS, filterFaqsByQuery } from '../utils/aboutData';

export default function AboutView({ onBack, onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [faqSearch, setFaqSearch] = useState('');

  const logAboutViewed = (section) => {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Telemetry][About] Section viewed: ${section}`);
      }
    } catch (e) {}
  };

  const faqs = filterFaqsByQuery(ABOUT_FAQS, faqSearch);

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

        {/* Feature Showcase Section */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-[22px] font-bold text-white tracking-tight">Platform Features Showcase</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-5 flex flex-col items-start">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-3 text-blue-400">
                <Globe className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-[15px] mb-1">Global Voice Rooms</h4>
              <p className="text-[#888A92] text-[13px]">Real-time WebRTC audio rooms with low-latency communication.</p>
            </div>

            <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-5 flex flex-col items-start">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-3 text-purple-400">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-[15px] mb-1">AI Conversation Prompts</h4>
              <p className="text-[#888A92] text-[13px]">Smart AI topic suggestions and discussion starters built right into voice rooms.</p>
            </div>

            <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-5 flex flex-col items-start">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-3 text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-[15px] mb-1">Gamified Hall of Fame</h4>
              <p className="text-[#888A92] text-[13px]">Track active minutes spoken and win monthly Premium Subscriptions.</p>
            </div>
          </div>
        </div>

        {/* Language Learner Speaking Guide */}
        <div className="mb-12 bg-gradient-to-r from-[#12141C] via-[#0C0E14] to-[#12141C] border border-[#1E212B] rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-purple-400" />
            <h2 className="text-[20px] font-bold text-white tracking-tight">Speaking Tips for Learners</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
              <p className="text-[#888A92]"><strong className="text-white">Don't Fear Mistakes:</strong> Native speakers appreciate effort. Stumbling is a natural part of fluency growth!</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
              <p className="text-[#888A92]"><strong className="text-white">Ask Open Questions:</strong> Ask your speaking partners about their culture, daily routine, or favorite movies.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
              <p className="text-[#888A92]"><strong className="text-white">Use AI Prompts:</strong> Stuck on topics? Use the built-in AI assistant prompts in voice rooms to spark ideas.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
              <p className="text-[#888A92]"><strong className="text-white">Practice Daily:</strong> Even 15 minutes of speaking every day creates rapid fluency gains over time.</p>
            </div>
          </div>
        </div>

        {/* FAQ Accordion Section */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="text-[22px] font-bold text-white tracking-tight">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-[#12141C] transition-colors"
                >
                  <span className="font-bold text-white text-[15px]">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#888A92] transition-transform ${openFaqIndex === idx ? 'rotate-180 text-[#3B82F6]' : ''}`} />
                </button>
                {openFaqIndex === idx && (
                  <div className="px-5 pb-5 text-[#888A92] text-[14px] leading-relaxed border-t border-[#1E212B]/50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Community Safety Pledge Section */}
        <div className="mb-12 bg-[#12141C] border border-[#2A2E3B] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-white font-bold text-[18px] mb-1">Our Community Safety Commitment</h3>
            <p className="text-[#888A92] text-[14px] leading-relaxed">
              We enforce strict zero-tolerance policies against harassment, hate speech, and spam. Our real-time report tools and active moderation system ensure every learner feels safe and respected.
            </p>
          </div>
        </div>

        {/* Tech Stack & Architecture Section */}
        <div className="mb-12 border-t border-[#1E212B] pt-10">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-blue-400" />
            <h2 className="text-[20px] font-bold text-white tracking-tight">Built For Low-Latency Audio</h2>
          </div>
          <p className="text-[#888A92] text-[14px] leading-relaxed mb-6">
            solith.in is powered by modern real-time WebRTC media servers (LiveKit), WebSockets, React 18, and Firebase Firestore to guarantee sub-100ms audio latency globally.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-[#12141C] border border-[#1E212B] text-[12px] font-mono text-[#888A92]">WebRTC Media Streaming</span>
            <span className="px-3 py-1 rounded-full bg-[#12141C] border border-[#1E212B] text-[12px] font-mono text-[#888A92]">React 18 + Vite</span>
            <span className="px-3 py-1 rounded-full bg-[#12141C] border border-[#1E212B] text-[12px] font-mono text-[#888A92]">Node.js + Express</span>
            <span className="px-3 py-1 rounded-full bg-[#12141C] border border-[#1E212B] text-[12px] font-mono text-[#888A92]">Firebase Firestore</span>
            <span className="px-3 py-1 rounded-full bg-[#12141C] border border-[#1E212B] text-[12px] font-mono text-[#888A92]">Socket.io Realtime Sync</span>
          </div>
        </div>

        {/* Quick-Start CTA Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl text-center sm:text-left">
          <div>
            <h3 className="text-white text-[22px] font-extrabold mb-1">Ready to Practice Speaking?</h3>
            <p className="text-blue-100 text-[14px]">Join thousands of active speakers in live WebRTC voice rooms today.</p>
          </div>
          <button
            onClick={() => {
              if (typeof onNavigate === 'function') onNavigate('lobby');
              else if (typeof onBack === 'function') onBack();
            }}
            className="px-6 py-3 rounded-xl bg-white text-blue-900 font-extrabold text-[14px] hover:bg-blue-50 transition-colors shadow-lg shrink-0 flex items-center gap-2"
          >
            <Rocket className="w-4 h-4" /> Start Speaking Now
          </button>
        </div>
      </div>
    </div>
  );
}
