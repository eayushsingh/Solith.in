/**
 * About section data structures, FAQs, and step-by-step guides
 */

export const ABOUT_STEPS = [
  { id: '01', title: 'Explore & Filter Live Rooms', description: 'Browse open voice rooms filtered by practice language (English, Spanish, French, Hindi, German, Japanese) and level (Beginner to Fluent).' },
  { id: '02', title: 'Join or Host Voice Rooms', description: 'Click to enter any room instantly with WebRTC low-latency audio. Or create your own room with custom topics and speaker limits.' },
  { id: '03', title: 'Earn XP & Maintain Streaks', description: 'Gain XP points for every minute you speak. Build daily streaks and compete on the global Hall of Fame leaderboard.' },
  { id: '04', title: 'Connect & Direct Message', description: 'Follow your favorite speaking partners, view their achievements, and exchange 1-on-1 direct messages to build lasting friendships.' }
];

export const ABOUT_FAQS = [
  { q: "Is solith.in completely free to use?", a: "Yes! Creating an account, joining public voice rooms, tracking XP, and messaging other language learners is 100% free." },
  { q: "How is my voice privacy protected?", a: "All audio is streamed directly using encrypted WebRTC protocol. Voice conversations are never recorded or stored on our servers." },
  { q: "How does the XP and Streaks system work?", a: "You earn 1 XP for every 1.25 minutes you spend talking in active voice rooms. Maintaining daily talk time builds your streak!" },
  { q: "What should I do if a user violates community guidelines?", a: "Every voice room includes quick reporting tools. Click the Report icon or report a profile directly to alert our moderation team." }
];

export function filterFaqsByQuery(faqs = ABOUT_FAQS, query = '') {
  if (!query || !query.trim()) return faqs;
  const q = query.toLowerCase();
  return faqs.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
}
