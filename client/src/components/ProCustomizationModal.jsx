import React, { useState, useEffect } from 'react';
import { X, Sparkles, Crown, Check, Lock, Loader2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { auth } from '../firebase';

const ANIMATIONS = [
  {
    id: 'none',
    name: 'None',
    description: 'Clean standard border with no extra effects.',
    profileClass: '',
    groupClass: ''
  },
  {
    id: 'neon-gradient',
    name: 'Neon Rotating Gradient',
    description: 'Continuous rotating multi-color conic gradient with subtle neon aura.',
    profileClass: 'pro-anim-neon-gradient',
    groupClass: 'pro-group-card-neon-gradient'
  },
  {
    id: 'pulsing-glow',
    name: 'Pulsing Neon Glow',
    description: 'Soft neon breathing aura that gently pulses in and out.',
    profileClass: 'pro-anim-pulsing-glow',
    groupClass: 'pro-group-card-pulsing-glow'
  },
  {
    id: 'aurora',
    name: 'Aurora Gradient',
    description: 'Organic, flowing multi-color gradient shifting smoothly like the northern lights.',
    profileClass: 'pro-anim-aurora',
    groupClass: 'pro-group-card-aurora'
  },
  {
    id: 'shimmer',
    name: 'Shimmer / Light Sweep',
    description: 'Bright elegant light beam travelling continuously across the border.',
    profileClass: 'pro-anim-shimmer',
    groupClass: 'pro-group-card-shimmer'
  },
  {
    id: 'electric',
    name: 'Electric Glow',
    description: 'Subtle high-voltage cyber neon aura with energetic brightness variations.',
    profileClass: 'pro-anim-electric',
    groupClass: 'pro-group-card-electric'
  }
];

export default function ProCustomizationModal({
  isOpen,
  onClose,
  user,
  isAdmin,
  onUpdateUser,
  onUpgradeClick
}) {
  if (!isOpen) return null;

  const isPro = !!(user?.isPremium || isAdmin);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'group'
  const [selectedProfileAnim, setSelectedProfileAnim] = useState(user?.profileAnimation || 'none');
  const [selectedGroupAnim, setSelectedGroupAnim] = useState(user?.groupAnimation || 'none');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedProfileAnim(user?.profileAnimation || 'none');
      setSelectedGroupAnim(user?.groupAnimation || 'none');
    }
  }, [isOpen, user?.profileAnimation, user?.groupAnimation]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const handleSave = async () => {
    if (!isPro) {
      setErrorMessage("Pro membership is required to save animations.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      let token = user?.token;
      if (!token && auth?.currentUser) {
        try {
          token = await auth.currentUser.getIdToken();
        } catch (e) {
          console.warn("Could not get Firebase ID token:", e);
        }
      }

      const res = await fetch(`${API_URL}/api/users/customization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          profileAnimation: selectedProfileAnim,
          groupAnimation: selectedGroupAnim
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update customization");
      }

      if (onUpdateUser) {
        onUpdateUser({
          profileAnimation: selectedProfileAnim,
          groupAnimation: selectedGroupAnim
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Save customization error:", err);
      setErrorMessage(err.message || "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const avatarUrl = user?.photoUrl || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(user?.id || 'pro_user')}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="w-full max-w-2xl bg-[#101218] border border-white/10 rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-transparent to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Pro Customization</h2>
                <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  VIP EXCLUSIVE
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">Customize your animated profile and group borders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free User Lock Banner */}
        {!isPro && (
          <div className="p-6 bg-gradient-to-b from-amber-500/10 to-transparent border-b border-amber-500/20 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Pro Membership Required</h3>
            <p className="text-sm text-white/60 max-w-md mb-4">
              Unlock high-performance animated glowing borders for your avatar and voice rooms with Solith Pro VIP.
            </p>
            {onUpgradeClick && (
              <button
                onClick={() => {
                  onClose();
                  onUpgradeClick();
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 hover:scale-105 transition-all flex items-center gap-2"
              >
                <Crown className="w-4 h-4" /> Upgrade to Pro
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-4 pb-2 flex gap-3 border-b border-white/5 bg-[#12141C]">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
              activeTab === 'profile'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.1)]'
                : 'bg-white/5 border-transparent text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>👤 Profile Animation</span>
            {selectedProfileAnim !== 'none' && (
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
              activeTab === 'group'
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                : 'bg-white/5 border-transparent text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>🌐 Group Animation</span>
            {selectedGroupAnim !== 'none' && (
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 min-h-[320px]">
          {activeTab === 'profile' ? (
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-amber-400/90">
                  Select Profile Border Animation
                </h3>
                <p className="text-xs text-white/50">
                  Applied to your avatar in profile views, voice participant cards, and chat.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {ANIMATIONS.map(anim => {
                  const isSelected = selectedProfileAnim === anim.id;
                  return (
                    <div
                      key={anim.id}
                      onClick={() => {
                        if (isPro) setSelectedProfileAnim(anim.id);
                      }}
                      className={`relative p-4 rounded-2xl border transition-all duration-200 flex items-center gap-4 ${
                        !isPro ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/50'
                          : 'bg-[#151821] border-white/10 hover:border-white/20 hover:bg-[#1A1D28]'
                      }`}
                    >
                      {/* Live Avatar Preview */}
                      <div className="relative shrink-0">
                        <div className={`w-14 h-14 rounded-full overflow-hidden p-0.5 bg-[#12141C] ${anim.profileClass}`}>
                          <img
                            src={avatarUrl}
                            alt=""
                            className="w-full h-full object-cover rounded-full"
                          />
                        </div>
                      </div>

                      {/* Info & Select */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white truncate">{anim.name}</h4>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <Check className="w-3 h-3 stroke-[3]" /> Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/50 mt-1 line-clamp-2 leading-relaxed">
                          {anim.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400/90">
                  Select Group Card Border Animation
                </h3>
                <p className="text-xs text-white/50">
                  Applied to the voice rooms you create and host on the lobby page.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {ANIMATIONS.map(anim => {
                  const isSelected = selectedGroupAnim === anim.id;
                  return (
                    <div
                      key={anim.id}
                      onClick={() => {
                        if (isPro) setSelectedGroupAnim(anim.id);
                      }}
                      className={`relative p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                        !isPro ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'bg-purple-500/10 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-1 ring-purple-400/50'
                          : 'bg-[#151821] border-white/10 hover:border-white/20 hover:bg-[#1A1D28]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white">{anim.name}</h4>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 bg-purple-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            <Check className="w-3 h-3 stroke-[3]" /> Selected
                          </span>
                        )}
                      </div>

                      {/* Mini Live Group Card Preview */}
                      <div className={`p-3 rounded-xl bg-[#0F1117] border border-white/10 ${anim.groupClass}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold">
                              EN
                            </div>
                            <span className="text-xs font-bold text-white">English Lounge</span>
                          </div>
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                            Active
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">
                        {anim.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0C0E14] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-white/40">
            {errorMessage ? (
              <span className="text-red-400 font-medium">{errorMessage}</span>
            ) : saveSuccess ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Changes applied & saved!
              </span>
            ) : (
              <span>Animations persist automatically across all sessions.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            {isPro ? (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Save & Apply
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  if (onUpgradeClick) onUpgradeClick();
                }}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" /> Get Pro Access
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
