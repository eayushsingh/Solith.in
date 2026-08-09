import React, { useState, useEffect } from 'react';
import { X, User, Loader2 } from 'lucide-react';

export default function FollowListModal({ isOpen, onClose, title, ids }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchProfiles = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!ids || ids.length === 0) {
          setProfiles([]);
          setLoading(false);
          return;
        }

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await fetch(`${API_URL}/api/users/profiles?ids=${ids.join(',')}`);
        
        if (!res.ok) throw new Error('Failed to fetch profiles');
        
        const data = await res.json();
        setProfiles(data.profiles || []);
      } catch (err) {
        console.error("Error fetching profiles:", err);
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [isOpen, ids]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-base/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-[var(--bg)] border border-[var(--line-subtle)] rounded-2xl p-6 relative flex flex-col max-h-[80vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-semibold text-text-primary mb-4">{title} ({ids?.length || 0})</h3>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
          {loading ? (
            <div className="flex justify-center items-center py-8 text-text-secondary">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-4 text-sm">{error}</div>
          ) : profiles.length === 0 ? (
            <div className="text-center text-text-secondary py-8 text-sm">
              No users found.
            </div>
          ) : (
            profiles.map(profile => (
              <div key={profile.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--line-subtle)] transition-all">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt={profile.name} className="w-10 h-10 rounded-full object-cover bg-[var(--line)]" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--line)] flex items-center justify-center">
                    <User className="w-5 h-5 text-text-secondary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-text-primary truncate">{profile.name}</h4>
                  <p className="text-xs text-text-secondary truncate">Level {Math.max(1, Math.floor(profile.xp / 100))}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
