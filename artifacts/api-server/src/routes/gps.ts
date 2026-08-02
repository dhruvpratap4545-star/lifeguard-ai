import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, gpsBroadcastsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  CreateGpsBroadcastBody,
  ListGpsBroadcastsQueryParams,
  ListGpsBroadcastsResponse,
  CreateGpsBroadcastResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/gps-broadcasts", async (req, res): Promise<void> => {
  const query = ListGpsBroadcastsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { limit = 50, sessionId } = query.data;
  const conditions = sessionId != null ? [eq(gpsBroadcastsTable.sessionId, sessionId)] : [];

  const broadcasts = await db
    .select()
    .from(gpsBroadcastsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(gpsBroadcastsTable.createdAt))
    .limit(limit);

  res.json(ListGpsBroadcastsResponse.parse(serializeDates(broadcasts)));
});

router.post("/gps-broadcasts", async (req, res): Promise<void> => {
  const parsed = CreateGpsBroadcastBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid GPS broadcast body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [broadcast] = await db
    .insert(gpsBroadcastsTable)
    .values({
      sessionId: parsed.data.sessionId ?? null,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
      speed: parsed.data.speed ?? null,
      altitude: parsed.data.altitude ?? null,
    })
    .returning();

  res.status(201).json(CreateGpsBroadcastResponse.parse(serializeDates(broadcast)));
});

export default router;
