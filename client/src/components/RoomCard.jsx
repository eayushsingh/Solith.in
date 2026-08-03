import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export default function RoomCard({ room, inThisRoom, onJoin, userFollowing = [] }) {
  const cardRef = useRef();
  const bgRef = useRef();
  const titleRef = useRef();
  const descRef = useRef();
  const avatarsContainerRef = useRef();
  const arrowRef = useRef();
  const buttonRef = useRef();

  const { contextSafe } = useGSAP({ scope: cardRef });

  const onMouseEnter = contextSafe(() => {
    // Border slowly brightens
    gsap.to(cardRef.current, { 
      borderColor: 'var(--accent)', 
      y: -4,
      boxShadow: '0 12px 40px -8px var(--accent-glow)',
      duration: 0.4, 
      ease: 'power2.out' 
    });
    
    // Background shifts slightly
    gsap.to(bgRef.current, {
      y: 2,
      x: 1,
      backgroundColor: 'var(--bg-hover)',
      duration: 0.6,
      ease: 'power3.out'
    });

    // Title lifts
    gsap.to(titleRef.current, { 
      y: -3, 
      duration: 0.5, 
      ease: 'power3.out' 
    });
    
    // Description opacity shifts slightly (high contrast transition: 0.8 to 1)
    gsap.to(descRef.current, { 
      opacity: 1, 
      duration: 0.5, 
      ease: 'power2.out' 
    });
    
    // Avatars animate (staggered spread)
    if (avatarsContainerRef.current) {
      const avatars = avatarsContainerRef.current.children;
      gsap.to(avatars, { 
        x: (i) => i * 6, 
        scale: 1.05,
        duration: 0.5, 
        ease: 'power3.out',
        stagger: 0.02
      });
    }

    // Arrow slides
    gsap.to(arrowRef.current, { 
      x: 4, 
      y: -2,
      duration: 0.5, 
      ease: 'power3.out' 
    });

    // Button highlight text
    gsap.to(buttonRef.current, { 
      color: 'var(--accent)', 
      duration: 0.4 
    });

  });

  const onMouseLeave = contextSafe(() => {
    // Border dims back
    gsap.to(cardRef.current, { 
      borderColor: 'var(--line)', 
      y: 0,
      boxShadow: 'none',
      duration: 0.4, 
      ease: 'power2.inOut' 
    });

    // Background shifts back
    gsap.to(bgRef.current, {
      y: 0,
      x: 0,
      backgroundColor: 'transparent',
      duration: 0.6,
      ease: 'power3.inOut'
    });

    // Title back
    gsap.to(titleRef.current, { 
      y: 0, 
      duration: 0.5, 
      ease: 'power3.inOut' 
    });

    // Description back (0.8 opacity for reading comfort)
    gsap.to(descRef.current, { 
      opacity: 0.8, 
      duration: 0.5, 
      ease: 'power2.inOut' 
    });
    
    // Avatars spread back
    if (avatarsContainerRef.current) {
      const avatars = avatarsContainerRef.current.children;
      gsap.to(avatars, { 
        x: 0, 
        scale: 1,
        duration: 0.5, 
        ease: 'power3.inOut' 
      });
    }
    
    // Arrow back
    gsap.to(arrowRef.current, { 
      x: 0, 
      y: 0,
      duration: 0.5, 
      ease: 'power3.inOut' 
    });

    // Button back
    gsap.to(buttonRef.current, { 
      color: 'var(--ink-tertiary)', 
      duration: 0.4 
    });

  });

  // Small organic magnetic mouse-tracking follow for card content
  const contentRef = useRef();
  const xTo = useRef();
  const yTo = useRef();

  useGSAP(() => {
    xTo.current = gsap.quickTo(contentRef.current, 'x', { duration: 0.6, ease: 'power3' });
    yTo.current = gsap.quickTo(contentRef.current, 'y', { duration: 0.6, ease: 'power3' });
  }, { scope: cardRef });

  const onMouseMove = contextSafe((e) => {
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    
    // Extremely subtle pull (max 3px) for craftsmanship feel
    xTo.current(x * 0.015);
    yTo.current(y * 0.015);
  });

  const onMouseLeaveMagnetic = contextSafe(() => {
    xTo.current(0);
    yTo.current(0);
  });

  const hasParticipants = room.participants && room.participants.length > 0;
  const hasFriends = room.participants && userFollowing.length > 0 && room.participants.some(p => userFollowing.includes(p.id));

  return (
    <div 
      ref={cardRef}
      onClick={() => {
        onJoin(room);
      }}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        onMouseLeave();
        onMouseLeaveMagnetic();
      }}
      className={`room-card relative h-[220px] select-none overflow-hidden flex flex-col justify-between ${
        hasParticipants ? 'active' : 'empty'
      } ${
        inThisRoom ? 'bg-[var(--bg-hover)]' : ''
      }`}
    >
      {/* Background Shift Panel */}
      <div 
        ref={bgRef}
        className="absolute inset-0 pointer-events-none z-0"
      />

      {/* Content Container (Subtle Magnetic Pull) */}
      <div ref={contentRef} className="relative z-10 flex flex-col h-full justify-between pointer-events-none">
        <div>
          {/* Metadata Row */}
          <div className="meta-label flex items-start justify-between mb-4 font-mono uppercase tracking-[0.2em]">
            <div className="flex items-center gap-2">
              <span>{room.language}</span>
              {room.tags && room.tags.length > 0 && (
                <>
                  <span className="text-[var(--ink-dim)]">•</span>
                  <span>{room.tags[0]}</span>
                </>
              )}
              {room.participants.length >= 5 && (
                <span className="ml-1.5 px-1 py-0.5 text-[8px] tracking-normal bg-[var(--accent-bg)] text-[var(--accent)] font-bold rounded-sm">HOT</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 font-bold text-[10px] text-[var(--ink-tertiary)]">
              {hasParticipants ? (
                <span className="live-dot" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-dim)]" />
              )}
              <span>{room.participants.length}/8</span>
            </div>
          </div>

          {hasFriends && (
            <div className="absolute -top-3 -right-3 flex items-center gap-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[9px] font-bold px-2 py-1 rounded-full z-20 shadow-[0_0_10px_rgba(59,130,246,0.5)]">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              Friends Inside
            </div>
          )}

          {/* Editorial Title */}
          <h3 
            ref={titleRef}
            className="font-serif font-normal mb-2 leading-snug tracking-tight text-[var(--ink)]"
          >
            {room.name}
          </h3>
          
          {/* Description */}
          <p 
            ref={descRef}
            className="desc line-clamp-2 leading-relaxed font-mono"
            style={{ opacity: 0.8 }}
          >
            {room.topic || 'No topic details specified.'}
          </p>
        </div>

        <div className="flex items-end justify-between">
          {/* Avatar Cluster */}
          <div className="flex -space-x-2.5 overflow-visible py-1" ref={avatarsContainerRef}>
            {room.participants.length === 0 ? (
              <span className="text-[9px] text-[var(--ink-tertiary)] uppercase tracking-widest font-mono">Empty Lounge</span>
            ) : (
              room.participants.map((p, idx) => {
                const isActiveSpeaker = idx === 0;

                return (
                  <div 
                    key={p.id}
                    className="relative"
                    style={{ zIndex: 10 - idx }}
                  >
                    {/* Avatar Base */}
                    <div 
                      className="avatar"
                      style={{ 
                        backgroundColor: p.color || '#ff6b4a',
                        boxShadow: isActiveSpeaker ? '0 0 8px var(--accent-glow)' : 'none'
                      }}
                    >
                      {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                    </div>

                    {/* Muted Indicator */}
                    {p.muted && (
                      <div className="absolute -bottom-0.5 -right-0.5 border border-[var(--line-bright)] p-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                        <svg className="w-2 h-2 text-[var(--ink-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3l18 18" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Enter Button */}
          <div 
            ref={buttonRef}
            className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--ink-tertiary)] px-1 py-1 flex items-center gap-1.5"
          >
            <span>enter</span>
            <span ref={arrowRef} className="inline-block transition-transform duration-300">↗</span>
          </div>
        </div>
      </div>
    </div>
  );
}
