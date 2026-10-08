/**
 * UUID v4 generator for client-side entity IDs.
 * Every locally created entity MUST have a client-generated UUID
 * so sync operations are idempotent.
 */
export function generateId(): string {
  // Use crypto.randomUUID when available (React Native Hermes engine)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 compliant UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

