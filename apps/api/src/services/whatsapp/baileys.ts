import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import { db, collections } from '../../config/firebase'; // From Step 2


// Keep track of active sockets in memory
export const activeSockets = new Map<string, any>();
export const pendingConnections = new Set<string>();

export async function initializeWhatsAppUser(
  uid: string, 
  onEvent?: (event: 'qr' | 'connected' | 'error', payload?: any) => void
) {
  const sessionDir = `./sessions/auth_info_${uid}`;
  
  // Ensure session directory exists
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

  // 1. Listen for Connection Updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && onEvent) {
      onEvent('qr', qr); // Send QR back to frontend via route/websocket
    }

    if (connection === 'close') {
      const boomError = lastDisconnect?.error as Boom;
      const statusCode = boomError?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`Connection closed for ${uid}, code: ${statusCode}, reconnecting: ${shouldReconnect}`);
      
      activeSockets.delete(uid);

      if (shouldReconnect || statusCode === DisconnectReason.loggedOut) {
        // Transient errors are typically network related
        const isTransient = 
          statusCode === DisconnectReason.connectionClosed || 
          statusCode === DisconnectReason.connectionLost || 
          statusCode === DisconnectReason.restartRequired || 
          statusCode === DisconnectReason.connectionReplaced ||
          statusCode === undefined;

        if (!isTransient || statusCode === DisconnectReason.loggedOut) {
          const reason = statusCode === DisconnectReason.loggedOut ? "Logged Out" : `Code ${statusCode}`;
          console.warn(`[WhatsApp] Unrecoverable session for ${uid} (${reason}). Clearing.`);
          fs.rmSync(sessionDir, { recursive: true, force: true });
          
          // Update Firestore to Disconnected
          await db.doc(`users/${uid}`).set({ 
            settings: { whatsappConnected: false } 
          }, { merge: true }).catch(console.error);

          // Reconnect immediately to give user a new QR code
          setTimeout(() => initializeWhatsAppUser(uid, onEvent), 100);
        } else {
          // Add a 5 second backoff for transient/network errors
          setTimeout(() => {
            initializeWhatsAppUser(uid, onEvent);
          }, 5000);
        }
      } else {
        // This block is now effectively for cases where we might want to stay dead, 
        // e.g. if we add a manual 'stop' command.
        if (onEvent) onEvent('error', new Error(`Connection closed: ${statusCode}`));
      }
    } else if (connection === 'open') {
      console.log(`WhatsApp connected for user: ${uid}`);
      activeSockets.set(uid, sock);
      try {
        await db.doc(`users/${uid}`).set({ 
          settings: { whatsappConnected: true } 
        }, { merge: true });
      } catch (err) {
        console.error(`[WhatsApp] Failed to update Firestore connected state for ${uid}:`, err);
      }
      if (onEvent) onEvent('connected');
    }
  });

  // 2. Save Credentials automatically
  sock.ev.on('creds.update', saveCreds);

  // 3. Listen for Incoming Messages (FLOW 1 - ENTRY POINT)
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return; 
    
    for (const msg of m.messages) {
      // Ignore: self, broadcast, newsletters
      if (
        msg.key.fromMe || 
        msg.key.remoteJid === 'status@broadcast' || 
        msg.key.remoteJid?.endsWith('@newsletter')
      ) continue;

      const sender = msg.key.remoteJid;
      const isGroup = sender?.endsWith('@g.us');
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
      
      if (!text) continue; 

      console.log(`[WhatsApp] ${isGroup ? '[Group]' : '[DM]'} New msg from ${sender}: ${text}`);

      // Save raw message to Firestore
      try {
        const msgRef = collections.messages(uid).doc(msg.key.id!);
        await msgRef.set({
          id: msg.key.id,
          source: "whatsapp",
          sender,
          text,
          timestamp: new Date(),
          processed: false,
          urgency: "low", // Default, AI will update later
        });
        console.log(`[WhatsApp] Saved message ${msg.key.id} to Firestore.`);
      } catch (err) {
        console.error(`[WhatsApp] Failed to save message to Firestore for ${uid}:`, err);
      }
    }
  });

  return sock;
}
