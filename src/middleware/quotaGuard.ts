import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

// ============================================================
// Garde-fou serveur : même règle métier que côté app (2 docs/mois
// pour les non-Premium), appliquée indépendamment du client pour
// empêcher toute triche (app modifiée, requêtes directes, etc).
// Persisté en SQLite (voir db/index.ts) : survit aux redémarrages
// serveur, contrairement à l'ancienne Map() en mémoire.
//
// Le statut Premium est désormais vérifié via la table
// `subscriptions`, tenue à jour par les webhooks RevenueCat (voir
// routes/revenuecatWebhook.ts) — plus une simple valeur figée à
// `false` comme avant.
// ============================================================

const FREE_LIMIT_PER_MONTH = 2;

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isPremiumUser(deviceId: string): boolean {
  const row = db
    .prepare('SELECT isPremium, expiresAtISO FROM subscriptions WHERE deviceId = ?')
    .get(deviceId) as { isPremium: number; expiresAtISO: string | null } | undefined;
  if (!row || !row.isPremium) return false;
  if (row.expiresAtISO && new Date(row.expiresAtISO).getTime() < Date.now()) return false;
  return true;
}

export async function quotaGuard(req: Request, res: Response, next: NextFunction) {
  const deviceId = req.headers.authorization?.replace('Bearer ', '');
  if (!deviceId) {
    return res.status(401).json({ error: 'Authentification manquante' });
  }

  if (isPremiumUser(deviceId)) {
    return next();
  }

  const monthKey = currentMonthKey();
  const row = db.prepare('SELECT monthKey, count FROM quota_usage WHERE deviceId = ?').get(deviceId) as
    | { monthKey: string; count: number }
    | undefined;

  if (!row || row.monthKey !== monthKey) {
    db.prepare(
      'INSERT INTO quota_usage (deviceId, monthKey, count) VALUES (?, ?, 1) ' +
        'ON CONFLICT(deviceId) DO UPDATE SET monthKey = excluded.monthKey, count = 1'
    ).run(deviceId, monthKey);
    return next();
  }

  if (row.count >= FREE_LIMIT_PER_MONTH) {
    return res.status(429).json({ error: 'QUOTA_EXCEEDED' });
  }

  db.prepare('UPDATE quota_usage SET count = count + 1 WHERE deviceId = ?').run(deviceId);
  next();
}
