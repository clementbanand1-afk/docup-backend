import { Router } from 'express';
import { db } from '../db';

const router = Router();

router.post('/register-token', (req, res) => {
  const { deviceId, pushToken, platform } = req.body as {
    deviceId: string;
    pushToken: string;
    platform?: string;
  };

  if (!deviceId || !pushToken) {
    return res.status(400).json({ error: 'deviceId et pushToken requis' });
  }

  db.prepare(
    `INSERT INTO push_tokens (deviceId, pushToken, platform, updatedAtISO)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(deviceId) DO UPDATE SET pushToken = excluded.pushToken, platform = excluded.platform, updatedAtISO = excluded.updatedAtISO`
  ).run(deviceId, pushToken, platform ?? null, new Date().toISOString());

  res.json({ success: true });
});

export default router;
