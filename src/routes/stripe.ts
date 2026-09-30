import { Router } from 'express';
import { stripe } from '../services/stripeClient';
import { db } from '../db';
import { documentIdFromToken, unlockDocument } from '../services/docLock';

const router = Router();

// ============================================================
// Deux offres, deux prix Stripe distincts.
// Créer les 2 produits dans Stripe Dashboard (paiement unique chacun)
// puis coller leurs ID "price_..." dans ces 2 variables Render :
// STRIPE_PRICE_ID_PACK_PRO (24,90 €) et STRIPE_PRICE_ID_PDF_SEUL (9,99 €).
// Le MONTANT est toujours lu depuis ces prix Stripe (source de vérité) ;
// seul le NOM affiché sur la page de paiement est celui du document.
// ============================================================
const PRICE_ID_PACK_PRO = process.env.STRIPE_PRICE_ID_PACK_PRO || '';
const PRICE_ID_PDF_SEUL = process.env.STRIPE_PRICE_ID_PDF_SEUL || '';

const OFFER_DESCRIPTIONS: Record<'pack_pro' | 'pdf_seul', string> = {
  pack_pro: "Pack Tout-en-un Pro : document personnalisé + guide d'envoi en recommandé avec accusé de réception",
  pdf_seul: 'Version PDF : document personnalisé, prêt à imprimer et à envoyer',
};

// Petit cache des montants (évite un appel Stripe à chaque paiement)
const priceCache = new Map<string, { unit_amount: number; currency: string; at: number }>();
async function getPriceAmount(priceId: string) {
  const cached = priceCache.get(priceId);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached;
  const price = await stripe!.prices.retrieve(priceId);
  if (price.unit_amount == null) throw new Error(`Prix Stripe ${priceId} sans montant fixe`);
  const value = { unit_amount: price.unit_amount, currency: price.currency, at: Date.now() };
  priceCache.set(priceId, value);
  return value;
}

const isDocumentId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);

router.post('/create-checkout-session', async (req, res) => {
  const { deviceId, productType, templateTitle, documentId, successUrl, cancelUrl, consentedToImmediateExecution } = req.body as {
    deviceId: string;
    productType: 'pack_pro' | 'pdf_seul';
    templateTitle?: string;
    documentId?: string;
    successUrl: string;
    cancelUrl: string;
    consentedToImmediateExecution: boolean;
  };

  if (!deviceId || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'deviceId, successUrl et cancelUrl requis' });
  }
  if (!isDocumentId(documentId)) {
    return res.status(400).json({ error: 'documentId invalide ou manquant' });
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
  // frontend — Article L221-28 13° Code conso : la renonciation au droit
  // de rétractation doit être expresse, jamais présumée.
  if (consentedToImmediateExecution !== true) {
    return res.status(400).json({ error: 'CONSENT_REQUIRED', message: 'Consentement à l\'exécution immédiate requis avant paiement.' });
  }

  // Preuve horodatée du consentement
  db.prepare(
    `INSERT INTO checkout_consents (deviceId, templateTitle, consentedAtISO) VALUES (?, ?, ?)`
  ).run(deviceId, templateTitle ?? null, new Date().toISOString());

  try {
    const { unit_amount, currency } = await getPriceAmount(priceId);
    const docName = (templateTitle || 'Votre document personnalisé').slice(0, 120);
    const sep = successUrl.includes('?') ? '&' : '?';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount,
          product_data: { name: docName, description: OFFER_DESCRIPTIONS[productType] },
        },
      }],
      // Stripe remplace {CHECKOUT_SESSION_ID} : le site s'en sert pour
      // faire vérifier le paiement par le serveur avant tout déblocage.
      success_url: `${successUrl}${sep}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      payment_intent_data: { description: `DocUp — ${docName}` },
      metadata: { deviceId, productType, templateTitle: templateTitle ?? '', documentId, priceId },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Erreur Stripe' });
  }
});

// ============================================================
// Déblocage APRÈS paiement : le serveur vérifie auprès de Stripe que la
// session est payée ET qu'elle concerne bien CE document, puis renvoie
// le texte complet déchiffré. Un paiement = un document.
// ============================================================
router.post('/unlock-document', async (req, res) => {
  const { sessionId, lockedToken } = req.body as { sessionId?: string; lockedToken?: string };

  if (!stripe) {
    return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
  }
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_') || typeof lockedToken !== 'string' || lockedToken.length < 40) {
    return res.status(400).json({ error: 'BAD_REQUEST' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const documentId = documentIdFromToken(lockedToken);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'NOT_PAID', message: 'Le paiement n\'est pas (encore) confirmé.' });
    }
    if (session.metadata?.documentId !== documentId) {
      return res.status(403).json({ error: 'WRONG_DOCUMENT', message: 'Ce paiement ne correspond pas à ce document.' });
    }

    const documentText = unlockDocument(lockedToken);
    res.json({ documentText, productType: session.metadata?.productType ?? 'pdf_seul' });
  } catch (e: any) {
    console.error('Erreur déblocage document', e?.message);
    res.status(500).json({ error: 'UNLOCK_FAILED' });
  }
});

export default router;
