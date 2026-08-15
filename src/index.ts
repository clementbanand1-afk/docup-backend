import express from 'express';
import cors from 'cors';
import generateRoute from './routes/generate';
import referralRoute from './routes/referral';
import analyticsRoute from './routes/analytics';
import revenuecatWebhookRoute from './routes/revenuecatWebhook';
import pushRoute from './routes/push';
import './db';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', generateRoute);
app.use('/api/referral', referralRoute);
app.use('/api/analytics', analyticsRoute);
app.use('/api/revenuecat', revenuecatWebhookRoute);
app.use('/api/push', pushRoute);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DocUp backend en écoute sur le port ${PORT}`);
});
