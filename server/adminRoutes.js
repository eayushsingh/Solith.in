import express from 'express';
import { initFirebaseAdmin, verifyAdmin } from './firebaseAdmin.js';

export default function setupAdminRoutes(app, rooms, saveDB, io) {
  const router = express.Router();

  router.use(verifyAdmin); // All routes in this router require admin role

  // Helper to log admin actions
  const logAdminAction = async (db, adminId, adminEmail, action, targetId, details) => {
    try {
      await db.collection('admin_logs').add({
        adminId,
        adminEmail,
        action,
        targetId,
        details,
        timestamp: initFirebaseAdmin().firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  };

  // 1. GET /api/admin/stats
  router.get('/stats', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) {
      return res.json({
        usersTotal: 124,
        activeRooms: rooms.length,
        reportsTotal: 12,
        reportsPending: 3
      });
    }

    try {
      const db = adminInstance.firestore();
      const usersCount = (await db.collection('users').count().get()).data().count;
      const reportsCount = (await db.collection('reports').count().get()).data().count;
      const pendingReportsCount = (await db.collection('reports').where('status', '==', 'pending').count().get()).data().count;
      const activeRoomsCount = rooms.length;
      
      res.json({
        usersTotal: usersCount,
        activeRooms: activeRoomsCount,
        reportsTotal: reportsCount,
        reportsPending: pendingReportsCount
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // 2. GET /api/admin/users
  router.get('/users', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) {
      return res.json({ users: [
        { id: '1', name: 'Ayush Singh', email: 'ayushfun01@gmail.com', role: 'admin', isRestricted: false, isBanned: false, warningCount: 0, isPremium: true },
        { id: '2', name: 'Bad User', email: 'spam@spam.com', role: 'user', isRestricted: true, isBanned: false, warningCount: 3, isPremium: false }
      ]});
    }
    try {
      const db = adminInstance.firestore();
      const usersSnap = await db.collection('users').orderBy('createdAt', 'desc').limit(100).get();
      const users = [];
      usersSnap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
      res.json({ users });
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // 3. POST /api/admin/users/:id/action
  router.post('/users/:id/action', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    const { id } = req.params;
    const { action } = req.body; // 'restrict', 'ban', 'reinstate', 'promote', 'make_pro', 'remove_pro'
    
    if (!['restrict', 'ban', 'reinstate', 'promote', 'make_pro', 'remove_pro'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    try {
      const db = adminInstance.firestore();
      const userRef = db.collection('users').doc(id);
      const updates = {};
      
      if (action === 'restrict') updates.isRestricted = true;
      if (action === 'ban') updates.isBanned = true;
      if (action === 'reinstate') {
        updates.isRestricted = false;
        updates.isBanned = false;
        updates.warningCount = 0;
      }
      if (action === 'promote') updates.role = 'admin';
      if (action === 'make_pro') updates.isPremium = true;
      if (action === 'remove_pro') updates.isPremium = false;

      await userRef.update(updates);

      if (action === 'ban') {
        try {
          await adminInstance.auth().updateUser(id, { disabled: true });
        } catch (authErr) {
          console.error('Failed to disable auth user:', authErr);
        }
      } else if (action === 'reinstate') {
        try {
          await adminInstance.auth().updateUser(id, { disabled: false });
        } catch (authErr) {
          console.error('Failed to enable auth user:', authErr);
        }
      }

      await logAdminAction(db, req.adminData.id, req.adminData.email, `user_${action}`, id, `Admin manually applied ${action}`);

      res.json({ success: true, updates });
    } catch (error) {
      console.error(`Error applying action ${action}:`, error);
      res.status(500).json({ error: 'Action failed' });
    }
  });

  // 3b. POST /api/admin/users/:id/subscription
  router.post('/users/:id/subscription', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    const { id } = req.params;
    const { action } = req.body; // 'grant', 'revoke'

    if (!adminInstance) {
      return res.json({ success: true, message: 'Mock mode success' });
    }

    if (!['grant', 'revoke'].includes(action)) {
      return res.status(400).json({ error: 'Invalid subscription action' });
    }

    try {
      const db = adminInstance.firestore();
      const userRef = db.collection('users').doc(id);
      
      const isPremium = action === 'grant';
      await userRef.update({ isPremium });
      
      await logAdminAction(db, req.adminData.id, req.adminData.email, `subscription_${action}`, id, `Admin ${action}ed premium subscription`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating subscription:', error);
      res.status(500).json({ error: 'Subscription update failed' });
    }
  });

  // 4. GET /api/admin/reports
  router.get('/reports', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) {
      return res.json({ reports: [
        { id: 'r1', status: 'pending', reporterName: 'Alice', reportedUserName: 'Bob', reportedUserId: 'bob123', roomName: 'English Practice', reason: 'Harassment', details: 'Being very rude', timestamp: { seconds: Date.now()/1000 } }
      ]});
    }
    try {
      const db = adminInstance.firestore();
      const reportsSnap = await db.collection('reports').orderBy('timestamp', 'desc').limit(100).get();
      const reports = [];
      reportsSnap.forEach(doc => reports.push({ id: doc.id, ...doc.data() }));
      res.json({ reports });
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });

  // 5. POST /api/admin/reports/:id/action
  router.post('/reports/:id/action', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    const { id } = req.params;
    const { action, reportedUserId } = req.body; // 'dismiss', 'warn', 'restrict', 'ban'
    
    if (!['dismiss', 'warn', 'restrict', 'ban'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    try {
      const db = adminInstance.firestore();
      
      const reportStatus = action === 'dismiss' ? 'dismissed' : 'reviewed';
      await db.collection('reports').doc(id).update({ status: reportStatus });

      if (action !== 'dismiss' && reportedUserId) {
        const userRef = db.collection('users').doc(reportedUserId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          const updates = {};
          
          if (action === 'warn') {
            updates.warningCount = (userData.warningCount || 0) + 1;
          } else if (action === 'restrict') {
            updates.isRestricted = true;
            updates.warningCount = (userData.warningCount || 0) + 1;
          } else if (action === 'ban') {
            updates.isBanned = true;
            try {
              await adminInstance.auth().updateUser(reportedUserId, { disabled: true });
            } catch (e) {}
          }
          
          await userRef.update(updates);
        }
      }

      await logAdminAction(db, req.adminData.id, req.adminData.email, `report_${action}`, reportedUserId, `Resolved report ${id} with action: ${action}`);

      res.json({ success: true });
    } catch (error) {
      console.error('Error processing report:', error);
      res.status(500).json({ error: 'Action failed' });
    }
  });

  // 6. GET /api/admin/rooms
  router.get('/rooms', (req, res) => {
    res.json({ rooms });
  });

  // 7. DELETE /api/admin/rooms/:id
  router.delete('/rooms/:id', async (req, res) => {
    const { id } = req.params;
    const roomIndex = rooms.findIndex(r => r.id === id);
    
    if (roomIndex === -1) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = rooms[roomIndex];
    
    io.to(id).emit('room-deleted');
    rooms.splice(roomIndex, 1);
    saveDB();

    const adminInstance = initFirebaseAdmin();
    if (adminInstance) {
      await logAdminAction(adminInstance.firestore(), req.adminData.id, req.adminData.email, 'room_force_close', id, `Force closed room: ${room.name}`);
    }

    res.json({ success: true });
  });

  // 8. GET /api/admin/logs
  router.get('/logs', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) {
      return res.json({ logs: [
        { id: 'l1', adminEmail: 'ayushfun01@gmail.com', action: 'user_ban', targetId: 'spam123', details: 'Admin manually applied ban', timestamp: { seconds: Date.now()/1000 } }
      ]});
    }
    try {
      const db = adminInstance.firestore();
      const logsSnap = await db.collection('admin_logs').orderBy('timestamp', 'desc').limit(100).get();
      const logs = [];
      logsSnap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
      res.json({ logs });
    } catch (error) {
      console.error('Error fetching admin logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // 9. GET /api/admin/payments
  router.get('/payments', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) {
      return res.json({ payments: [] });
    }
    try {
      const db = adminInstance.firestore();
      const paymentsSnap = await db.collection('payment_requests').orderBy('submittedAt', 'desc').limit(100).get();
      const payments = [];
      paymentsSnap.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));
      res.json({ payments });
    } catch (error) {
      console.error('Error fetching admin payments:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  // 10. POST /api/admin/payments/:id/approve
  router.post('/payments/:id/approve', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) return res.status(500).json({ error: 'No DB access' });
    
    const { id } = req.params;
    try {
      const db = adminInstance.firestore();
      const paymentRef = db.collection('payment_requests').doc(id);
      
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(paymentRef);
        if (!doc.exists) throw new Error('Payment request not found');
        
        const data = doc.data();
        if (data.status !== 'PENDING') throw new Error('Payment is not pending');

        const settingsDoc = await transaction.get(db.collection('settings').doc('global'));
        const settings = settingsDoc.exists ? settingsDoc.data() : { premiumDurationDays: 30 };
        const durationDays = parseInt(settings.premiumDurationDays, 10) || 30;

        const now = new Date();
        const expiresAt = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));
        
        // Mark payment as approved
        transaction.update(paymentRef, {
          status: 'APPROVED',
          reviewedAt: adminInstance.firestore.FieldValue.serverTimestamp(),
          reviewedBy: req.adminData.email
        });

        // Update user to premium
        const userRef = db.collection('users').doc(data.userId);
        transaction.update(userRef, {
          isPremium: true,
          premiumPlan: 'PREMIUM',
          premiumExpiresAt: expiresAt
        });
        
        logAdminAction(db, req.adminData.id, req.adminData.email, 'payment_approve', id, `Approved payment ${id} for user ${data.userId}`);
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error approving payment:', error);
      res.status(500).json({ error: error.message || 'Approval failed' });
    }
  });

  // 11. POST /api/admin/payments/:id/reject
  router.post('/payments/:id/reject', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) return res.status(500).json({ error: 'No DB access' });
    
    const { id } = req.params;
    const { reason } = req.body;
    try {
      const db = adminInstance.firestore();
      const paymentRef = db.collection('payment_requests').doc(id);
      
      await paymentRef.update({
        status: 'REJECTED',
        rejectionReason: reason || 'Payment could not be verified.',
        reviewedAt: adminInstance.firestore.FieldValue.serverTimestamp(),
        reviewedBy: req.adminData.email
      });

      await logAdminAction(db, req.adminData.id, req.adminData.email, 'payment_reject', id, `Rejected payment ${id} (Reason: ${reason})`);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error rejecting payment:', error);
      res.status(500).json({ error: 'Rejection failed' });
    }
  });

  // 12. GET /api/admin/settings
  router.get('/settings', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) return res.json({ premiumPrice: 99, premiumDurationDays: 30, qrCodeUrl: "/qr-placeholder.png", premiumVisibilityBoost: true });
    
    try {
      const db = adminInstance.firestore();
      const doc = await db.collection('settings').doc('global').get();
      if (!doc.exists) {
        return res.json({ premiumPrice: 99, premiumDurationDays: 30, qrCodeUrl: "/qr-placeholder.png", premiumVisibilityBoost: true });
      }
      res.json(doc.data());
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  // 13. POST /api/admin/settings
  router.post('/settings', async (req, res) => {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) return res.status(500).json({ error: 'No DB access' });
    
    const { premiumPrice, premiumDurationDays, qrCodeUrl, premiumVisibilityBoost } = req.body;
    try {
      const db = adminInstance.firestore();
      const settingsRef = db.collection('settings').doc('global');
      
      const newSettings = {
        premiumPrice: Number(premiumPrice) || 99,
        premiumDurationDays: Number(premiumDurationDays) || 30,
        qrCodeUrl: qrCodeUrl || "/qr-placeholder.png",
        premiumVisibilityBoost: !!premiumVisibilityBoost
      };
      
      await settingsRef.set(newSettings, { merge: true });
      await logAdminAction(db, req.adminData.id, req.adminData.email, 'update_settings', 'global', `Updated platform settings`);
      
      res.json({ success: true, settings: newSettings });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  app.use('/api/admin', router);
}
