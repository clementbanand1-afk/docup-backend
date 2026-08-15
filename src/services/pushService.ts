import { db } from '../db';

export async function sendPushNotification(
  deviceId: string,
  title: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const row = db.prepare('SELECT pushToken FROM push_tokens WHERE deviceId = ?').get(deviceId) as
    | { pushToken: string }
    | undefined;

  if (!row) return { success: false, error: 'Aucun token push enregistré pour cet appareil' };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: row.pushToken, title, body }),
    });

    if (!response.ok) {
      return { success: false, error: `Expo Push API a répondu ${response.status}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Erreur réseau' };
  }
}
