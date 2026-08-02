import { pgTable, serial, text, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emergencySessionsTable = pgTable("emergency_sessions", {
  id: serial("id").primaryKey(),
  triggerType: text("trigger_type").notNull(), // fall | crash | manual | sos
  status: text("status").notNull().default("pending"), // pending | active | cancelled | resolved
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  accelerometerPeak: real("accelerometer_peak"),
  countdownSeconds: integer("countdown_seconds").default(15),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmergencySessionSchema = createInsertSchema(emergencySessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmergencySession = z.infer<typeof insertEmergencySessionSchema>;
export type EmergencySession = typeof emergencySessionsTable.$inferSelect;
