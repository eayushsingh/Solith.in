import React from 'react';
import { X, Shield, MessageSquare, Info } from 'lucide-react';

export default function StaticModals({ activeModal, closeModal }) {
  if (!activeModal) return null;

  let title = '';
  let icon = null;
  let content = null;

  switch (activeModal) {
    case 'privacy':
      title = 'Privacy Policy';
      icon = <Shield className="w-5 h-5 text-blue-400" />;
      content = (
        <div className="space-y-4 text-sm text-text-secondary">
          <p>At solith.in, your privacy is our top priority. We do not sell your personal data to third parties.</p>
          <p><strong>Voice Data:</strong> All audio streams in voice rooms are transmitted using WebRTC protocols. We do not record or store your voice conversations on our servers unless explicitly stated for moderation purposes.</p>
          <p><strong>Account Information:</strong> We store basic profile information (like your Google account email and avatar) solely for account management and community safety features.</p>
          <p><strong>Cookies:</strong> We use strictly necessary cookies to keep you logged in and ensure application security.</p>
        </div>
      );
      break;
    case 'contact':
      title = 'Contact Us';
      icon = <MessageSquare className="w-5 h-5 text-red-400" />;
      content = (
        <div className="space-y-4 text-sm text-text-secondary">
          <p>Need help, found a bug, or just want to say hi?</p>
          <p>You can reach out to the solith.in team at:</p>
          <div className="p-4 bg-bg-base/40 rounded-lg border border-white/10 font-mono text-center text-text-primary">
            support@talkfree.example.com
          </div>
          <p>We typically respond within 24-48 hours. For urgent moderation issues, please use the in-app reporting tools located in the voice rooms.</p>
        </div>
      );
      break;
    case 'about':
      title = 'About Us';
      icon = <Info className="w-5 h-5 text-purple-400" />;
      content = (
        <div className="space-y-4 text-sm text-text-secondary">
          <p>solith.in was built with a simple mission: to connect language learners around the world through free, high-quality voice conversations.</p>
          <p>Whether you're practicing English for an upcoming interview, trying to pick up conversational Spanish, or helping others learn your native tongue, our platform provides a safe, low-latency environment to practice real-world speaking.</p>
          <p className="text-center font-bold text-text-primary mt-4">Built with ❤️ for the global language community.</p>
        </div>
      );
      break;
    default:
      return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm"
        onClick={closeModal}
      />
      
      {/* Modal */}
      <div className="relative bg-bg-surface border border-border-color rounded-2xl w-full max-w-md overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-color bg-white/5">
          <div className="flex items-center gap-3">
            {icon}
            <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          </div>
          <button 
            onClick={closeModal}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          {content}
        </div>
        
        {/* Footer */}
        <div className="p-5 border-t border-border-color flex justify-end">
          <button 
            onClick={closeModal}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-text-primary font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
