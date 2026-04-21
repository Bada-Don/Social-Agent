import { z } from "zod";

// --- CORE DATA MODELS (Based on Firestore Data Design) ---

export const UserSchema = z.object({
  uid: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.date(),
  plan: z.enum(["free", "pro", "executive"]),
  settings: z.object({
    dailyDigestTime: z.string().default("08:00"),
    whatsappConnected: z.boolean().default(false),
    gmailConnected: z.boolean().default(false),
    notionConnected: z.boolean().default(false),
  })
});

export const MessageSchema = z.object({
  id: z.string(),
  source: z.literal("whatsapp"),
  sender: z.string(),
  text: z.string(),
  timestamp: z.date(),
  summary: z.string().optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  processed: z.boolean().default(false)
});

export const EmailSchema = z.object({
  id: z.string(),
  from: z.string(),
  subject: z.string(),
  body: z.string(),
  labels: z.array(z.string()),
  timestamp: z.date(),
  processed: z.boolean().default(false),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional()
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: z.date().optional(),
  priority: z.enum(["low", "medium", "high"]),
  source: z.enum(["whatsapp", "email", "manual"]),
  completed: z.boolean().default(false)
});

export const MemorySchema = z.object({
  id: z.string(),
  person: z.string(),
  notes: z.string(),
  tags: z.array(z.string()),
  lastSeen: z.date()
});

export const DigestSchema = z.object({
  id: z.string(),
  date: z.date(),
  content: z.object({
    summary: z.string(),
    missedTasks: z.array(TaskSchema),
    importantConversations: z.array(z.any()) // Flexible array for mixed refs
  })
});

// Infer TypeScript types from Zod
export type User = z.infer<typeof UserSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Email = z.infer<typeof EmailSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type Digest = z.infer<typeof DigestSchema>;
