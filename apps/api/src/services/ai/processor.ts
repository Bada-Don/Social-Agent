import { db, collections } from '../../config/firebase';
import * as admin from 'firebase-admin';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const MODEL = 'google/gemini-2.0-flash-001';

interface AIResult {
  urgency: 'high' | 'medium' | 'low';
  summary: string;
  missedItem: boolean;
  tasks: Array<{ title: string; deadline: string | null }>;
  memoryNote: string | null; // key fact about this contact worth remembering
}

async function callLLM(systemPrompt: string, userContent: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://executive-os.local',
      'X-Title': 'Executive OS',
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? '{}';
}

const SYSTEM_PROMPT = `You are an executive assistant AI. Analyze the given WhatsApp message and return a JSON object with exactly these keys:

{
  "urgency": "high" | "medium" | "low",
  "summary": "<one sentence summary of what the message is about>",
  "missedItem": true | false,
  "tasks": [{ "title": "<action item>", "deadline": "<ISO date string or null>" }],
  "memoryNote": "<important fact about this person worth remembering, or null>"
}

Guidelines:
- urgency=high: requires response within hours, involves money/legal/health/emergency, or sender is clearly frustrated
- urgency=medium: needs response today or contains a clear request
- urgency=low: informational, social, or can wait
- missedItem=true: the message contains a question or request that appears to be going unanswered (e.g. a follow-up "did you see my last message?")
- tasks: extract any concrete action items the user needs to do. Include deadlines if mentioned.
- memoryNote: note relationships, roles, or context (e.g. "Amit is the project manager for the API project"). Return null if nothing notable.

Always return valid JSON only. No markdown fences.`;

export async function processMessage(
  uid: string,
  msgId: string,
  sender: string,
  text: string
): Promise<void> {
  console.log(`[AI] Processing message ${msgId} from ${sender}`);

  let result: AIResult;

  try {
    const raw = await callLLM(
      SYSTEM_PROMPT,
      `Sender JID: ${sender}\nMessage: ${text}`
    );
    result = JSON.parse(raw) as AIResult;
  } catch (err) {
    console.error(`[AI] LLM call failed for ${msgId}:`, err);
    // Don't crash — leave defaults in place
    return;
  }

  const msgRef = collections.messages(uid).doc(msgId);

  // Update message doc with AI analysis
  await msgRef.update({
    urgency: result.urgency ?? 'low',
    summary: result.summary ?? null,
    missedItem: result.missedItem ?? false,
    tasks: result.tasks ?? [],
    aiProcessed: true,
  }).catch((err) => console.error(`[AI] Failed to update message ${msgId}:`, err));

  // Write extracted tasks to the tasks subcollection
  if (result.tasks && result.tasks.length > 0) {
    const tasksRef = collections.tasks(uid);
    const batch = db.batch();
    for (const task of result.tasks) {
      const taskDoc = tasksRef.doc();
      batch.set(taskDoc, {
        title: task.title,
        deadline: task.deadline ?? null,
        status: 'todo',
        sourceMessageId: msgId,
        sourceSender: sender,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        done: false,
      });
    }
    await batch.commit().catch((err) =>
      console.error(`[AI] Failed to write tasks for message ${msgId}:`, err)
    );
    console.log(`[AI] Wrote ${result.tasks.length} task(s) for message ${msgId}`);
  }

  // Update memory/contact notes
  if (result.memoryNote) {
    const contactId = sender.replace(/[^a-zA-Z0-9]/g, '_');
    const memoryRef = collections.memory(uid).doc(contactId);
    await memoryRef.set(
      {
        jid: sender,
        notes: admin.firestore.FieldValue.arrayUnion(result.memoryNote),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => console.error(`[AI] Failed to update memory for ${sender}:`, err));
  }

  console.log(
    `[AI] Done processing ${msgId}: urgency=${result.urgency}, tasks=${result.tasks?.length ?? 0}, missed=${result.missedItem}`
  );
}

// Generate (or refresh) a daily digest for the user
export async function generateDailyDigest(uid: string): Promise<void> {
  console.log(`[AI] Generating daily digest for ${uid}`);

  // Fetch last 50 unprocessed messages
  const snap = await collections.messages(uid)
    .where('processed', '==', false)
    .limit(50)
    .get();

  if (snap.empty) {
    console.log(`[AI] No unread messages for digest.`);
    return;
  }

  const lines = snap.docs.map((d) => {
    const data = d.data();
    return `From: ${data.sender} | ${data.text}`;
  });

  const digestPrompt = `You are an executive assistant. Given these WhatsApp messages, write a concise daily briefing in 3–5 bullet points covering: what's urgent, what needs a response, and any key tasks. Return JSON: { "digest": "<markdown bullet list>" }`;

  try {
    const raw = await callLLM(digestPrompt, lines.join('\n'));
    const parsed = JSON.parse(raw) as { digest: string };

    const today = new Date().toISOString().split('T')[0];
    await collections.digests(uid).doc(today).set({
      date: today,
      content: parsed.digest,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      messageCount: snap.size,
    });
    console.log(`[AI] Digest written for ${uid} on ${today}`);
  } catch (err) {
    console.error(`[AI] Digest generation failed for ${uid}:`, err);
  }
}
