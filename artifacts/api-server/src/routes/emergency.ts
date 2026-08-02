import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, emergencySessionsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  CreateEmergencySessionBody,
  UpdateEmergencySessionBody,
  UpdateEmergencySessionParams,
  GetEmergencySessionParams,
  ListEmergencySessionsQueryParams,
  ListEmergencySessionsResponse,
  CreateEmergencySessionResponse,
  GetEmergencySessionResponse,
  UpdateEmergencySessionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/emergency-sessions", async (req, res): Promise<void> => {
  const query = ListEmergencySessionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { limit = 20, status } = query.data;
  const conditions = status ? [eq(emergencySessionsTable.status, status)] : [];

  const sessions = await db
    .select()
    .from(emergencySessionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(emergencySessionsTable.createdAt))
    .limit(limit);

  res.json(ListEmergencySessionsResponse.parse(serializeDates(sessions)));
});

router.post("/emergency-sessions", async (req, res): Promise<void> => {
  const parsed = CreateEmergencySessionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid emergency session body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(emergencySessionsTable)
    .values({
      triggerType: parsed.data.triggerType,
      status: "pending",
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accelerometerPeak: parsed.data.accelerometerPeak ?? null,
      countdownSeconds: parsed.data.countdownSeconds ?? 15,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  req.log.info({ sessionId: session.id, triggerType: session.triggerType }, "Emergency session created");
  res.status(201).json(CreateEmergencySessionResponse.parse(serializeDates(session)));
});

router.get("/emergency-sessions/:id", async (req, res): Promise<void> => {
  const params = GetEmergencySessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(emergencySessionsTable)
    .where(eq(emergencySessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Emergency session not found" });
    return;
  }

  res.json(GetEmergencySessionResponse.parse(serializeDates(session)));
});

router.patch("/emergency-sessions/:id", async (req, res): Promise<void> => {
  const params = UpdateEmergencySessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEmergencySessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === "resolved" || parsed.data.status === "cancelled") {
      updateData.resolvedAt = new Date();
    }
  }
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  const [session] = await db
    .update(emergencySessionsTable)
    .set(updateData)
    .where(eq(emergencySessionsTable.id, params.data.id))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Emergency session not found" });
    return;
  }

  req.log.info({ sessionId: session.id, status: session.status }, "Emergency session updated");
  res.json(UpdateEmergencySessionResponse.parse(serializeDates(session)));
});

export default router;
