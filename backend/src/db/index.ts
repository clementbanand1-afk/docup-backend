import Database from 'better-sqlite3';
import path from 'path';

// ============================================================
// Persistance réelle via SQLite (fichier local sur disque). Ça
// résout le problème "un redémarrage serveur remet tout à zéro"
// des Map() en mémoire, sans exiger de configurer un vrai serveur
// Postgres/Redis avant même d'avoir un utilisateur payant.
//
// Limite assumée : SQLite ne supporte qu'une seule instance serveur
// à la fois (pas d'écriture concurrente multi-process). Suffisant
// pour démarrer et valider le produit. Le jour où tu scales sur
// plusieurs instances (load balancer), migre vers Postgres — le
// SQL ci-dessous est volontairement simple pour rendre cette
// migration directe (mêmes noms de tables/colonnes).
// ============================================================

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data.sqlite');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS quota_usage (
    deviceId TEXT PRIMARY KEY,
    monthKey TEXT NOT NULL,
    count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS referral_codes (
    deviceId TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS referral_pending (
    referredDeviceId TEXT PRIMARY KEY,
    referrerCode TEXT NOT NULL,
    activated INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS referral_unclaimed_credits (
    deviceId TEXT PRIMARY KEY,
    credits INTEGER NOT NULL DEFAULT 0
  );

  -- Statut d'abonnement, tenu à jour par les webhooks RevenueCat
  -- (voir routes/revenuecatWebhook.ts) — source de vérité SERVEUR,
  -- indépendante de ce que le SDK client affirme.
  CREATE TABLE IF NOT EXISTS subscriptions (
    deviceId TEXT PRIMARY KEY,
    isPremium INTEGER NOT NULL DEFAULT 0,
    expiresAtISO TEXT,
    updatedAtISO TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    name TEXT NOT NULL,
    properties TEXT,
    timestampISO TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_events(name);
  CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestampISO);

  -- Tokens push Expo, un par appareil. Fondation pour de futures
  -- campagnes déclenchées côté serveur (relance inactivité, annonces) —
  -- voir services/pushService.ts. Rien n'est encore envoyé automatiquement.
  CREATE TABLE IF NOT EXISTS push_tokens (
    deviceId TEXT PRIMARY KEY,
    pushToken TEXT NOT NULL,
    platform TEXT,
    updatedAtISO TEXT NOT NULL
  );

  -- Débloque UN document web (retrait filigrane) via achat unique Stripe.
  -- Volontairement séparée de la table subscriptions/isPremium : un Pass
  -- Document n'est PAS un abonnement illimité, mélanger les deux donnerait
  -- un accès gratuit à vie par erreur. Voir routes/stripeWebhook.ts.
  CREATE TABLE IF NOT EXISTS web_document_unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    templateTitle TEXT,
    unlockedAtISO TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_web_unlocks_device ON web_document_unlocks(deviceId);

  -- Preuve horodatée du consentement explicite à l'exécution immédiate +
  -- renonciation au droit de rétractation (Article L221-28 15° du Code de
  -- la consommation), enregistrée AVANT la création de la session Stripe.
  -- Sert de preuve en cas de litige/réclamation — voir CGV Article 6.
  CREATE TABLE IF NOT EXISTS checkout_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    templateTitle TEXT,
    consentedAtISO TEXT NOT NULL
  );
`);
