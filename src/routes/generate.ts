import { Router } from 'express';
import { quotaGuard } from '../middleware/quotaGuard';
import { generateLetterBody } from '../services/aiClient';
import { TEMPLATES } from '../data/templatesMirror';

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

export default router;
