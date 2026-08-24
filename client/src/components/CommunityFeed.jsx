import React, { useState, useEffect } from 'react';
import { Share2, Heart, Trash2, Send, MessageSquare, AlertCircle, Calendar, Plus, Compass } from 'lucide-react';
import { db, collection, addDoc, onSnapshot, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, serverTimestamp } from '../firebase';
import { Meteors } from './Meteors';

export default function CommunityFeed({ user, openUserProfile, onBack }) {
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 4-second timeout protection in case Cloud Firestore API is disabled in Firebase Console
    let timeout = setTimeout(() => {
      setLoading(false);
      console.warn("Firebase connection timeout in CommunityFeed. Please make sure the Cloud Firestore API is enabled in your Firebase project.");
    }, 4000);

    // Listen to the last 100 posts in real-time
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(timeout);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(list);
      setLoading(false);
    }, (error) => {
      clearTimeout(timeout);
      console.error("Failed to load community feed:", error);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!postText.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.id,
        authorName: user.name,
        authorPhotoUrl: user.photoUrl || '',
        authorEmoji: user.emoji || '👤',
        authorColor: user.color || '#ff4d4d',
        text: postText.trim(),
        likes: [],
        createdAt: serverTimestamp()
      });
      setPostText('');
    } catch (err) {
      console.error("Error creating post:", err);
      alert("Failed to share post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (postId, likesArray) => {
    if (!user) {
      alert("Please sign in to like posts.");
      return;
    }
    const isLiked = likesArray?.includes(user.id);
    const postRef = doc(db, 'posts', postId);

    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(user.id) : arrayUnion(user.id)
      });
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      console.error("Failed to delete post:", err);
      alert("Could not delete post.");
    }
  };

  const formatPostTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 600);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full min-h-screen bg-[#0B0D12] relative overflow-x-hidden">
      <Meteors number={15} />

      <div className="w-full max-w-2xl mx-auto py-10 px-4 animate-fade-in relative z-20">
        
        {/* Header Section */}
        <div className="flex flex-col items-start mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 mb-4">
             <Compass className="w-4 h-4 text-[var(--accent-primary)] animate-pulse" />
             <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--accent-primary)]">Community</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40 tracking-tight drop-shadow-2xl">
            Lounge Feed
          </h1>
          <p className="text-white/50 mt-2 font-medium text-sm">Connect, share progress, and discuss with fellow language learners.</p>
        </div>

        {/* Create Post Card */}
        {user ? (
          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 opacity-30"></div>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="flex gap-4">
                <div 
                  onClick={() => openUserProfile(user.id)}
                  className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 cursor-pointer hover:scale-105 transition-transform" 
                  style={{ backgroundColor: user.color || '#333' }}
                >
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">{user.emoji || '👤'}</span>
                  )}
                </div>
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="What are you practicing today? Share updates or ask questions..."
                  className="flex-1 min-h-[80px] bg-transparent border-0 resize-none text-text-primary text-sm placeholder-white/30 focus:outline-none focus:ring-0 w-full pt-1"
                  maxLength={400}
                  required
                />
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">
                  {postText.length} / 400 chars
                </span>
                <button
                  type="submit"
                  disabled={submitting || !postText.trim()}
                  className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none hover:shadow-[0_0_15px_var(--accent-primary-glow)] active:scale-[0.98]"
                >
                  {submitting ? 'Posting...' : 'Post Share'}
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-3xl p-6 text-center mb-8">
            <AlertCircle className="w-8 h-8 text-yellow-500/80 mx-auto mb-3" />
            <h3 className="text-white/80 font-bold text-sm mb-1">Join the community conversation</h3>
            <p className="text-white/40 text-xs mb-4">You need to sign in to share posts and like other practice shares.</p>
          </div>
        )}

        {/* Posts Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full animate-spin"></div>
            <div className="text-white/40 text-[10px] font-bold tracking-widest uppercase">Loading Feed...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center bg-black/20 border border-white/5 rounded-3xl p-8">
            <MessageSquare className="w-10 h-10 text-white/20 mx-auto mb-4" />
            <h3 className="text-white/60 font-bold">No posts in the lounge yet</h3>
            <p className="text-white/30 text-xs max-w-xs mx-auto mt-2">Be the first to share your learning update or say hello to the community!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              const isLiked = post.likes?.includes(user?.id);
              const isAuthor = post.userId === user?.id;

              return (
                <div key={post.id} className="bg-black/30 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all shadow-md group relative">
                  <div className="flex gap-4">
                    {/* Author Avatar */}
                    <div 
                      onClick={() => openUserProfile(post.userId)}
                      className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/5 cursor-pointer hover:scale-105 transition-transform" 
                      style={{ backgroundColor: post.authorColor || '#333' }}
                    >
                      {post.authorPhotoUrl ? (
                        <img src={post.authorPhotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{post.authorEmoji || '👤'}</span>
                      )}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span 
                          onClick={() => openUserProfile(post.userId)}
                          className="font-extrabold text-white text-sm hover:text-[var(--accent-primary)] cursor-pointer transition-colors"
                        >
                          {post.authorName}
                        </span>
                        <span className="text-[10px] text-white/30 font-medium">
                          {formatPostTime(post.createdAt)}
                        </span>
                      </div>
                      
                      <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap mt-2">
                        {post.text}
                      </p>

                      {/* Post Actions (Like, Delete) */}
                      <div className="flex items-center gap-6 mt-4 pt-3 border-t border-white/5">
                        <button
                          onClick={() => handleToggleLike(post.id, post.likes)}
                          className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${isLiked ? 'text-red-400' : 'text-white/30 hover:text-red-400/80'}`}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-400 text-red-400' : ''}`} />
                          <span>{post.likes?.length || 0}</span>
                        </button>

                        {isAuthor && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="ml-auto text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-lg"
                            title="Delete Post"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
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
