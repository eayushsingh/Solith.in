import sys

with open('temp_target.txt', 'r') as f:
    target_content = f.read()

replacement = """        return (
        <div className="call-room-bg font-sans animate-fade-in fixed inset-0 bg-[#121418] flex flex-col z-50">
          
          {/* Top Floating Control Bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center gap-2 bg-[#1c1f26]/90 backdrop-blur-md rounded-2xl p-2 border border-white/5 shadow-2xl">
             <div className="px-3 border-r border-white/10 flex items-center gap-2 text-white/50 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                12:47
             </div>
             {isListener ? (
                hasRaisedHand ? (
                  <button onClick={lowerHand} className="p-2 hover:bg-white/10 rounded-xl flex items-center gap-2 text-xs font-bold text-white/70 transition-colors">
                    <Hand className="w-4 h-4 text-[var(--accent)]"/> Lower
                  </button>
                ) : (
                  <button onClick={raiseHand} className="p-2 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-xl flex items-center gap-2 text-xs font-bold text-[var(--accent)] transition-colors">
                    <Hand className="w-4 h-4"/> Raise
                  </button>
                )
             ) : (
               <button onClick={toggleMute} className={`p-2 rounded-xl transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-[#2a2d36] text-white hover:bg-white/20'}`}>
                 {isMuted ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}
               </button>
             )}
             <button onClick={() => setShowSettingsModal(true)} className="p-2 rounded-xl bg-[#2a2d36] text-white hover:bg-white/20 transition-colors"><Settings className="w-4 h-4"/></button>
             <button onClick={leaveVoiceRoom} className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors ml-2"><LogOut className="w-4 h-4"/></button>
          </div>

          {/* Full-Screen Participant Grid */}
          <div className="flex-1 w-full h-full p-4 md:p-8 pt-24 pb-24 overflow-y-auto overflow-x-hidden hide-scrollbar">
             <div className="grid gap-4 md:gap-6 w-full max-w-6xl mx-auto items-center justify-center" style={{
                gridTemplateColumns: `repeat(auto-fit, minmax(${participants.length > 4 ? '120px' : '200px'}, 1fr))`
             }}>
                {participants.map(p => {
                    const isSpeaking = (audioLevels[p.id] || 0) > 0.05;
                    const backendP = currentRoomData.participants?.find(bp => bp.id === p.id);
                    const pPhotoUrl = p.isLocal ? user?.photoUrl : (backendP?.photoUrl || p.photoUrl);
                    const pEmoji = p.isLocal ? (user?.emoji || '👤') : (backendP?.emoji || p.emoji || '👤');
                    const pColor = p.isLocal ? (user?.color || '#0d94a8') : (backendP?.color || p.color || '#ff4d4d');
                    const pName = p.isLocal ? 'You' : (backendP?.name || p.name);
                    const targetRole = getRole(p.id);
                    
                    let canModTarget = false;
                    if (myRole === 'owner' && targetRole !== 'owner') canModTarget = true;
                    if (myRole === 'co-owner' && (targetRole === 'elder' || targetRole === 'member' || targetRole === 'guest')) canModTarget = true;
                    const canPromote = myRole === 'owner';

                    return (
                        <div key={p.id} onClick={() => !p.isLocal && setSelectedParticipant(selectedParticipant === p.id ? null : p.id)} className={`relative flex flex-col items-center justify-center aspect-square rounded-3xl overflow-hidden bg-[#1c1f26] border-4 transition-all duration-300 ${isSpeaking ? 'border-[#00d859] shadow-[0_0_25px_rgba(0,216,89,0.3)]' : 'border-transparent'} cursor-pointer hover:scale-[1.02]`} style={{ backgroundColor: pColor }}>
                           {pPhotoUrl ? <img src={pPhotoUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-6xl">{pEmoji}</span>}
                           
                           <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-6 pb-2 px-3 text-center">
                              <span className="text-white text-xs font-bold drop-shadow-md truncate block">{pName}</span>
                              {targetRole === 'owner' && <span className="text-[9px] text-[#00d859] font-black uppercase tracking-wider block mt-0.5">Owner</span>}
                           </div>

                           {p.muted && (
                              <div className="absolute top-3 right-3 w-7 h-7 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center">
                                <MicOff className="w-3.5 h-3.5 text-red-400" />
                              </div>
                           )}

                           {/* Moderation Dropdown */}
                           {selectedParticipant === p.id && !p.isLocal && (
                                <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 text-xs animate-fade-in gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); openUserProfile(p.id); setSelectedParticipant(null); }} className="w-full text-center py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">Profile</button>
                                  {canPromote && targetRole !== 'owner' && (
                                    <button onClick={(e) => { e.stopPropagation(); promoteUser(p.id, 'co-owner'); setSelectedParticipant(null); }} className="w-full text-center py-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 rounded-xl transition-colors">Make Co-Owner</button>
                                  )}
                                  {canModTarget && (
                                    <button onClick={(e) => { e.stopPropagation(); muteUser(p.id); setSelectedParticipant(null); }} className="w-full text-center py-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-xl transition-colors">Mute</button>
                                  )}
                                </div>
                           )}
                        </div>
                    )
                })}
             </div>
          </div>

          {/* Chat Overlay (Hidden by Default) */}
          {isChatOpen && (
             <div className="absolute bottom-[90px] left-4 right-4 md:left-auto md:right-8 md:w-[380px] h-[400px] max-h-[50vh] bg-[#121418]/95 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-40 flex flex-col animate-fade-in">
                <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                  <span className="font-bold text-sm tracking-widest text-white uppercase">Room Chat</span>
                  <button onClick={() => setIsChatOpen(false)} className="text-white/50 hover:text-white p-1 rounded-full"><X className="w-4 h-4"/></button>
                </div>
                <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto" id="chat-container">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-white/30 text-xs italic mb-4">Messages are ephemeral and disappear when you leave.</div>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 w-full items-end ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                      {msg.senderId !== user?.id && (
                         <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md flex-shrink-0" style={{ backgroundColor: msg.senderColor }}>
                           {msg.senderEmoji || '👤'}
                         </div>
                      )}
                      <div className={msg.senderId === user?.id ? 'chat-bubble-right bg-[#00d859]/20 text-white rounded-2xl rounded-br-sm px-3 py-2 text-sm max-w-[80%]' : 'chat-bubble-left bg-white/10 text-white rounded-2xl rounded-bl-sm px-3 py-2 text-sm max-w-[80%]'}>
                        <span className="font-bold block text-[10px] opacity-50 mb-0.5">{msg.senderName}</span>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
             </div>
          )}

          {/* Bottom Floating App Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1c1f26]/90 backdrop-blur-md rounded-full px-2 py-2 border border-white/5 shadow-2xl flex items-center gap-2 z-50 w-[95%] md:w-auto md:min-w-[400px] justify-between md:justify-center">
             
             {/* Left - Room Info */}
             <div className="flex items-center gap-2 px-3 flex-shrink-0">
               <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)]">
                 <Users className="w-4 h-4"/>
               </div>
               <div className="flex flex-col hidden md:flex">
                 <span className="text-xs font-bold text-white tracking-wide truncate max-w-[120px]">{activeRoom.name}</span>
                 <span className="text-[9px] text-[var(--accent)] font-mono uppercase">{participants.length} connected</span>
               </div>
             </div>

             <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>

             {/* Center - Action Buttons */}
             <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setIsChatOpen(!isChatOpen)} className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isChatOpen ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:bg-white/10 hover:text-white'}`}>
                  <MessageSquare className="w-5 h-5"/>
                  {chatMessages.length > 0 && !isChatOpen && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1c1f26]"></span>}
                </button>
             </div>

             <div className="w-px h-8 bg-white/10 mx-1"></div>

             {/* Right - Chat Input */}
             <form onSubmit={(e) => { e.preventDefault(); setIsChatOpen(true); sendChatMessage(e); }} className="flex-1 min-w-[120px] max-w-[200px] flex bg-white/5 rounded-full p-1 items-center border border-white/5 focus-within:border-[var(--accent)] transition-colors">
                <input type="text" placeholder="Send message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onClick={() => setIsChatOpen(true)} className="flex-1 bg-transparent border-none text-white text-xs outline-none shadow-none px-3 w-full placeholder:text-white/30" />
                <button type="submit" className="w-8 h-8 rounded-full bg-[var(--accent)]/80 hover:bg-[var(--accent)] transition-colors flex items-center justify-center text-black shadow-md flex-shrink-0"><Send className="w-3.5 h-3.5 ml-0.5"/></button>
             </form>
          </div>

        </div>
        );"""

with open('client/src/App.jsx', 'r') as f:
    app_content = f.read()

new_content = app_content.replace(target_content, replacement)

with open('client/src/App.jsx', 'w') as f:
    f.write(new_content)
