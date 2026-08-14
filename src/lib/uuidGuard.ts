/**
 * Smart Khata — Strict PostgreSQL UUID Validation & Guard
 */

export function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Asserts that a value is a valid PostgreSQL UUID before database operations.
 * Throws a descriptive DEV error if a temporary (temp-*, cust-*, tx-*) or non-UUID string is passed.
 */
export function assertValidUuid(val: string | null | undefined, fieldName: string): void {
  if (!val || typeof val !== 'string' || !isValidUuid(val)) {
    const errorMsg = `[UUID-GUARD] BLOCKED temporary or invalid ID ("${val || 'null'}") from entering PostgreSQL UUID field "${fieldName}"`;
    console.error(errorMsg);
    if (import.meta.env.DEV) {
      throw new Error(errorMsg);
    }
  }
}
