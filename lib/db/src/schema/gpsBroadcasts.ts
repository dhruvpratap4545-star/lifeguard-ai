import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gpsBroadcastsTable = pgTable("gps_broadcasts", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  accuracy: real("accuracy"),
  speed: real("speed"),
  altitude: real("altitude"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGpsBroadcastSchema = createInsertSchema(gpsBroadcastsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertGpsBroadcast = z.infer<typeof insertGpsBroadcastSchema>;
export type GpsBroadcast = typeof gpsBroadcastsTable.$inferSelect;
