/** RFC 1123 DNS name with at least two labels (a zone, e.g. example.com). */
export const DNS_ZONE_PATTERN =
  /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.?$/;

export function isValidDnsZone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 253) return false;
  return DNS_ZONE_PATTERN.test(trimmed);
}
