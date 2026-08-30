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
    }, 15000);

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
    <div className="w-full min-h-[100dvh] bg-[#090A0F] relative overflow-x-hidden text-white flex flex-col items-center">
      
      {/* Background with Meteors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <Meteors number={15} />
      </div>

      <div className="w-full max-w-[720px] py-16 px-5 relative z-20">
        
        {/* Header Section */}
        <div className="flex flex-col items-start mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1D27] border border-[#2A2E3B] mb-5 shadow-sm">
             <Compass className="w-3.5 h-3.5 text-[#3B82F6]" />
             <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#3B82F6]">Community</span>
          </div>
          <h1 className="text-[42px] font-bold text-white tracking-tight leading-tight mb-2">
            Lounge Feed
          </h1>
          <p className="text-[#888A92] font-medium text-[15px]">
            Connect, share progress, and discuss with fellow language learners.
          </p>
        </div>

        {/* Create Post Card */}
        {user ? (
          <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-6 mb-10 shadow-xl relative overflow-hidden transition-all focus-within:border-[#2A2E3B] focus-within:bg-[#0E1118]">
            {/* Subtle top gradient */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#2A2E3B] to-transparent opacity-50"></div>
            
            <form onSubmit={handleCreatePost} className="space-y-0">
              <div className="flex gap-4 mb-2">
                <div 
                  onClick={() => openUserProfile(user.id)}
                  className="w-12 h-12 rounded-[14px] overflow-hidden bg-[#1E212B] flex items-center justify-center flex-shrink-0 cursor-pointer shadow-inner" 
                  style={{ backgroundColor: user.color || '#1E212B' }}
                >
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">{user.emoji || '👤'}</span>
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="What are you practicing today? Share updates or ask questions..."
                    className="w-full bg-transparent border-0 resize-none text-white text-[15px] placeholder-[#555861] focus:outline-none focus:ring-0 min-h-[64px] font-medium leading-relaxed"
                    maxLength={400}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#1E212B] pt-4 mt-4">
                <span className="text-[10px] text-[#555861] font-bold tracking-[0.1em] uppercase">
                  {postText.length} / 400 chars
                </span>
                <button
                  type="submit"
                  disabled={submitting || !postText.trim()}
                  className="px-5 py-2 bg-[#212C45] text-[#60A5FA] border border-[#2A3B5C] text-[13px] font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none hover:bg-[#2A3B5C] hover:text-white"
                >
                  {submitting ? 'Posting...' : 'Post Share'}
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-6 text-center mb-10 shadow-xl">
            <AlertCircle className="w-8 h-8 text-[#555861] mx-auto mb-3" />
            <h3 className="text-white font-semibold text-[15px] mb-1">Join the community</h3>
            <p className="text-[#888A92] text-sm">Sign in to share posts and like other practice shares.</p>
          </div>
        )}

        {/* Posts Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-[#1E212B] border-t-[#3B82F6] rounded-full animate-spin"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-8 shadow-xl">
            <MessageSquare className="w-10 h-10 text-[#555861] mx-auto mb-4" />
            <h3 className="text-white font-semibold text-[15px] mb-1">No posts yet</h3>
            <p className="text-[#888A92] text-sm">Be the first to share an update!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              const isLiked = post.likes?.includes(user?.id);
              const isAuthor = post.userId === user?.id;

              return (
                <div key={post.id} className="bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-5 hover:border-[#2A2E3B] hover:bg-[#0E1118] transition-all shadow-xl group">
                  <div className="flex gap-4">
                    {/* Author Avatar */}
                    <div 
                      onClick={() => openUserProfile(post.userId)}
                      className="w-12 h-12 rounded-[14px] overflow-hidden bg-[#1E212B] flex items-center justify-center flex-shrink-0 cursor-pointer shadow-inner" 
                      style={{ backgroundColor: post.authorColor || '#1E212B' }}
                    >
                      {post.authorPhotoUrl ? (
                        <img src={post.authorPhotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{post.authorEmoji || '👤'}</span>
                      )}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span 
                          onClick={() => openUserProfile(post.userId)}
                          className="font-bold text-white text-[15px] cursor-pointer hover:text-[#3B82F6] transition-colors tracking-tight"
                        >
                          {post.authorName}
                        </span>
                        <span className="text-[11px] text-[#555861] font-semibold tracking-wide">
                          {formatPostTime(post.createdAt)}
                        </span>
                      </div>
                      
                      <p className="text-[#D1D3D8] text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                        {post.text}
                      </p>

                      {/* Post Actions */}
                      <div className="flex items-center gap-6 mt-5 border-t border-[#1E212B] pt-3 group-hover:border-[#2A2E3B] transition-colors">
                        <button
                          onClick={() => handleToggleLike(post.id, post.likes)}
                          className={`flex items-center gap-2 text-[13px] font-semibold transition-colors ${isLiked ? 'text-red-500' : 'text-[#555861] hover:text-red-400'}`}
                        >
                          <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-red-500 text-red-500' : ''}`} strokeWidth={isLiked ? 0 : 2} />
                          <span>{post.likes?.length || 0}</span>
                        </button>

                        {isAuthor && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="ml-auto text-[#555861] hover:text-[#888A92] transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Post"
                          >
                            <Trash2 className="w-[18px] h-[18px]" strokeWidth={2} />
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
      
      {/* Floating Plus Button for mobile could go here, but let's keep it clean as per UI */}
    </div>
  );
}
