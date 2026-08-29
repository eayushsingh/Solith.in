import { auth } from '../firebase';
import React, { useState, useEffect } from 'react';
import { Crown, ShieldCheck, Check, ArrowLeft, Star, Zap, Image as ImageIcon, Search } from 'lucide-react';
import { Meteors } from './Meteors';
import PremiumBadge from './PremiumBadge';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function PremiumSubscription({ onBack, user }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [utr, setUtr] = useState('');
  const [status, setStatus] = useState(null); // null, 'PENDING', 'APPROVED', 'REJECTED'
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({ premiumPrice: 99, premiumDurationDays: 30, qrCodeUrl: '/qr.png' });
  const [selectedPlan, setSelectedPlan] = useState('STANDARD');
  const [screenshot, setScreenshot] = useState(null);

  const isPremiumActive = user?.isPremium && (!user.premiumExpiresAt || user.premiumExpiresAt > Date.now());

  useEffect(() => {
    fetchSettings();
    fetchPaymentStatus();
  }, [user]);

  const getFreshToken = async () => {
    if (!auth?.currentUser) return user?.token || '';
    return await auth.currentUser.getIdToken(false);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/public`);
      const data = await res.json();
      setSettings({ ...data, qrCodeUrl: '/qr.png' }); // User wants to use local qr.png
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const fetchPaymentStatus = async () => {
    if (!user || !(await getFreshToken())) return;
    try {
      const res = await fetch(`${API_URL}/api/payments/status`, {
        headers: { 'Authorization': `Bearer ${(await getFreshToken())}` }
      });
      const data = await res.json();
      if (data.hasRequest) {
        setStatus(data.request.status);
        if (data.request.status === 'REJECTED') {
          // You could fetch rejection reason if included in status
          setRejectionReason('Payment could not be verified. Please try again.');
        }
      }
    } catch (err) {
      console.error('Failed to fetch payment status', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const utrStr = utr ? utr.trim() : '';
    if (!/^\d{12}$/.test(utrStr)) {
      setError('Please enter a valid 12-digit UTR / Transaction ID.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/payments/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await getFreshToken())}`
        },
        body: JSON.stringify({ utr: utr.trim(), plan: selectedPlan })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit payment request.');
      }
      
      setStatus('PENDING');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-[#0B0D12] flex items-center justify-center">
         <div className="w-12 h-12 border-4 border-white/10 border-t-amber-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0B0D12] relative overflow-x-hidden font-sans text-text-primary selection:bg-amber-500/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-amber-600/10 blur-[150px] rounded-full mix-blend-screen"></div>
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] bg-amber-500/10 blur-[150px] rounded-full mix-blend-screen"></div>
      </div>
      <Meteors number={15} />

      <div className="w-full max-w-5xl mx-auto py-8 sm:py-12 px-4 md:px-8 relative z-20 animate-fade-in">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
        >
          <div className="bg-white/5 p-2 rounded-xl group-hover:bg-white/10 transition-colors border border-white/5">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="font-bold tracking-widest text-sm uppercase">Back</span>
        </button>

        {isPremiumActive && status !== 'VIEW_PLANS' ? (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-1 mb-8 shadow-[0_0_50px_rgba(251,191,36,0.3)] animate-bounce-slow">
              <div className="w-full h-full bg-[#0B0D12] rounded-full flex items-center justify-center border-4 border-[#0B0D12]">
                <Crown className="w-16 h-16 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
              </div>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-amber-100 to-amber-400 mb-6 drop-shadow-2xl">
              Premium Active
            </h1>
            <p className="text-white/60 text-lg max-w-md mx-auto mb-10 leading-relaxed font-medium">
              You're a Free for Talk Premium member! Enjoy priority group placement, premium badges, and enhanced visibility.
            </p>
            {user.premiumExpiresAt && (
              <div className="inline-flex flex-col items-center px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md mb-8">
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Expires On</span>
                <span className="text-amber-400 font-bold tracking-wide">
                   {new Date(user.premiumExpiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}
            
            <button 
              onClick={() => {
                // Temporary override for testing or viewing plans
                setStatus('VIEW_PLANS');
              }}
              className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-white font-bold transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> View Subscription Plans
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-start">
            
            {/* Left Col: Hero & Features */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
                 <Crown className="w-4 h-4 text-amber-400" />
                 <span className="text-[11px] font-black tracking-[0.2em] uppercase text-amber-400">Upgrade to Premium</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 leading-[1.1] tracking-tight">
                Unlock <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 drop-shadow-[0_0_30px_rgba(251,191,36,0.3)]">Premium</span> Features
              </h1>
              <p className="text-white/50 text-lg mb-10 leading-relaxed font-medium max-w-lg">
                Get more visibility, better group experiences, premium features, and an enhanced way to connect with learners worldwide.
              </p>

              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <Star className="w-5 h-5 text-amber-400" /> Free vs Premium
                </h3>
                
                <div className="space-y-4">
                  {[
                    { title: "Standard Profile & Groups", free: true, premium: true },
                    { title: "👑 Premium Profile Badge", free: false, premium: true },
                    { title: "⭐ Priority Group Placement", free: false, premium: true },
                    { title: "✨ Premium Group Highlight", free: false, premium: true },
                    { title: "🎨 Premium Customizations", free: false, premium: true },
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group">
                      <span className={`text-sm font-semibold ${feature.free ? 'text-white/70' : 'text-amber-100/90'}`}>{feature.title}</span>
                      <div className="flex items-center gap-6 w-32 justify-end pr-2">
                        <div className="w-6 flex justify-center">
                          {feature.free ? <Check className="w-4 h-4 text-white/30" /> : <span className="w-4 h-px bg-white/10"></span>}
                        </div>
                        <div className="w-6 flex justify-center">
                          {feature.premium && <Check className="w-5 h-5 text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)] group-hover:scale-125 transition-transform" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-end gap-6 w-full pt-2 pr-4 text-[10px] font-black uppercase tracking-widest text-white/30">
                    <span className="w-6 text-center">Free</span>
                    <span className="w-6 text-center text-amber-400/50">Pro</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Payment Card */}
            <div className="lg:pl-8">
              <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] border border-white/10 rounded-[2rem] p-1 relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-b from-amber-500/20 to-transparent opacity-50"></div>
                
                <div className="bg-[#0f0f11] rounded-[1.85rem] p-6 sm:p-8 relative z-10">
                  {status === 'PENDING' ? (
                    <div className="text-center py-12 flex flex-col items-center animate-fade-in">
                      <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mb-6">
                        <Search className="w-8 h-8 text-amber-400 animate-pulse" />
                      </div>
                      <h3 className="text-2xl font-black text-white mb-3">Payment Under Review</h3>
                      <p className="text-white/50 text-sm max-w-xs mx-auto leading-relaxed">
                        Your UTR has been submitted successfully. An administrator is currently manually verifying your payment. Your Premium membership will be activated once approved.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6">
                        <h3 className="text-xl font-black text-white mb-4 tracking-tight">Select your plan</h3>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <button 
                            type="button"
                            onClick={() => setSelectedPlan('STANDARD')}
                            className={`p-3 rounded-xl border text-left transition-all ${selectedPlan === 'STANDARD' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                          >
                            <div className="text-white font-bold text-sm mb-1">Standard</div>
                            <div className="text-amber-400 font-black text-lg">₹{settings.premiumPrice}</div>
                            <div className="text-white/40 text-[10px] mt-1 leading-tight">All premium benefits</div>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSelectedPlan('OWNER')}
                            className={`p-3 rounded-xl border text-left transition-all ${selectedPlan === 'OWNER' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                          >
                            <div className="text-white font-bold text-sm mb-1">Owner Pro</div>
                            <div className="text-amber-400 font-black text-lg">₹499</div>
                            <div className="text-white/40 text-[10px] mt-1 leading-tight">1-on-1 with owner, custom changes</div>
                          </button>
                        </div>
                        <p className="text-white/40 text-[11px] font-medium text-center">{settings.premiumDurationDays} days of premium benefits</p>
                      </div>

                      {status === 'REJECTED' && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                          {rejectionReason || "Payment could not be verified."} Please check your UTR and try again.
                        </div>
                      )}

                      <div className="bg-white/5 rounded-2xl p-6 flex flex-col items-center mb-8 border border-white/5">
                        <div className="w-48 h-48 bg-white p-2 rounded-xl mb-4 relative group">
                          {/* PLACEHOLDER: USER SHOULD REPLACE /qr.png WITH THEIR ACTUAL QR */}
                          <img src={settings.qrCodeUrl} alt="UPI QR Code" className="w-full h-full object-contain rounded-lg" onError={(e) => {
                            e.target.style.display='none';
                            e.target.nextSibling.style.display='flex';
                          }} />
                          <div className="hidden absolute inset-0 items-center justify-center text-black/50 font-bold text-center p-4">
                            QR Code Image Not Found
                          </div>
                        </div>
                        <p className="text-white/60 text-sm font-medium text-center">
                          Scan with any UPI app to pay exactly <strong className="text-white">₹{selectedPlan === 'OWNER' ? 499 : settings.premiumPrice}</strong>
                        </p>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                          <div className="text-red-400 text-sm font-medium px-2">{error}</div>
                        )}
                        <div>
                          <label className="block text-white/40 text-xs font-bold uppercase tracking-widest mb-2 px-1">Payment Verification</label>
                          <input
                            type="text"
                            value={utr}
                            onChange={(e) => setUtr(e.target.value)}
                            placeholder="Enter your UTR / Transaction ID"
                            className="w-full bg-[#15171a] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-white/40 text-xs font-bold uppercase tracking-widest mb-2 px-1">Payment Screenshot</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setScreenshot(reader.result);
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="w-full bg-[#15171a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-amber-500/10 file:text-amber-400 hover:file:bg-amber-500/20 cursor-pointer"
                            required
                          />
                          {screenshot && <div className="mt-2 text-xs text-green-400 font-medium px-1 flex items-center gap-1"><Check className="w-3 h-3"/> Screenshot attached</div>}
                        </div>
                        
                        <button
                          type="submit"
                          disabled={submitting || !utr.trim() || !screenshot}
                          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:transform-none flex items-center justify-center gap-2"
                        >
                          {submitting ? 'Submitting...' : 'Submit Payment for Verification'}
                        </button>
                      </form>
                      
                      <div className="mt-6 flex items-start gap-3 text-white/30 text-xs leading-relaxed">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>Payments are manually verified by administrators. Please ensure you have transferred exactly ₹{selectedPlan === 'OWNER' ? 499 : settings.premiumPrice} to the displayed UPI before submitting your UTR.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
