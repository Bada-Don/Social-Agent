import { FastifyInstance } from "fastify";
import { initializeWhatsAppUser, activeSockets, pendingConnections } from "../services/whatsapp/baileys";
import * as qrcode from "qrcode";

export async function setupWhatsappRoutes(fastify: FastifyInstance) {
  // Trigger WhatsApp Login / Get QR
  fastify.post<{ Body: { uid: string } }>("/connect", async (request, reply) => {
    const { uid } = request.body;

    if (activeSockets.has(uid)) {
      return reply.send({ status: "already_connected" });
    }
    
    if (pendingConnections.has(uid)) {
      return reply.send({ status: "pending" }); 
    }

    pendingConnections.add(uid);

    await new Promise((resolve) => {
      let isReplied = false;

      // Initialize and wait for QR code
      initializeWhatsAppUser(uid, async (event, payload) => {
        if (isReplied) return;
        
        if (event === 'qr') {
          isReplied = true;
          pendingConnections.delete(uid);
          try {
            const qrBase64 = await qrcode.toDataURL(payload);
            reply.send({ status: "scan_qr", qrCode: qrBase64 });
            resolve(true);
          } catch (error) {
            reply.status(500).send({ status: "error", message: "QR generation failed" });
            resolve(true);
          }
        } else if (event === 'connected') {
          isReplied = true;
          pendingConnections.delete(uid);
          reply.send({ status: "already_connected" });
          resolve(true);
        } else if (event === 'error') {
          isReplied = true;
          pendingConnections.delete(uid);
          reply.status(500).send({ status: "error", message: payload?.message || "Connection failed" });
          resolve(true);
        }
      });
      
      // Safety timeout
      setTimeout(() => {
        if (!isReplied) {
          isReplied = true;
          pendingConnections.delete(uid);
          reply.send({ status: "timeout" });
        }
        resolve(true);
      }, 30000); // 30s timeout
    });
  });

  // Check connection status
  fastify.get<{ Querystring: { uid: string } }>("/status", async (request, reply) => {
    const { uid } = request.query;
    const isConnected = activeSockets.has(uid);
    reply.send({ connected: isConnected });
  });
}
