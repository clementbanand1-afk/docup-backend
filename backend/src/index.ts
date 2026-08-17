import express from 'express';
import cors from 'cors';
import generateRoute from './routes/generate';
import referralRoute from './routes/referral';
import analyticsRoute from './routes/analytics';
import revenuecatWebhookRoute from './routes/revenuecatWebhook';
import pushRoute from './routes/push';
import stripeRoute from './routes/stripe';
import stripeWebhookRoute from './routes/stripeWebhook';
import statsRoute from './routes/stats';
import './db'; // initialise la connexion SQLite + le schéma au démarrage

const app = express();
app.use(cors());

// ⚠️ ORDRE CRITIQUE : le webhook Stripe doit recevoir le corps BRUT de la
// requête (express.raw) pour vérifier sa signature — donc monté AVANT
// express.json() global, qui sinon parserait/consommerait le corps avant
// que la route webhook ne puisse y accéder tel quel.
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRoute);

app.use(express.json());

app.use('/api', generateRoute);
app.use('/api/referral', referralRoute);
app.use('/api/analytics', analyticsRoute);
app.use('/api/revenuecat', revenuecatWebhookRoute);
app.use('/api/push', pushRoute);
app.use('/api/stripe', stripeRoute);
app.use('/api/stats', statsRoute);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DocUp backend en écoute sur le port ${PORT}`);
});
