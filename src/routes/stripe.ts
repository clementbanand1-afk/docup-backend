import { Router } from 'express';
import { stripe } from '../services/stripeClient';
import { db } from '../db';

const router = Router();

// ============================================================
// Deux offres, deux prix Stripe distincts — plus un prix unique.
// Créer les 2 produits dans Stripe Dashboard (paiement unique chacun)
// puis coller leurs ID "price_..." dans ces 2 variables Render :
// STRIPE_PRICE_ID_PACK_PRO (24,90 €) et STRIPE_PRICE_ID_PDF_SEUL (9,99 €).
// ============================================================
const PRICE_ID_PACK_PRO = process.env.STRIPE_PRICE_ID_PACK_PRO || '';
const PRICE_ID_PDF_SEUL = process.env.STRIPE_PRICE_ID_PDF_SEUL || '';

router.post('/create-checkout-session', async (req, res) => {
  const { deviceId, productType, templateTitle, successUrl, cancelUrl, consentedToImmediateExecution } = req.body as {
    deviceId: string;
    productType: 'pack_pro' | 'pdf_seul';
    templateTitle?: string;
    successUrl: string;
    cancelUrl: string;
    consentedToImmediateExecution: boolean;
  };

  if (!deviceId || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'deviceId, successUrl et cancelUrl requis' });
  }
  if (productType !== 'pack_pro' && productType !== 'pdf_seul') {
    return res.status(400).json({ error: 'productType invalide (pack_pro ou pdf_seul attendu)' });
  }
  const priceId = productType === 'pack_pro' ? PRICE_ID_PACK_PRO : PRICE_ID_PDF_SEUL;
  if (!priceId) {
    return res.status(500).json({ error: `Prix Stripe non configuré côté serveur pour ${productType}` });
  }
  if (!stripe) {
    return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED', message: 'Le paiement n\'est pas encore activé côté serveur.' });
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
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Le deviceId (identité anonyme web, voir webapp/src/services/identity.ts)
      // est passé en metadata pour que le webhook sache quel appareil marquer
      // comme débloqué une fois le paiement confirmé, et quelle offre a été
      // choisie (pour afficher le guide LRAR uniquement au Pack Pro).
      metadata: { deviceId, productType, templateTitle: templateTitle ?? '' },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Erreur Stripe' });
  }
});

export default router;
