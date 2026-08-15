// ============================================================
// Miroir minimal du catalogue côté serveur : seuls "id" et
// "aiPromptTemplate" sont nécessaires pour la génération.
// Le catalogue complet (champs, libellés, catégories) vit côté
// app dans src/data/templates.ts et n'a pas besoin d'être dupliqué.
//
// ⚠️ En production : générer ce fichier automatiquement à partir
// de src/data/templates.ts (script de build partagé) pour éviter
// toute désynchronisation entre app et backend.
// ============================================================

export interface TemplateMirror {
  id: string;
  aiPromptTemplate: string;
}

export const TEMPLATES: TemplateMirror[] = [
  { id: 'document-libre', aiPromptTemplate: "L'utilisateur décrit librement, dans ses propres mots, un document administratif ou une attestation qu'il souhaite obtenir. Prends son objet et son contenu tels quels et reformate-les en un document administratif officiel, structuré et formel : formule d'appel ou d'introduction adaptée au type de document, corps de texte clair reprenant fidèlement le fond de sa demande (sans inventer de faits qu'il n'a pas mentionnés), formule de politesse ou de certification appropriée. Respecte le registre administratif français standard." },
  { id: 'resiliation-bail-locataire', aiPromptTemplate: "Rédige une lettre de résiliation de bail (congé donné par le locataire) formelle, conforme au droit français, avec accusé de réception, en te basant sur les informations fournies." },
  { id: 'mise-en-demeure-proprietaire', aiPromptTemplate: 'Rédige une mise en demeure ferme mais courtoise adressée à un propriétaire pour exiger la réalisation de travaux/réparations, avec rappel des obligations légales du bailleur (art. 6 loi du 6 juillet 1989).' },
  { id: 'restitution-caution', aiPromptTemplate: 'Rédige une lettre de réclamation pour la restitution du dépôt de garantie non rendu dans les délais légaux (1 ou 2 mois selon état des lieux), en citant la loi applicable et en mentionnant les pénalités de retard possibles.' },
  { id: 'contestation-amende', aiPromptTemplate: "Rédige une requête en exonération / contestation d'amende à destination de l'Officier du Ministère Public, argumentée et factuelle, sans reconnaissance d'infraction implicite." },
  { id: 'resiliation-assurance-hamon', aiPromptTemplate: "Rédige une lettre de résiliation d'assurance invoquant la loi Hamon (résiliation à tout moment après 1 an d'engagement), en demandant confirmation et remboursement du prorata." },
  { id: 'reclamation-operateur-internet', aiPromptTemplate: "Rédige une lettre de réclamation formelle à un opérateur télécom pour un service défaillant, en s'appuyant sur le code de la consommation et en formulant une demande claire (dédommagement, geste commercial ou résiliation sans frais)." },
  { id: 'indemnisation-vol-retarde', aiPromptTemplate: "Rédige une demande d'indemnisation basée sur le règlement européen CE 261/2004 pour un vol retardé ou annulé, avec calcul indicatif du montant potentiel selon la distance et le retard." },
  { id: 'retractation-ecommerce', aiPromptTemplate: "Rédige une lettre d'exercice du droit de rétractation dans le délai légal de 14 jours pour un achat en ligne, en demandant le remboursement intégral sous 14 jours." },
  { id: 'reclamation-frais-bancaires', aiPromptTemplate: "Rédige une réclamation à une banque pour contester des frais jugés abusifs (agios, commissions d'intervention), en demandant un geste commercial et en mentionnant le recours possible au médiateur bancaire." },
  { id: 'mediation-voisinage', aiPromptTemplate: "Rédige une lettre à un voisin pour signaler un trouble de voisinage, dans un esprit de résolution amiable avant recours au conciliateur de justice, avec un ton adapté au choix de l'utilisateur." },
  { id: 'lettre-motivation-sur-mesure', aiPromptTemplate: "Rédige une lettre de motivation percutante et personnalisée pour le poste et l'entreprise indiqués, en valorisant le parcours fourni, avec le ton demandé." },
  { id: 'lettre-demission', aiPromptTemplate: 'Rédige une lettre de démission professionnelle et courtoise, mentionnant le respect du préavis contractuel, sans justification de motif.' },
  { id: 'relance-client-impaye', aiPromptTemplate: "Rédige une lettre de relance pour facture impayée, avec un ton adapté au niveau de relance choisi (courtois, ferme, ou mise en demeure avec mention des pénalités de retard légales)." },
  { id: 'rupture-conventionnelle', aiPromptTemplate: "Rédige une lettre demandant l'ouverture d'une procédure de rupture conventionnelle, ton diplomate, proposant un entretien pour en discuter." },
  { id: 'demande-augmentation', aiPromptTemplate: "Rédige une lettre/email de demande d'augmentation salariale, structurée avec arguments factuels et chiffrés, ton professionnel et assertif." },
  { id: 'devis-cgv-freelance', aiPromptTemplate: 'Rédige des Conditions Générales de Vente simplifiées et conformes pour un freelance/auto-entrepreneur, couvrant prestations, délais, paiement et pénalités de retard.' },
  { id: 'mise-en-demeure-impaye', aiPromptTemplate: 'Rédige une mise en demeure formelle de payer, mentionnant un délai de 8 jours et les suites judiciaires possibles en cas de non-paiement.' },
  { id: 'demande-echeancier', aiPromptTemplate: "Rédige une lettre demandant un échelonnement de paiement à un créancier, ton respectueux, en justifiant la situation et en proposant un plan concret." },
];
