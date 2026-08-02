/**
 * Recursively converts all Date objects in a value to ISO strings.
 * Required because Drizzle returns Date objects for timestamp columns
 * but Orval-generated Zod schemas expect strings.
 */
export function serializeDates<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(serializeDates) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = serializeDates(v);
    }
    return result as T;
  }
  return value;
}
