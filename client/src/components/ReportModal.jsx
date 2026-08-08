import React, { useState } from 'react';
import { Flag, X, ShieldCheck } from 'lucide-react';
import { db, collection, addDoc, serverTimestamp } from '../firebase';

export default function ReportModal({ isOpen, onClose, targetUser, currentUser, roomId }) {
  const [reason, setReason] = useState('Harassment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser.id,
        reporterName: currentUser.name,
        reporterEmail: currentUser.email,
        reportedUserId: targetUser.id,
        reportedUserName: targetUser.name,
        roomId: roomId || 'lobby',
        reason: reason,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Failed to submit report. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-[var(--bg)] border border-[var(--line-subtle)] rounded-2xl p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--ink)] mb-2">Report Submitted</h3>
            <p className="text-sm text-[var(--ink-secondary)]">Thank you for helping keep our community safe.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Flag className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--ink)]">Report User</h3>
                <p className="text-xs text-[var(--ink-tertiary)]">Reporting {targetUser.name}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-sm text-[var(--ink-secondary)]">
                Please select a reason for reporting this user. False reports may result in account restrictions.
              </p>
              <select 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--line-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="Harassment">Harassment or Hate Speech</option>
                <option value="Inappropriate">Inappropriate/Sexual Content</option>
                <option value="Spam">Spam or Trolling</option>
                <option value="Personal Info">Sharing Personal Info</option>
                <option value="Other">Other Violation</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-medium border border-[var(--line-subtle)] text-[var(--ink-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
