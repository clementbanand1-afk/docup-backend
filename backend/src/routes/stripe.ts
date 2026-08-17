import { Router } from 'express';
import { stripe } from '../services/stripeClient';
import { db } from '../db';

const router = Router();

// ============================================================
// Prix Pass Document web : 4,99 € — DÉLIBÉRÉMENT différent du Pass
// mobile (1,99 €), car le web n'offre aucun document gratuit mensuel
// (contrairement à l'app), donc chaque vente porte la charge complète.
// Créer ce prix dans Stripe Dashboard (Produits > Ajouter, paiement
// unique, 4,99 €) puis coller son ID "price_..." dans la variable
// d'environnement Render STRIPE_PRICE_ID_PASS_DOCUMENT.
// ============================================================
const PRICE_ID_PASS_DOCUMENT = process.env.STRIPE_PRICE_ID_PASS_DOCUMENT || '';

router.post('/create-checkout-session', async (req, res) => {
  const { deviceId, productType, templateTitle, successUrl, cancelUrl, consentedToImmediateExecution } = req.body as {
    deviceId: string;
    productType: 'pass_document';
    templateTitle?: string;
    successUrl: string;
    cancelUrl: string;
    consentedToImmediateExecution: boolean;
  };

  if (!deviceId || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'deviceId, successUrl et cancelUrl requis' });
  }
  if (!PRICE_ID_PASS_DOCUMENT) {
    return res.status(500).json({ error: 'STRIPE_PRICE_ID_PASS_DOCUMENT non configuré côté serveur' });
  }
  // Le serveur EXIGE ce consentement, ne fait pas juste confiance au
  // frontend — Article L221-28 15° Code conso : la renonciation au droit
  // de rétractation doit être expresse, jamais présumée.
  if (consentedToImmediateExecution !== true) {
    return res.status(400).json({ error: 'CONSENT_REQUIRED', message: 'Consentement à l\'exécution immédiate requis avant paiement.' });
  }

  // Preuve horodatée du consentement, AVANT création de la session Stripe
  // (donc même si l'utilisateur abandonne le paiement ensuite, la preuve
  // qu'il a consenti à CE moment précis reste enregistrée).
  db.prepare(
    `INSERT INTO checkout_consents (deviceId, templateTitle, consentedAtISO) VALUES (?, ?, ?)`
  ).run(deviceId, templateTitle ?? null, new Date().toISOString());

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: PRICE_ID_PASS_DOCUMENT, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Le deviceId (identité anonyme web, voir webapp/src/services/identity.ts)
      // est passé en metadata pour que le webhook sache quel appareil marquer
      // comme débloqué une fois le paiement confirmé.
      metadata: { deviceId, productType, templateTitle: templateTitle ?? '' },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Erreur Stripe' });
  }
});

export default router;
