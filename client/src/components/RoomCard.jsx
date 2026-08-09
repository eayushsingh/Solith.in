import React from 'react';
import { Settings, Heart, Phone } from 'lucide-react';

export default function RoomCard({ room, onJoin }) {
  // Free4Talk style Room Card
  
  return (
    <div className="relative w-full rounded-2xl overflow-hidden flex flex-col p-5 bg-gradient-to-br from-bg-surface to-bg-base border border-accent-primary/20 shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all duration-300 hover:scale-[1.02] hover:border-accent-primary/50 hover:shadow-[0_8px_40px_rgba(108,92,231,0.15)] group">
      
      {/* Top Header Row */}
      <div className="flex items-center justify-between w-full mb-3">
        <div className="flex items-center gap-2">
          {/* Faux logo circle */}
          <div className="w-5 h-5 rounded-full border-2 border-accent-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-primary"></div>
          </div>
          <span className="text-text-primary font-semibold text-sm">
            {room.language || 'English'}
          </span>
          <span className="text-text-primary/50 text-xs italic ml-1">
            {room.tags && room.tags.length > 0 ? room.tags[0] : 'Any Level'}
          </span>
        </div>
        <button className="text-accent-primary hover:text-accent-primary-hover transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Topic Title */}
      <h3 className="text-accent-primary text-[13px] font-bold uppercase tracking-wide mb-6 line-clamp-1">
        {room.name || 'PRACTICE ENGLISH HERE'}
      </h3>

      {/* Central Avatars with Likes */}
      <div className="flex items-center justify-center gap-6 mb-8 flex-1">
        {/* We'll show exactly two large avatar slots to mimic the reference exactly */}
        {[0, 1].map((slotIdx) => {
          const participant = room.participants ? room.participants[slotIdx] : null;
          
          if (participant) {
            return (
              <div key={participant.id || slotIdx} className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full border-[3px] border-accent-primary/30 overflow-hidden mb-2 relative">
                  {participant.photoUrl ? (
                    <img src={participant.photoUrl} alt={participant.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-bg-surface-elevated flex items-center justify-center text-xl font-bold text-text-primary">
                      {participant.name ? participant.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  {/* Fake online status indicator */}
                  <div className="absolute bottom-1 right-1 w-4 h-4 bg-success border-2 border-bg-surface-elevated rounded-full"></div>
                </div>
                <div className="flex items-center gap-1 text-accent-primary text-xs font-bold">
                  <Heart className="w-3 h-3 fill-current" />
                  <span>{Math.floor(Math.random() * 200) + 10}</span>
                </div>
              </div>
            );
          } else {
            // Empty placeholder slot
            return (
              <div key={`empty-${slotIdx}`} className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full border-[2px] border-dashed border-border-color mb-2 relative group-hover:border-accent-primary/50 transition-colors duration-300"></div>
              </div>
            );
          }
        })}
      </div>

      {/* Join Button */}
      <div className="w-full mt-auto">
        {room.participants && room.participants.length >= 25 ? (
          <button disabled className="w-full py-2.5 rounded-lg border border-white/20 text-text-primary/50 text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed">
            This group is full.
          </button>
        ) : (
          <button 
            onClick={() => onJoin(room)}
            className="relative overflow-hidden w-full py-2.5 rounded-lg border border-[var(--accent-primary)] text-[var(--accent-primary)] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[var(--accent-primary)] hover:text-bg-base transition-all duration-300 hover:shadow-[0_0_20px_var(--accent-primary-glow)] group/btn"
          >
            <Phone className="w-4 h-4 transition-transform group-hover/btn:rotate-12 group-hover/btn:scale-110" /> Join and talk now!
          </button>
        )}
      </div>
      
    </div>
  );
}
