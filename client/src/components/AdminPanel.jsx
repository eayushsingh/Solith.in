import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldAlert, Check, X, AlertCircle, Users, LayoutDashboard, Flag, Activity, Trash2, Shield, Search, Award } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-300 hover:text-white">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel({ onBack, user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [reports, setReports] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null });

  const fetchWithToken = async (endpoint, options = {}) => {
    if (!user || !user.token) return null;
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error('API request failed');
    return res.json();
  };

  const loadData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const data = await fetchWithToken('/api/admin/stats');
        setStats(data);
      } else if (tab === 'users') {
        const data = await fetchWithToken('/api/admin/users');
        setUsersList(data.users || []);
      } else if (tab === 'reports') {
        const data = await fetchWithToken('/api/admin/reports');
        setReports(data.reports || []);
      } else if (tab === 'rooms') {
        const data = await fetchWithToken('/api/admin/rooms');
        setRooms(data.rooms || []);
      } else if (tab === 'logs') {
        const data = await fetchWithToken('/api/admin/logs');
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const requestConfirm = (title, message, action) => {
    setConfirmDialog({ isOpen: true, title, message, action });
  };

  const handleUserAction = async (targetId, action) => {
    try {
      await fetchWithToken(`/api/admin/users/${targetId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      loadData('users'); // reload
    } catch (e) {
      alert("Action failed");
    }
  };

  const handleReportAction = async (reportId, action, reportedUserId) => {
    try {
      await fetchWithToken(`/api/admin/reports/${reportId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, reportedUserId })
      });
      loadData('reports');
    } catch (e) {
      alert("Action failed");
    }
  };

  const handleForceCloseRoom = async (roomId) => {
    try {
      await fetchWithToken(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
      loadData('rooms');
    } catch (e) {
      alert("Action failed");
    }
  };

  const handleSubscriptionAction = async (userId, action) => {
    try {
      await fetchWithToken(`/api/admin/users/${userId}/subscription`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      loadData('users'); // reload users list to update premium status
    } catch (e) {
      alert("Action failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-mono">
      <ConfirmDialog 
        {...confirmDialog} 
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          confirmDialog.action();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#111] border-b border-red-900/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-[#222] rounded-full transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-red-500">
            <ShieldAlert className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-widest uppercase">Admin Dashboard</h1>
          </div>
        </div>
        <div className="text-xs text-gray-500">Logged in as {user?.email}</div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <div className="w-64 bg-[#111] border-r border-red-900/20 p-4 flex flex-col gap-2">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
            { id: 'users', icon: Users, label: 'Users' },
            { id: 'reports', icon: Flag, label: 'Reports Queue' },
            { id: 'rooms', icon: Activity, label: 'Active Rooms' },
            { id: 'subscriptions', icon: Award, label: 'Subscriptions' },
            { id: 'logs', icon: Shield, label: 'Activity Log' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                activeTab === tab.id 
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                  : 'text-gray-400 hover:bg-[#222] hover:text-white border border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">Loading data...</div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Platform Overview</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-[#151515] p-6 rounded-2xl border border-gray-800">
                      <div className="text-gray-400 text-sm mb-2">Total Users</div>
                      <div className="text-4xl font-bold text-white">{stats.usersTotal}</div>
                    </div>
                    <div className="bg-[#151515] p-6 rounded-2xl border border-gray-800">
                      <div className="text-gray-400 text-sm mb-2">Active Rooms</div>
                      <div className="text-4xl font-bold text-blue-400">{stats.activeRooms}</div>
                    </div>
                    <div className="bg-[#151515] p-6 rounded-2xl border border-gray-800">
                      <div className="text-gray-400 text-sm mb-2">Total Reports</div>
                      <div className="text-4xl font-bold text-white">{stats.reportsTotal}</div>
                    </div>
                    <div className="bg-[#151515] p-6 rounded-2xl border border-red-900/50">
                      <div className="text-red-400 text-sm mb-2">Pending Reports</div>
                      <div className="text-4xl font-bold text-red-500">{stats.reportsPending}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* USERS TAB */}
              {activeTab === 'users' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Manage Users</h2>
                  <div className="bg-[#151515] rounded-2xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#222] text-gray-400 uppercase text-xs">
                        <tr>
                          <th className="px-6 py-4">Name / Email</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Warnings</th>
                          <th className="px-6 py-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {usersList.map(u => (
                          <tr key={u.id} className="hover:bg-[#1a1a1a]">
                            <td className="px-6 py-4">
                              <div className="font-bold text-white">{u.name}</div>
                              <div className="text-gray-500 text-xs">{u.email}</div>
                              {u.role === 'admin' && <span className="inline-block mt-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded">ADMIN</span>}
                            </td>
                            <td className="px-6 py-4">
                              {u.isBanned ? (
                                <span className="text-red-500 font-bold">Banned</span>
                              ) : u.isRestricted ? (
                                <span className="text-orange-500 font-bold">Restricted</span>
                              ) : (
                                <span className="text-green-500">Active</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-400">{u.warningCount || 0}</td>
                            <td className="px-6 py-4 space-x-2">
                              {u.isBanned || u.isRestricted ? (
                                <button onClick={() => handleUserAction(u.id, 'reinstate')} className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-white transition-colors">Reinstate</button>
                              ) : (
                                <>
                                  <button onClick={() => handleUserAction(u.id, 'restrict')} className="text-xs px-3 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded transition-colors">Restrict</button>
                                  <button 
                                    onClick={() => requestConfirm("Ban User?", `Are you sure you want to ban ${u.name}? They will not be able to log in.`, () => handleUserAction(u.id, 'ban'))}
                                    className="text-xs px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                  >
                                    Ban
                                  </button>
                                </>
                              )}
                              {u.role !== 'admin' && (
                                <button 
                                  onClick={() => requestConfirm("Promote to Admin?", `Are you absolutely sure you want to give ${u.name} full admin access?`, () => handleUserAction(u.id, 'promote'))}
                                  className="text-xs px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                                >
                                  Promote
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBSCRIPTIONS TAB */}
              {activeTab === 'subscriptions' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Manage Subscriptions</h2>
                  <div className="bg-[#151515] rounded-2xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#222] text-gray-400 uppercase text-xs">
                        <tr>
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Subscription Status</th>
                          <th className="px-6 py-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {usersList.map(u => (
                          <tr key={u.id} className="hover:bg-[#1a1a1a]">
                            <td className="px-6 py-4">
                              <div className="font-bold text-white">{u.name}</div>
                              <div className="text-gray-500 text-xs">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              {u.isPremium ? (
                                <span className="inline-flex items-center gap-1 text-yellow-500 font-bold bg-yellow-500/10 px-2 py-1 rounded">
                                  <Award className="w-3 h-3" />
                                  Premium
                                </span>
                              ) : (
                                <span className="text-gray-500">Free Tier</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {u.isPremium ? (
                                <button 
                                  onClick={() => requestConfirm("Revoke Premium?", `Are you sure you want to remove premium access from ${u.name}?`, () => handleSubscriptionAction(u.id, 'revoke'))}
                                  className="text-xs px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                >
                                  Revoke Premium
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleSubscriptionAction(u.id, 'grant')}
                                  className="text-xs px-3 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded transition-colors"
                                >
                                  Grant Premium
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* REPORTS TAB */}
              {activeTab === 'reports' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Reports Queue</h2>
                  <div className="space-y-4">
                    {reports.length === 0 ? (
                      <div className="text-gray-500">No reports found.</div>
                    ) : (
                      reports.map(report => (
                        <div key={report.id} className="bg-[#151515] p-5 rounded-2xl border border-gray-800 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${report.status === 'pending' ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
                                {report.status || 'pending'}
                              </span>
                              <span className="text-xs text-gray-500">{new Date(report.timestamp?.seconds * 1000 || Date.now()).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-gray-300"><strong>Reporter:</strong> {report.reporterName}</p>
                            <p className="text-sm text-gray-300"><strong>Reported:</strong> {report.reportedUserName}</p>
                            <p className="text-sm text-gray-300"><strong>Room:</strong> {report.roomName || 'Unknown'}</p>
                            <div className="mt-2 bg-[#1a1a1a] p-3 rounded text-sm text-gray-400 border border-gray-800">
                              <span className="text-red-400 font-bold mr-2">{report.reason}</span>
                              {report.details}
                            </div>
                          </div>
                          
                          {report.status === 'pending' && (
                            <div className="flex flex-col gap-2 min-w-[120px]">
                              <button onClick={() => handleReportAction(report.id, 'dismiss', report.reportedUserId)} className="text-xs px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded">Dismiss</button>
                              <button onClick={() => handleReportAction(report.id, 'warn', report.reportedUserId)} className="text-xs px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded">Warn User</button>
                              <button onClick={() => handleReportAction(report.id, 'restrict', report.reportedUserId)} className="text-xs px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded">Restrict</button>
                              <button 
                                onClick={() => requestConfirm("Ban User?", `Ban ${report.reportedUserName} for this report?`, () => handleReportAction(report.id, 'ban', report.reportedUserId))}
                                className="text-xs px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded"
                              >
                                Ban
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ROOMS TAB */}
              {activeTab === 'rooms' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Active Rooms</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rooms.length === 0 ? (
                      <div className="text-gray-500">No active rooms.</div>
                    ) : (
                      rooms.map(room => (
                        <div key={room.id} className="bg-[#151515] p-5 rounded-2xl border border-gray-800 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-bold text-lg text-white">{room.name}</h3>
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">{room.participants?.length || 0}/8</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">{room.topic || 'No topic'}</p>
                          </div>
                          <button 
                            onClick={() => requestConfirm("Force Close Room?", `Are you sure you want to nuke "${room.name}"? Everyone will be kicked instantly.`, () => handleForceCloseRoom(room.id))}
                            className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Force Close
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* LOGS TAB */}
              {activeTab === 'logs' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Activity Log</h2>
                  <div className="bg-[#151515] rounded-2xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#222] text-gray-400 uppercase text-xs">
                        <tr>
                          <th className="px-6 py-4">Time</th>
                          <th className="px-6 py-4">Admin</th>
                          <th className="px-6 py-4">Action</th>
                          <th className="px-6 py-4">Target / Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {logs.length === 0 ? (
                          <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No logs found.</td></tr>
                        ) : (
                          logs.map(log => (
                            <tr key={log.id} className="hover:bg-[#1a1a1a]">
                              <td className="px-6 py-4 text-gray-500 text-xs">
                                {new Date(log.timestamp?.seconds * 1000 || Date.now()).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 font-bold text-white text-xs">{log.adminEmail}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-[#222] text-gray-300 rounded text-[10px] uppercase tracking-wider border border-gray-700">
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-400 text-xs">
                                <div>{log.details}</div>
                                <div className="text-[10px] text-gray-600 mt-1">ID: {log.targetId}</div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
