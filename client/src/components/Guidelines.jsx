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
              <span className="text-[var(--accent)]">1.</span> Be Respectful
            </h2>
            <p>
              We have zero tolerance for harassment, hate speech, discrimination, bullying, or threats of any kind. 
              Treat everyone with dignity. Engage in debate, but never attack the person.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">2.</span> No Personal Information
            </h2>
            <p>
              Do not share personal contact info, phone numbers, or social media handles for the purpose of moving people off-platform in ways that enable stalking or harassment. Keep the conversation here.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">3.</span> No Sexual Content
            </h2>
            <p>
              Solith is not a dating app. Explicit sexual content, inappropriate advances, and solicitation are strictly prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">4.</span> Respect Room Topics
            </h2>
            <p>
              Don't derail or spam unrelated rooms. If a room is focused on practicing Spanish, don't spam English. 
              If a room is a serious debate, don't troll. Find the right room for your vibe, or create your own.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">5.</span> Respect the Hosts
            </h2>
            <p>
              Room owners and co-hosts have the final say in their rooms. They have the right to mute, kick, or end sessions. 
              Please respect their decisions to keep the peace in their spaces.
            </p>
          </section>

          <div className="mt-12 p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--line-subtle)]">
            <h3 className="font-semibold text-[var(--ink)] mb-2">Enforcement</h3>
            <p className="text-sm">
              Violations of these rules will result in immediate action. We actively monitor reports from our community. 
              Depending on the severity, violations can lead to warnings, temporary room-creation bans, or permanent account termination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
