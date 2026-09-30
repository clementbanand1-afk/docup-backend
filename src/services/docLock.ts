import crypto from 'crypto';

// ============================================================
// Verrouillage des documents web AVANT paiement.
//
// Le serveur n'envoie au navigateur qu'un APERÇU (environ 35 % du
// texte). Le document complet voyage sous forme CHIFFRÉE (AES-256-GCM),
// illisible sans la clé, qui ne quitte jamais le serveur.
//
// Après paiement, le navigateur renvoie ce jeton chiffré + l'identifiant
// de session Stripe : le serveur vérifie auprès de Stripe que CE document
// précis a été payé, puis seulement le déchiffre.
//
// Aucune base de données nécessaire : fonctionne même si Render
// redémarre ou efface son disque.
// ============================================================

const SECRET =
  process.env.DOC_LOCK_SECRET ||
  process.env.STRIPE_SECRET_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  '';

if (!process.env.DOC_LOCK_SECRET) {
  console.warn('ℹ️  DOC_LOCK_SECRET non défini — clé de chiffrement dérivée d\'une autre variable secrète.');
}

const KEY = crypto.createHash('sha256').update(`docup-doc-lock:${SECRET}`).digest();

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function lockDocument(fullText: string): { token: string; documentId: string } {
  if (!SECRET) throw new Error('Aucun secret serveur disponible pour chiffrer le document');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(fullText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const token = b64url(Buffer.concat([iv, tag, ct]));
  return { token, documentId: documentIdFromToken(token) };
}

export function documentIdFromToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

export function unlockDocument(token: string): string {
  const raw = fromB64url(token);
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Aperçu : les premiers paragraphes jusqu'à ~35 % du texte (au moins le
 * premier paragraphe, jamais la totalité). Renvoie aussi la longueur des
 * paragraphes masqués, pour dessiner des lignes floutées de la bonne taille
 * côté site, sans jamais transmettre leur contenu.
 */
export function buildPreview(fullText: string, ratio = 0.35): { previewText: string; hiddenParagraphs: number[] } {
  const paragraphs = fullText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const target = fullText.length * ratio;

  if (paragraphs.length >= 3) {
    const shown: string[] = [];
    let len = 0;
    for (const p of paragraphs) {
      if (shown.length >= 1 && len + p.length > target) break;
      if (shown.length >= paragraphs.length - 1) break; // toujours masquer au moins 1 paragraphe
      shown.push(p);
      len += p.length;
    }
    return {
      previewText: shown.join('\n\n'),
      hiddenParagraphs: paragraphs.slice(shown.length).map((p) => p.length),
    };
  }

  // Texte court (1-2 paragraphes) : coupe à la phrase la plus proche de 35 %
  const cut = fullText.slice(0, Math.max(80, Math.floor(target)));
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  const previewText = (lastStop > 40 ? cut.slice(0, lastStop + 1) : cut).trim();
  return { previewText, hiddenParagraphs: [Math.max(0, fullText.length - previewText.length)] };
}
