import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, emergencySessionsTable, contactsTable, gpsBroadcastsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [totalEmergenciesResult] = await db
    .select({ value: count() })
    .from(emergencySessionsTable);

  const [totalContactsResult] = await db
    .select({ value: count() })
    .from(contactsTable);

  const [resolvedResult] = await db
    .select({ value: count() })
    .from(emergencySessionsTable)
    .where(eq(emergencySessionsTable.status, "resolved"));

  const [cancelledResult] = await db
    .select({ value: count() })
    .from(emergencySessionsTable)
    .where(eq(emergencySessionsTable.status, "cancelled"));

  const recentEmergencies = await db
    .select()
    .from(emergencySessionsTable)
    .orderBy(desc(emergencySessionsTable.createdAt))
    .limit(5);

  const [lastBroadcast] = await db
    .select()
    .from(gpsBroadcastsTable)
    .orderBy(desc(gpsBroadcastsTable.createdAt))
    .limit(1);

  const stats = {
    totalEmergencies: Number(totalEmergenciesResult.value),
    totalContacts: Number(totalContactsResult.value),
    resolvedEmergencies: Number(resolvedResult.value),
    cancelledEmergencies: Number(cancelledResult.value),
    recentEmergencies: serializeDates(recentEmergencies),
    lastBroadcastLocation: lastBroadcast
      ? {
          latitude: lastBroadcast.latitude,
          longitude: lastBroadcast.longitude,
          timestamp: lastBroadcast.createdAt.toISOString(),
        }
      : null,
  };

  res.json(GetStatsResponse.parse(stats));
});

export default router;
