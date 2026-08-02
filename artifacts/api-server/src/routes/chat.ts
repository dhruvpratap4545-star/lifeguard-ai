import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, chatSessionsTable, chatMessagesTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  CreateChatSessionBody,
  CreateChatSessionResponse,
  ListChatSessionsResponse,
  ListChatMessagesParams,
  ListChatMessagesResponse,
  SendChatMessageParams,
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import { generateAIResponse } from "../lib/aiCompanion";

const router: IRouter = Router();

router.get("/chat-sessions", async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(chatSessionsTable)
    .orderBy(chatSessionsTable.createdAt);

  res.json(ListChatSessionsResponse.parse(serializeDates(sessions)));
});

router.post("/chat-sessions", async (req, res): Promise<void> => {
  const parsed = CreateChatSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(chatSessionsTable)
    .values({
      title: parsed.data.title,
      context: parsed.data.context ?? "general",
      messageCount: 0,
    })
    .returning();

  res.status(201).json(CreateChatSessionResponse.parse(serializeDates(session)));
});

router.get("/chat-sessions/:id/messages", async (req, res): Promise<void> => {
  const params = ListChatMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, params.data.id))
    .orderBy(chatMessagesTable.createdAt);

  res.json(ListChatMessagesResponse.parse(serializeDates(messages)));
});

router.post("/chat-sessions/:id/messages", async (req, res): Promise<void> => {
  const params = SendChatMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Chat session not found" });
    return;
  }

  // Save user message
  await db.insert(chatMessagesTable).values({
    sessionId: params.data.id,
    role: "user",
    content: parsed.data.content,
  });

  // Get recent messages for context
  const recentMessages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, params.data.id))
    .orderBy(chatMessagesTable.createdAt)
    .limit(10);

  // Generate AI response
  const aiContent = await generateAIResponse(parsed.data.content, session.context ?? "general", recentMessages);

  const [aiMessage] = await db
    .insert(chatMessagesTable)
    .values({
      sessionId: params.data.id,
      role: "assistant",
      content: aiContent,
    })
    .returning();

  // Update message count
  await db
    .update(chatSessionsTable)
    .set({ messageCount: sql`${chatSessionsTable.messageCount} + 2` })
    .where(eq(chatSessionsTable.id, params.data.id));

  res.status(201).json(SendChatMessageResponse.parse(serializeDates(aiMessage)));
});

export default router;
