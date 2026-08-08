import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, db } from '../firebase';
import { MessageSquare, Loader2, ChevronRight, User } from 'lucide-react';

export default function MessagesView({ currentUser, onOpenConversation }) {
  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.id),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter out blocked users
      const blocked = currentUser.blockedUsers || [];
      const validConvos = convos.filter(c => {
        const otherId = c.participants.find(p => p !== currentUser.id);
        return !blocked.includes(otherId);
      });

      setConversations(validConvos);

      // Fetch profiles for the other participants
      const missingProfileIds = validConvos
        .map(c => c.participants.find(p => p !== currentUser.id))
        .filter(id => id && !profiles[id]);

      if (missingProfileIds.length > 0) {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          const res = await fetch(`${API_URL}/api/users/profiles?ids=${[...new Set(missingProfileIds)].join(',')}`);
          if (res.ok) {
            const data = await res.json();
            const newProfiles = { ...profiles };
            data.profiles.forEach(p => { newProfiles[p.id] = p; });
            setProfiles(newProfiles);
          }
        } catch (err) {
          console.error("Failed to fetch profiles for inbox", err);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, profiles]); // adding profiles might cause extra fetches, but we only fetch missing ones

  if (loading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--ink-tertiary)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col pt-24 px-6 pb-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-serif tracking-tight text-[var(--ink)]">Direct Messages</h2>
          <p className="text-sm text-[var(--ink-secondary)] mt-1">Your private conversations</p>
        </div>
      </div>

      <div className="flex-1 bg-[var(--bg)] border border-[var(--line-subtle)] rounded-3xl overflow-hidden shadow-2xl shadow-black/5 flex flex-col">
        {conversations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-6">
              <MessageSquare className="w-8 h-8 text-[var(--ink-tertiary)] opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-[var(--ink)] mb-2">No messages yet</h3>
            <p className="text-[var(--ink-secondary)] max-w-sm">Start a conversation from someone's profile to connect privately.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[var(--line-subtle)]">
            {conversations.map(convo => {
              const otherId = convo.participants.find(p => p !== currentUser.id);
              const profile = profiles[otherId] || { name: 'Unknown User' };
              const isUnread = convo.lastMessageSenderId !== currentUser.id && convo.lastMessageSenderId; // Note: For a real unread system, we'd check messages readAt, but this is a simplified visual distinction.

              return (
                <div 
                  key={convo.id}
                  onClick={() => onOpenConversation(convo.id, profile)}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group"
                >
                  <div className="relative">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-[var(--line-subtle)]" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[var(--bg-secondary)] border border-[var(--line-subtle)] flex items-center justify-center">
                        <User className="w-6 h-6 text-[var(--ink-tertiary)]" />
                      </div>
                    )}
                    {isUnread && (
                      <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-blue-500 border-2 border-[var(--bg)] rounded-full"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <h4 className={`text-base truncate ${isUnread ? 'font-bold text-[var(--ink)]' : 'font-medium text-[var(--ink-secondary)]'}`}>
                        {profile.name}
                      </h4>
                      {convo.lastMessageAt && (
                        <span className="text-xs text-[var(--ink-tertiary)] whitespace-nowrap ml-2">
                          {convo.lastMessageAt?.toDate ? convo.lastMessageAt.toDate().toLocaleDateString() : 'Just now'}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate ${isUnread ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink-tertiary)]'}`}>
                      {convo.lastMessageSenderId === currentUser.id ? 'You: ' : ''}
                      {convo.lastMessageText || 'Tap to view conversation'}
                    </p>
                  </div>

                  <div className="w-8 flex items-center justify-center text-[var(--ink-tertiary)] group-hover:text-[var(--ink)] group-hover:translate-x-1 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
