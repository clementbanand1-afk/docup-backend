import { Router } from 'express';
import { stripe } from '../services/stripeClient';
import { db } from '../db';

const router = Router();

// ============================================================
// ⚠️ Cette route reçoit le corps BRUT de la requête (express.raw,
// monté avant express.json() dans index.ts) — indispensable pour que
// stripe.webhooks.constructEvent() puisse vérifier la signature
// cryptographique. Si jamais reformaté en JSON avant d'arriver ici,
// la vérification échoue systématiquement.
//
// Réutilise l'infrastructure SQLite déjà en place, mais avec sa PROPRE
// table (web_document_unlocks) — surtout PAS la table `subscriptions`
// (réservée aux abonnements illimités RevenueCat côté mobile).
// ============================================================

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

router.post('/', (req, res) => {
  const signature = req.headers['stripe-signature'] as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Signature webhook Stripe invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const deviceId = session.metadata?.deviceId;
    const templateTitle = session.metadata?.templateTitle ?? null;

    if (deviceId) {
      db.prepare(
        `INSERT INTO web_document_unlocks (deviceId, templateTitle, unlockedAtISO) VALUES (?, ?, ?)`
      ).run(deviceId, templateTitle, new Date().toISOString());
    }
  }

  res.json({ received: true });
});

export default router;
