import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldAlert, Check, X, AlertCircle } from 'lucide-react';
import { db, collection, query, orderBy, getDocs, doc, updateDoc, getDoc, where } from '../firebase';

const ADMIN_EMAILS = ['ayushfun01@gmail.com', 'hacksejeet@gmail.com', 'ayush.singh.something@klh.edu.in'];

export default function AdminPanel({ onBack, user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--ink)]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-[var(--ink-secondary)] mt-2">You do not have permission to view this page.</p>
          <button onClick={onBack} className="mt-6 text-[var(--accent)] hover:underline">Go Back</button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'reports'), where('status', '==', 'pending'));
      const querySnapshot = await getDocs(q);
      const fetchedReports = [];
      querySnapshot.forEach((doc) => {
        fetchedReports.push({ id: doc.id, ...doc.data() });
      });
      // Sort in memory by timestamp since orderBy requires an index if mixed with where clause on a different field
      fetchedReports.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setReports(fetchedReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkValid = async (report) => {
    try {
      // 1. Update report status
      await updateDoc(doc(db, 'reports', report.id), { status: 'valid' });
      
      // 2. Fetch the reported user's doc to increment warning count
      const userRef = doc(db, 'users', report.reportedUserId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const currentWarnings = userData.warningCount || 0;
        const newWarnings = currentWarnings + 1;
        
        // 3. Auto-restrict if warnings >= 3
        const updates = { warningCount: newWarnings };
        if (newWarnings >= 3) {
          updates.isRestricted = true;
        }
        
        await updateDoc(userRef, updates);
      }
      
      // Remove from UI
      setReports(reports.filter(r => r.id !== report.id));
    } catch (error) {
      console.error("Error marking valid:", error);
      alert("Failed to process report.");
    }
  };

  const handleDismiss = async (reportId) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'dismissed' });
      setReports(reports.filter(r => r.id !== reportId));
    } catch (error) {
      console.error("Error dismissing:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] font-sans py-8 px-6">
      <div className="w-full max-w-4xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[var(--ink-tertiary)] hover:text-[var(--accent)] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Enforcement Dashboard</h1>
            <p className="text-[var(--ink-secondary)] mt-1">Review and process community reports.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-[var(--ink-tertiary)] py-12 text-center animate-pulse">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="border border-[var(--line-subtle)] bg-[var(--bg-secondary)] rounded-2xl p-12 text-center">
            <ShieldAlert className="w-8 h-8 text-[var(--ink-tertiary)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--ink)]">No pending reports</h3>
            <p className="text-sm text-[var(--ink-secondary)] mt-1">The community is peaceful right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-[var(--bg-secondary)] border border-[var(--line-subtle)] rounded-xl p-5 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500">
                      {report.reason}
                    </span>
                    <span className="text-xs text-[var(--ink-tertiary)]">
                      {report.timestamp?.toDate().toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-base font-medium text-[var(--ink)]">
                    Reported User: <span className="font-bold">{report.reportedUserName}</span>
                  </h4>
                  <p className="text-sm text-[var(--ink-secondary)] mt-1">
                    Reported by {report.reporterName} in room: <span className="font-mono text-xs">{report.roomId}</span>
                  </p>
                </div>
                
                <div className="flex gap-2 shrink-0 mt-4 md:mt-0">
                  <button 
                    onClick={() => handleDismiss(report.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--line-subtle)] text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <X className="w-4 h-4"/> Dismiss
                  </button>
                  <button 
                    onClick={() => handleMarkValid(report)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <Check className="w-4 h-4"/> Mark Valid
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
