import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';

export default function Guidelines({ onBack }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] font-sans flex flex-col items-center py-12 px-6">
      <div className="w-full max-w-2xl">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[var(--ink-tertiary)] hover:text-[var(--accent)] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20">
            <Shield className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Community Guidelines</h1>
            <p className="text-[var(--ink-secondary)] mt-1">Our commitment to profound conversations and zero barriers.</p>
          </div>
        </div>

        <div className="space-y-8 text-[var(--ink-secondary)] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">1.</span> Be respectful
            </h2>
            <p>
              No harassment, hate speech, threats, or bullying. Treat everyone with dignity and respect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">2.</span> No sexual content or unwanted advances
            </h2>
            <p>
              Explicit sexual content, inappropriate advances, and solicitation are strictly prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">3.</span> No spam or scams
            </h2>
            <p>
              Do not use this platform to promote scams, spam others, or distribute malicious links.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">4.</span> No fake identities or impersonation
            </h2>
            <p>
              Do not pretend to be someone else or misrepresent your identity to deceive others.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">5.</span> Don't share others' private information
            </h2>
            <p>
              Respect privacy. Doxxing or sharing personal information without explicit consent is strictly forbidden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">6.</span> Keep your mic muted when not speaking
            </h2>
            <p>
              Don't dominate the conversation. Allow others to speak and maintain a healthy dialogue.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">7.</span> Follow room-owner and host instructions
            </h2>
            <p>
              Room owners and co-hosts manage their spaces. Please respect their rules and moderation decisions.
            </p>
          </section>

          <div className="mt-12 p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--line-subtle)]">
            <h3 className="font-semibold text-[var(--ink)] mb-2 flex items-center gap-2">
              Enforcement
            </h3>
            <p className="text-sm">
              Violations can lead to warnings, restrictions, or bans depending on the severity of the offense. We actively review reports to keep the community safe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
