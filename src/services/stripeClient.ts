import Stripe from 'stripe';

// ============================================================
// Ne DOIT JAMAIS faire planter le serveur entier si Stripe n'est pas
// encore configuré — la génération de documents (sans rapport avec les
// paiements) doit continuer à fonctionner même sans clé Stripe.
// Le client est nul tant que la clé n'est pas définie ; les routes qui
// en dépendent (routes/stripe.ts, stripeWebhook.ts) doivent vérifier
// sa présence avant de l'utiliser et répondre une erreur claire sinon.
// ============================================================
const key = process.env.STRIPE_SECRET_KEY;

export const stripe: Stripe | null = key
  ? new Stripe(key, { apiVersion: '2024-11-20.acacia' as any })
  : null;

if (!stripe) {
  console.warn('⚠️  STRIPE_SECRET_KEY non configurée — les routes de paiement sont désactivées, le reste du site fonctionne normalement.');
}
