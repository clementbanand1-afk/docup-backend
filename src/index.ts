import express from 'express';
import cors from 'cors';
import generateRoute from './routes/generate';
import referralRoute from './routes/referral';
import analyticsRoute from './routes/analytics';
import revenuecatWebhookRoute from './routes/revenuecatWebhook';
import './db'; // initialise la connexion SQLite + le schéma au démarrage

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', generateRoute);
app.use('/api/referral', referralRoute);
app.use('/api/analytics', analyticsRoute);
app.use('/api/revenuecat', revenuecatWebhookRoute);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DocUp backend en écoute sur le port ${PORT}`);
});
