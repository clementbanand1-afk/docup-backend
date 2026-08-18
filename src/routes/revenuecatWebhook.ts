import { Router } from 'express';
import { db } from '../db';

const router = Router();

// ============================================================
// RevenueCat envoie un événement HTTP à chaque changement d'état
// d'abonnement (achat, renouvellement, annulation, expiration...).
// C'est la SEULE source fiable côté serveur pour savoir si un
// utilisateur est vraiment Premium — le SDK client peut être trompé
// (app modifiée, appareil rooté/jailbreaké), un webhook signé non.
//
// Configuration côté RevenueCat (dashboard > Project Settings >
// Webhooks) : URL = https://ton-domaine.com/api/revenuecat/webhook,
// Authorization Header Value = la même valeur que
// REVENUECAT_WEBHOOK_SECRET ci-dessous.
//
// ⚠️ Pour que `app_user_id` corresponde à notre `deviceId`, il faut
// que le client appelle Purchases.configure({ appUserID: deviceId })
// (voir SubscriptionContext.tsx) — sans ça, RevenueCat génère un ID
// anonyme aléatoire déconnecté de notre système d'auth.
// ============================================================

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || 'CHANGE_ME_IN_PRODUCTION';

const ACTIVE_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE', // couvre aussi le Pass Document, sans effet sur `isPremium`
]);
const INACTIVE_EVENT_TYPES = new Set(['EXPIRATION']);

router.post('/webhook', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Signature webhook invalide' });
  }

  const event = req.body?.event;
  if (!event?.app_user_id || !event?.type) {
    return res.status(400).json({ error: 'Payload webhook incomplet' });
  }

  const deviceId = event.app_user_id as string;
  const eventType = event.type as string;

  // Les événements liés au Pass Document (non-renouvelable) ne changent
  // jamais le statut d'abonnement — seuls les événements d'abonnement
  // récurrent le font.
  if (event.product_id === 'docup_pass_document') {
    return res.json({ success: true, ignored: 'non-subscription product' });
  }

  if (ACTIVE_EVENT_TYPES.has(eventType)) {
    const expiresAtISO = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
    db.prepare(
      `INSERT INTO subscriptions (deviceId, isPremium, expiresAtISO, updatedAtISO)
       VALUES (?, 1, ?, ?)
       ON CONFLICT(deviceId) DO UPDATE SET isPremium = 1, expiresAtISO = excluded.expiresAtISO, updatedAtISO = excluded.updatedAtISO`
    ).run(deviceId, expiresAtISO, new Date().toISOString());
  } else if (INACTIVE_EVENT_TYPES.has(eventType)) {
    db.prepare(
      `INSERT INTO subscriptions (deviceId, isPremium, expiresAtISO, updatedAtISO)
       VALUES (?, 0, NULL, ?)
       ON CONFLICT(deviceId) DO UPDATE SET isPremium = 0, expiresAtISO = NULL, updatedAtISO = excluded.updatedAtISO`
    ).run(deviceId, new Date().toISOString());
  }
  // CANCELLATION : l'utilisateur reste actif jusqu'à expiration réelle,
  // on ne fait donc rien ici — EXPIRATION arrivera plus tard.

  res.json({ success: true });
});

export default router;
