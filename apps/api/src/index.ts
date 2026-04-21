import Fastify from "fastify";
import cors from "@fastify/cors";
import { setupWhatsappRoutes } from "./routes/whatsapp";

const server = Fastify({ logger: true });

server.register(cors, {
  origin: "*", // Adjust to your frontend URL in production
});

// Register API Routes
server.register(setupWhatsappRoutes, { prefix: '/api/whatsapp' });

server.get("/health", async () => {
  return { status: "Executive Agent Backend is Online" };
});

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 8080, host: '0.0.0.0' });
    console.log(`Server listening on ${server.server.address()}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
