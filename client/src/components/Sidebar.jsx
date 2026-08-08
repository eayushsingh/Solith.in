import React from 'react';
import { Home, MessageSquare, GraduationCap, Flame, MessageCircle, Crown, LogOut, Settings } from 'lucide-react';

export default function Sidebar({ currentView, setView, user, onAuthClick, onSettingsClick, onLogoutClick }) {
  const navItems = [
    { id: 'lobby', icon: Home, title: 'Home' },
    { id: 'messages', icon: MessageSquare, title: 'Global Chat' },
    { id: 'teachers', icon: GraduationCap, title: 'Teachers' },
    { id: 'streak', icon: Flame, title: 'Streak' },
    { id: 'rooms', icon: MessageCircle, title: 'Clans' },
  ];

  return (
    <aside className="fixed bottom-0 left-0 w-full h-16 md:h-screen md:w-[72px] md:top-0 bg-[#121418]/95 backdrop-blur-md md:bg-[#121418] border-t md:border-t-0 md:border-r border-[#24272e] flex flex-row md:flex-col items-center justify-around md:justify-start px-4 md:px-0 py-0 md:py-6 z-50">
      {/* Logo Area */}
      <div 
        onClick={() => setView('lobby')}
        className="hidden md:flex w-10 h-10 rounded bg-[#cd1c18] items-center justify-center cursor-pointer mb-8 shadow-[0_0_15px_rgba(205,28,24,0.3)] transition-transform hover:scale-105"
        title="TalkFree Home"
      >
        <span className="text-[#0b0d10] font-black text-xl tracking-tighter">T</span>
      </div>

      {/* Main Navigation */}
      <div className="flex flex-row md:flex-col gap-1 md:gap-6 w-full items-center justify-center flex-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => { setView(item.id); window.location.hash = item.id; }}
              className={`relative p-3 rounded-full transition-all duration-200 group flex items-center justify-center ${
                isActive 
                  ? 'text-[#cd1c18] border border-[#cd1c18]' 
                  : 'text-[#86868b] hover:text-white hover:bg-[rgba(255,255,255,0.05)] border border-transparent'
              }`}
              title={item.title}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="hidden md:flex flex-col gap-4 w-full items-center mt-auto">
        
        {/* WhatsApp Icon */}
        <button 
          className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
          title="WhatsApp Support"
          onClick={() => window.open('https://wa.me/1234567890', '_blank')}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </button>

        {/* Crown Icon */}
        <button 
          className="w-9 h-9 rounded-full bg-[#ffcc00] flex items-center justify-center text-black shadow-lg hover:scale-105 transition-transform" 
          title="Premium"
        >
          <Crown className="w-5 h-5" />
        </button>

        {/* User Initial / Login */}
        {user ? (
          <div className="relative group mt-2">
            <button 
              className="w-10 h-10 rounded-full bg-[#2a2d36] border border-[#32363e] flex items-center justify-center text-white hover:border-[#cd1c18] transition-all"
              onClick={onSettingsClick}
              title={user.displayName || "Profile"}
            >
              <span className="font-bold text-xs uppercase">
                {(user.displayName && user.displayName.length >= 2) ? user.displayName.substring(0, 2) : 'IN'}
              </span>
            </button>
            <div className="absolute left-14 bottom-0 hidden group-hover:flex flex-col gap-2 bg-[#1c1f26] border border-[#2a2d36] p-2 rounded-lg shadow-xl">
              <button onClick={onSettingsClick} className="px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded flex items-center gap-2 whitespace-nowrap"><Settings className="w-4 h-4"/> Settings</button>
              <button onClick={onLogoutClick} className="px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded flex items-center gap-2 whitespace-nowrap"><LogOut className="w-4 h-4"/> Logout</button>
            </div>
          </div>
        ) : (
          <button 
            onClick={onAuthClick}
            className="w-10 h-10 mt-2 rounded-full border border-[var(--line-bright)] flex items-center justify-center text-[#86868b] hover:text-white transition-all hover:bg-[rgba(255,255,255,0.05)]"
            title="Sign In"
          >
            <span className="font-bold text-xs">IN</span>
          </button>
        )}
      </div>
    </aside>
  );
}
