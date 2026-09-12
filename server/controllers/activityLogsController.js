import prisma from '../services/prisma.js';

export async function getActivityLogs(req, res) {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100
    });
    return res.json(logs || []);
  } catch (error) {
    console.error('getActivityLogs error:', error);
    return res.status(500).json({ error: 'Gagal memuat log aktivitas' });
  }
}

export async function createActivityLog(req, res) {
  try {
    const body = req.body || {};
    const actionText = typeof body === 'string' ? body : (body.action || JSON.stringify(body));
    const adminName = body.adminName || 'Admin TaniCo';

    const newLog = await prisma.activityLog.create({
      data: {
        adminName,
        action: actionText,
        timestamp: new Date()
      }
    });

    return res.status(201).json(newLog);
  } catch (error) {
    console.error('createActivityLog error:', error);
    return res.status(500).json({ error: 'Gagal membuat log aktivitas' });
  }
}
