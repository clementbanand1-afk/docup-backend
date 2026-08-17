import Anthropic from '@anthropic-ai/sdk';

// ============================================================
// Client Claude API — seul endroit du système qui détient la clé
// API réelle (jamais exposée côté mobile). Le prompt système fixe
// le format de sortie (texte de courrier prêt à l'emploi, sans
// coordonnées ni signature : celles-ci sont ajoutées côté app à
// partir du profil utilisateur, cf. ResultScreen.tsx).
// ============================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateLetterBody(
  promptTemplate: string,
  fieldValues: Record<string, string>
): Promise<string> {
  const fieldsSummary = Object.entries(fieldValues)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const systemPrompt = [
    'Tu es un rédacteur juridique et administratif francophone expert.',
    "Tu rédiges UNIQUEMENT le corps du courrier (formule d'appel, paragraphes, formule de politesse).",
    "N'inclus JAMAIS les coordonnées de l'expéditeur, la date, ni l'objet : ils sont ajoutés séparément.",
    "N'inclus JAMAIS de placeholder du type [Nom] : utilise les informations fournies telles quelles.",
    'Ton formel, phrases claires, aucune familiarité.',
  ].join(' ');

  const userPrompt = `${promptTemplate}\n\nInformations fournies par l'utilisateur :\n${fieldsSummary}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Réponse IA invalide');
  }
  return textBlock.text.trim();
}
