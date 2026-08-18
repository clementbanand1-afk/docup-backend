import { Request, Response, NextFunction } from 'express';

// ============================================================
// Contrairement à l'app mobile (1 document GRATUIT/mois), le site web
// est 100% payant à l'acte — chaque document généré doit pouvoir être
// payé, sans plafond mensuel. quotaGuard.ts (pensé pour le freemium
// mobile) serait donc incorrect ici : il bloquerait un visiteur prêt
// à payer pour un 2e document le même mois.
//
// Ce garde-fou ne limite PAS le modèle économique — il empêche juste
// l'abus technique (spam de génération gratuite en aperçu, qui coûte
// de l'API Claude sans jamais convertir). Fenêtre glissante en mémoire,
// volontairement simple : redémarre à 0 si le serveur redémarre, ce
// qui est sans conséquence pour de l'anti-abus (pas une donnée
// métier à préserver, contrairement au quota mobile).
// ============================================================

const MAX_REQUESTS_PER_WINDOW = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 heure

const requestLog = new Map<string, number[]>();

export function webRateLimitGuard(req: Request, res: Response, next: NextFunction) {
  const deviceId = req.headers.authorization?.replace('Bearer ', '');
  if (!deviceId) {
    return res.status(401).json({ error: 'Authentification manquante' });
  }

  const now = Date.now();
  const timestamps = (requestLog.get(deviceId) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'RATE_LIMITED', message: 'Trop de générations en peu de temps, réessaie dans un instant.' });
  }

  timestamps.push(now);
  requestLog.set(deviceId, timestamps);
  next();
}
