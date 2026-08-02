import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ensureCompatibleFormat, voiceChatStream } from "@workspace/integrations-openai-ai-server/audio";
import { serializeDates } from "../../lib/serialize";
import {
  CreateOpenaiConversationBody,
  CreateOpenaiConversationResponse,
  ListOpenaiConversationsResponse,
  GetOpenaiConversationParams,
  GetOpenaiConversationResponse,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  ListOpenaiMessagesResponse,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
  SendOpenaiVoiceMessageParams,
  SendOpenaiVoiceMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are LifeGuard AI, a calm, authoritative emergency safety companion. You provide:
- Clear, step-by-step first aid instructions (CPR, bleeding control, burns, fractures, shock, stroke, seizure, choking, heart attack)
- Emergency protocol guidance and situation assessment
- Fall and crash recovery advice
- Emotional support and calm direction during emergencies

Rules:
- Keep responses concise and immediately actionable
- In any life-threatening situation, always advise calling 911 first
- Do not speculate or give medical diagnoses
- Use simple language — users may be in distress`;

// ── Conversations ──────────────────────────────────────────────────────────

router.get("/openai/conversations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(conversations).orderBy(asc(conversations.createdAt));
  res.json(ListOpenaiConversationsResponse.parse(serializeDates(rows)));
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [row] = await db.insert(conversations).values({ title: parsed.data.title }).returning();
  res.status(201).json(CreateOpenaiConversationResponse.parse(serializeDates(row)));
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = GetOpenaiConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  res.json(GetOpenaiConversationResponse.parse(serializeDates({ ...conv, messages: msgs })));
});

router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [row] = await db.delete(conversations).where(eq(conversations.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

// ── Messages list ──────────────────────────────────────────────────────────

router.get("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListOpenaiMessagesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  res.json(ListOpenaiMessagesResponse.parse(serializeDates(msgs)));
});

// ── Text message (streaming SSE) ───────────────────────────────────────────

router.post("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendOpenaiMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  // Save user message
  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "user",
    content: parsed.data.content,
  });

  // Fetch last 12 messages for context
  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt))
    .limit(13);

  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 512,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...chatMessages],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Persist assistant message
    await db.insert(messages).values({
      conversationId: params.data.id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "OpenAI text stream error");
    res.write(`data: ${JSON.stringify({ error: "AI service unavailable" })}\n\n`);
  } finally {
    res.end();
  }
});

// ── Voice message (speech-to-speech SSE) ──────────────────────────────────

router.post("/openai/conversations/:id/voice-messages", async (req, res): Promise<void> => {
  const params = SendOpenaiVoiceMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = SendOpenaiVoiceMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let userTranscript = "";
  let assistantTranscript = "";

  try {
    const audioBuffer = Buffer.from(parsed.data.audio, "base64");
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const stream = await voiceChatStream(buffer, "alloy", format);

    for await (const event of stream) {
      if (event.type === "transcript") {
        assistantTranscript += event.data;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Persist both sides so voice and text history stay in sync
    await db.insert(messages).values([
      {
        conversationId: params.data.id,
        role: "user",
        content: "(voice message)",
      },
      {
        conversationId: params.data.id,
        role: "assistant",
        content: assistantTranscript || "(voice response)",
      },
    ]);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "OpenAI voice stream error");
    res.write(`data: ${JSON.stringify({ error: "Voice AI service unavailable" })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
