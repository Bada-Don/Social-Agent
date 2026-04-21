import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import { db, collections } from '../../config/firebase';
import { processMessage } from '../ai/processor';

// Keep track of active sockets in memory
export const activeSockets = new Map<string, any>();
export const pendingConnections = new Set<string>();

export async function initializeWhatsAppUser(
  uid: string,
  onEvent?: (event: 'qr' | 'connected' | 'error', payload?: any) => void
) {
  const sessionDir = `./sessions/auth_info_${uid}`;

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[WhatsApp] Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: Browsers.macOS('Desktop'),
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
  });

  // ── 1. Connection Updates ────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && onEvent) {
      onEvent('qr', qr);
    }

    if (connection === 'close') {
      const boomError = lastDisconnect?.error as Boom;
      const statusCode = boomError?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`Connection closed for ${uid}, code: ${statusCode}, reconnecting: ${shouldReconnect}`);

      activeSockets.delete(uid);

      if (shouldReconnect || statusCode === DisconnectReason.loggedOut) {
        const isTransient =
          statusCode === DisconnectReason.connectionClosed ||
          statusCode === DisconnectReason.connectionLost ||
          statusCode === DisconnectReason.restartRequired ||
          statusCode === DisconnectReason.connectionReplaced ||
          statusCode === undefined;

        if (!isTransient || statusCode === DisconnectReason.loggedOut) {
          const reason = statusCode === DisconnectReason.loggedOut ? 'Logged Out' : `Code ${statusCode}`;
          console.warn(`[WhatsApp] Unrecoverable session for ${uid} (${reason}). Clearing.`);
          fs.rmSync(sessionDir, { recursive: true, force: true });

          await db.doc(`users/${uid}`).set(
            { settings: { whatsappConnected: false } },
            { merge: true }
          ).catch(console.error);

          setTimeout(() => initializeWhatsAppUser(uid, onEvent), 100);
        } else {
          setTimeout(() => initializeWhatsAppUser(uid, onEvent), 5000);
        }
      } else {
        if (onEvent) onEvent('error', new Error(`Connection closed: ${statusCode}`));
      }
    } else if (connection === 'open') {
      console.log(`WhatsApp connected for user: ${uid}`);
      activeSockets.set(uid, sock);
      try {
        await db.doc(`users/${uid}`).set(
          { settings: { whatsappConnected: true } },
          { merge: true }
        );
      } catch (err) {
        console.error(`[WhatsApp] Failed to update Firestore connected state for ${uid}:`, err);
      }
      if (onEvent) onEvent('connected');
    }
  });

  // ── 2. Save credentials ──────────────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── 3. Incoming messages — save + AI process ────────────────────────────
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (
        msg.key.fromMe ||
        msg.key.remoteJid === 'status@broadcast' ||
        msg.key.remoteJid?.endsWith('@newsletter')
      ) continue;

      const sender = msg.key.remoteJid!;
      const isGroup = sender.endsWith('@g.us');
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';

      if (!text) continue;

      console.log(`[WhatsApp] ${isGroup ? '[Group]' : '[DM]'} New msg from ${sender}: ${text}`);

      try {
        const msgRef = collections.messages(uid).doc(msg.key.id!);
        await msgRef.set({
          id: msg.key.id,
          source: 'whatsapp',
          sender,
          isGroup,
          text,
          timestamp: new Date(),
          processed: false,
          urgency: 'low',       // default — AI will update
          summary: null,
          tasks: [],
          missedItem: false,
        });
        console.log(`[WhatsApp] Saved message ${msg.key.id} to Firestore.`);

        // Fire-and-forget AI processing — doesn't block message receipt
        processMessage(uid, msg.key.id!, sender, text).catch((err) =>
          console.error(`[AI] Processing failed for ${msg.key.id}:`, err)
        );
      } catch (err) {
        console.error(`[WhatsApp] Failed to save message to Firestore for ${uid}:`, err);
      }
    }
  });

  // ── 4. Read receipts — mark processed when read on phone ────────────────
  // Fires when the status of a sent/received message changes (delivered → read).
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      // Status 4 = READ in the WhatsApp protocol
      if (update.update?.status !== proto.WebMessageInfo.Status.READ) continue;

      const msgId = update.key.id;
      if (!msgId) continue;

      try {
        const msgRef = collections.messages(uid).doc(msgId);
        const snap = await msgRef.get();
        if (snap.exists && snap.data()?.processed === false) {
          await msgRef.update({ processed: true });
          console.log(`[WhatsApp] Message ${msgId} marked as read (read receipt from phone).`);
        }
      } catch (err) {
        console.error(`[WhatsApp] Failed to mark message ${msgId} as read:`, err);
      }
    }
  });

  return sock;
}
