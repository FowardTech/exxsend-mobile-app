/**
 * Derives a display "@handle" from a user's first/last name.
 *
 * The backend doesn't expose a `username` field for the logged-in user
 * (only for other Exxsend members, via the lookup-by-username flow in
 * ExxsendMembersScreen). Until that exists, this gives Profile and the
 * QR screen a consistent, deterministic handle to show — lowercased,
 * no spaces, non-alphanumeric characters stripped.
 *
 * "Mike Joe" -> "@mikejoe"
 */
export function toHandle(firstName?: string | null, lastName?: string | null): string {
  const raw = `${firstName || ""}${lastName || ""}`.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return raw ? `@${raw}` : "";
}
