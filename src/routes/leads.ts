import { Router } from 'express';
import { db } from '../db';

const router = Router();

// ============================================================
// Capture honnête : enregistre la demande + le consentement, MAIS
// n'envoie rien automatiquement pour l'instant — aucun service d'email
// (Resend/SendGrid) n'est configuré. Le champ "consented" est exigé,
// jamais présumé, cohérent avec l'approche déjà appliquée au paiement
// Stripe (voir routes/stripe.ts).
// ============================================================
router.post('/capture-guide', (req, res) => {
  const { email, guideSlug, consented } = req.body as {
    email: string;
    guideSlug?: string;
    consented: boolean;
  };

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }
  if (consented !== true) {
    return res.status(400).json({ error: 'CONSENT_REQUIRED' });
  }

  db.prepare(
    `INSERT INTO guide_email_leads (email, guideSlug, consentedAtISO) VALUES (?, ?, ?)`
  ).run(email, guideSlug ?? null, new Date().toISOString());

  res.json({ received: true });
});

router.post('/document-feedback', (req, res) => {
  const { deviceId, templateId, helpful } = req.body as { deviceId?: string; templateId?: string; helpful: boolean };
  db.prepare(
    `INSERT INTO document_feedback (deviceId, templateId, helpful, createdAtISO) VALUES (?, ?, ?, ?)`
  ).run(deviceId ?? null, templateId ?? null, helpful ? 1 : 0, new Date().toISOString());
  res.json({ received: true });
});

export default router;
