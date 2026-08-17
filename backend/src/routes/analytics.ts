import { Router } from 'express';
import { db } from '../db';

const router = Router();

router.post('/event', (req, res) => {
  const { name, properties, deviceId, timestampISO } = req.body as {
    name: string;
    properties?: Record<string, unknown>;
    deviceId: string;
    timestampISO: string;
  };

  if (!name || !deviceId) {
    return res.status(400).json({ error: 'name et deviceId requis' });
  }

  db.prepare(
    'INSERT INTO analytics_events (deviceId, name, properties, timestampISO) VALUES (?, ?, ?, ?)'
  ).run(deviceId, name, JSON.stringify(properties ?? {}), timestampISO ?? new Date().toISOString());

  res.json({ success: true });
});

// Petit tableau de bord texte pour consulter le funnel sans installer
// d'outil BI — pratique pour un premier lancement. Exemple :
// GET /api/analytics/funnel
router.get('/funnel', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT name, COUNT(*) as count, COUNT(DISTINCT deviceId) as uniqueDevices
       FROM analytics_events
       GROUP BY name
       ORDER BY count DESC`
    )
    .all();
  res.json({ funnel: rows });
});

export default router;
