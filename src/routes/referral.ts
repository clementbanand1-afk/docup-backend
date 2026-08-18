import { Router } from 'express';
import {
  getOrCreateReferralCode,
  redeemReferralCode,
  activateReferral,
  getUnclaimedCredits,
  claimCredits,
} from '../services/referralStore';

const router = Router();

function requireDeviceId(req: any, res: any): string | null {
  const deviceId = req.headers.authorization?.replace('Bearer ', '');
  if (!deviceId) {
    res.status(401).json({ error: 'Authentification manquante' });
    return null;
  }
  return deviceId;
}

// Récupère (ou crée) le code de parrainage personnel de l'utilisateur
router.get('/code', (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;
  res.json({ code: getOrCreateReferralCode(deviceId) });
});

// Le nouvel utilisateur enregistre le code par lequel il est arrivé
router.post('/redeem', (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;
  const { code } = req.body as { code: string };
  if (!code) return res.status(400).json({ error: 'Code manquant' });

  const result = redeemReferralCode(deviceId, code);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

// Déclenché après la 1ère génération réussie du nouvel utilisateur
router.post('/activate', (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;
  const result = activateReferral(deviceId);
  res.json(result);
});

// Le parrain vérifie s'il a des crédits en attente
router.get('/credits', (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;
  res.json({ unclaimedCredits: getUnclaimedCredits(deviceId) });
});

// L'app du parrain confirme avoir intégré les crédits localement
router.post('/claim', (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;
  const count = claimCredits(deviceId);
  res.json({ claimedCredits: count });
});

export default router;
