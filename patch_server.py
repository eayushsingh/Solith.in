import sys
import re

with open("server/server.js", "r") as f:
    content = f.read()

target = """    const requestsSnap = await db.collection('payment_requests')
      .where('userId', '==', req.user.uid)
      .orderBy('submittedAt', 'desc')
      .limit(1)
      .get();
      
    if (requestsSnap.empty) {
      return res.json({ hasRequest: false });
    }
    
    const requestData = requestsSnap.docs[0].data();
    res.json({
      hasRequest: true,
      request: {
        id: requestsSnap.docs[0].id,
        status: requestData.status,
        utr: requestData.utr,
        submittedAt: requestData.submittedAt
      }
    });"""

replacement = """    const requestsSnap = await db.collection('payment_requests')
      .where('userId', '==', req.user.uid)
      .get();
      
    if (requestsSnap.empty) {
      return res.json({ hasRequest: false });
    }
    
    // Sort in memory to avoid needing a composite index
    const docs = requestsSnap.docs.sort((a, b) => b.data().submittedAt - a.data().submittedAt);
    const requestData = docs[0].data();
    res.json({
      hasRequest: true,
      request: {
        id: docs[0].id,
        status: requestData.status,
        utr: requestData.utr,
        submittedAt: requestData.submittedAt
      }
    });"""

if target in content:
    content = content.replace(target, replacement)
    with open("server/server.js", "w") as f:
        f.write(content)
    print("Patch applied to server/server.js successfully.")
else:
    print("Target block not found in server/server.js.")
