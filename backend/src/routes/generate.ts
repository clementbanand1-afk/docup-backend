import { Router } from 'express';
import { quotaGuard } from '../middleware/quotaGuard';
import { webRateLimitGuard } from '../middleware/webRateLimitGuard';
import { generateLetterBody } from '../services/aiClient';
import { TEMPLATES } from '../data/templatesMirror';
import { db } from '../db';

const router = Router();

router.post('/generate', quotaGuard, async (req, res) => {
  const { templateId, fieldValues } = req.body as {
    templateId: string;
    fieldValues: Record<string, string>;
  };

  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return res.status(400).json({ error: 'Modèle inconnu' });
  }

  try {
    const documentText = await generateLetterBody(template.aiPromptTemplate, fieldValues);
    res.json({ documentText, generatedAtISO: new Date().toISOString() });
  } catch (e) {
    console.error('Erreur génération IA', e);
    res.status(500).json({ error: 'Échec de la génération' });
  }
});

// Route dédiée au webapp (site 100% payant à l'acte, voir
// webRateLimitGuard.ts) — même logique de génération, garde-fou
// différent (anti-abus, pas un quota mensuel métier).
router.post('/generate-web', webRateLimitGuard, async (req, res) => {
  const { templateId, fieldValues } = req.body as {
    templateId: string;
    fieldValues: Record<string, string>;
  };

  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return res.status(400).json({ error: 'Modèle inconnu' });
  }

  try {
    const documentText = await generateLetterBody(template.aiPromptTemplate, fieldValues);
    // Événement réel, utilisé par /api/stats/documents-today pour le
    // compteur affiché sur le site web — jamais de chiffre inventé côté
    // frontend, uniquement ce qui a vraiment été généré.
    const deviceId = req.headers.authorization?.replace('Bearer ', '') ?? 'unknown';
    db.prepare(
      `INSERT INTO analytics_events (deviceId, name, properties, timestampISO) VALUES (?, 'document_generated_web', ?, ?)`
    ).run(deviceId, JSON.stringify({ templateId }), new Date().toISOString());
    res.json({ documentText, generatedAtISO: new Date().toISOString() });
  } catch (e) {
    console.error('Erreur génération IA (web)', e);
    res.status(500).json({ error: 'Échec de la génération' });
  }
});

export default router;
