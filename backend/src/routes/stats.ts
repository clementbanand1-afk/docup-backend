import { Router } from 'express';
import { db } from '../db';

const router = Router();

// ============================================================
// Compteur PUBLIC et RÉEL — jamais un chiffre inventé côté frontend.
// Compte les vraies générations web du jour (événement inséré dans
// routes/generate.ts). S'affichera à 0 au lancement, et grandira
// naturellement avec le vrai trafic — c'est le prix de l'honnêteté :
// pas de faux "42 documents générés aujourd'hui".
// ============================================================
router.get('/documents-today', (_req, res) => {
  const startOfDayISO = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();

  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM analytics_events
       WHERE name = 'document_generated_web' AND timestampISO >= ?`
    )
    .get(startOfDayISO) as { count: number };

  res.json({ count: row.count });
});

// Compteur cumulé depuis le lancement — même principe, aucun chiffre en dur.
router.get('/documents-total', (_req, res) => {
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM analytics_events WHERE name = 'document_generated_web'`)
    .get() as { count: number };

  res.json({ count: row.count });
});

export default router;
