/**
 * Cache key helpers
 * Ensures AsyncStorage keys are scoped per user to avoid leaking data between sessions.
 */
export function userScopedKey(baseKey: string, phone: string): string {
  const safePhone = String(phone || "").trim();
  // Never allow an empty scope to behave like a shared cache key
  const scope = safePhone.length > 0 ? safePhone : "__no_phone__";
  return `${baseKey}::${scope}`;
}
