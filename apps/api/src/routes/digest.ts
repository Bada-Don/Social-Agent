import { FastifyInstance } from "fastify";
import { generateDailyDigest } from "../services/ai/processor";

export async function setupDigestRoutes(fastify: FastifyInstance) {
  // POST /api/digest/generate  { uid }
  // Call this manually or from a cron job to generate today's digest
  fastify.post<{ Body: { uid: string } }>("/generate", async (request, reply) => {
    const { uid } = request.body;
    if (!uid) return reply.status(400).send({ error: "uid required" });

    try {
      await generateDailyDigest(uid);
      reply.send({ ok: true });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });
}
