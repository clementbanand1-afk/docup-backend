import { db } from '../db';

// ============================================================
// Stockage du parrainage — SQLite persistant (voir db/index.ts).
// Survit aux redémarrages serveur, contrairement à l'ancienne
// version en Map() mémoire.
// ============================================================

function generateCode(deviceId: string): string {
  return deviceId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function getOrCreateReferralCode(deviceId: string): string {
  const existing = db.prepare('SELECT code FROM referral_codes WHERE deviceId = ?').get(deviceId) as
    | { code: string }
    | undefined;
  if (existing) return existing.code;

  const code = generateCode(deviceId);
  db.prepare('INSERT INTO referral_codes (deviceId, code) VALUES (?, ?)').run(deviceId, code);
  return code;
}

export function redeemReferralCode(referredDeviceId: string, code: string): { success: boolean; error?: string } {
  const owner = db.prepare('SELECT deviceId FROM referral_codes WHERE code = ?').get(code) as
    | { deviceId: string }
    | undefined;
  if (!owner) return { success: false, error: 'Code de parrainage invalide.' };
  if (owner.deviceId === referredDeviceId) return { success: false, error: 'Auto-parrainage impossible.' };

  const alreadyPending = db
    .prepare('SELECT referredDeviceId FROM referral_pending WHERE referredDeviceId = ?')
    .get(referredDeviceId);
  if (alreadyPending) return { success: false, error: 'Parrainage déjà enregistré.' };

  db.prepare(
    'INSERT INTO referral_pending (referredDeviceId, referrerCode, activated) VALUES (?, ?, 0)'
  ).run(referredDeviceId, code);
  return { success: true };
}

export function activateReferral(referredDeviceId: string): { credited: boolean } {
  const pending = db
    .prepare('SELECT referrerCode, activated FROM referral_pending WHERE referredDeviceId = ?')
    .get(referredDeviceId) as { referrerCode: string; activated: number } | undefined;
  if (!pending || pending.activated) return { credited: false };

  db.prepare('UPDATE referral_pending SET activated = 1 WHERE referredDeviceId = ?').run(referredDeviceId);

  const owner = db.prepare('SELECT deviceId FROM referral_codes WHERE code = ?').get(pending.referrerCode) as
    | { deviceId: string }
    | undefined;
  if (owner) {
    db.prepare(
      'INSERT INTO referral_unclaimed_credits (deviceId, credits) VALUES (?, 1) ' +
        'ON CONFLICT(deviceId) DO UPDATE SET credits = credits + 1'
    ).run(owner.deviceId);
  }
  return { credited: true };
}

export function getUnclaimedCredits(deviceId: string): number {
  const row = db.prepare('SELECT credits FROM referral_unclaimed_credits WHERE deviceId = ?').get(deviceId) as
    | { credits: number }
    | undefined;
  return row?.credits ?? 0;
}

export function claimCredits(deviceId: string): number {
  const count = getUnclaimedCredits(deviceId);
  db.prepare('UPDATE referral_unclaimed_credits SET credits = 0 WHERE deviceId = ?').run(deviceId);
  return count;
}
