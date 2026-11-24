import { isIPv4, isIPv6 } from 'node:net';

/** Key shared by the requests whose IP Express could not tell (closed socket). */
export const UNKNOWN_CLIENT_IP = 'unknown';

const IPV6_GROUPS = 8;
/** Groups of a /64 prefix: an IPv6 host usually owns a whole /64, so it is the unit of a client. */
const PREFIX_64_GROUPS = 4;

/**
 * Rate-limit key of the client IP (`req.ip`, already resolved through `trust proxy`), D35:
 * - IPv4: unchanged;
 * - IPv4-mapped IPv6 (`::ffff:203.0.113.7`, a dual-stack socket): the IPv4 it maps;
 * - any other IPv6: its /64 prefix (`2001:db8:0:1::/64`), otherwise one host would get 2^64 buckets;
 * - missing or unparsable: `UNKNOWN_CLIENT_IP`.
 *
 * The key is personal data: it is never logged nor stored (D40).
 */
export function clientIpKey(ip: string | undefined): string {
  // A zone index (`fe80::1%eth0`) names a local interface, not the client.
  const address = ip?.split('%')[0] ?? '';
  if (isIPv4(address)) {
    return address;
  }
  if (!isIPv6(address)) {
    return UNKNOWN_CLIENT_IP;
  }
  const groups = ipv6Groups(address);
  const mapped = mappedIpv4(groups);
  if (mapped !== null) {
    return mapped;
  }
  return `${groups
    .slice(0, PREFIX_64_GROUPS)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}

/** The 8 16-bit groups of a valid IPv6 address (`::` expanded, trailing dotted IPv4 converted). */
function ipv6Groups(address: string): number[] {
  const [head = '', tail] = address.split('::');
  const left = parseGroups(head);
  if (tail === undefined) {
    return left;
  }
  const right = parseGroups(tail);
  const zeros = Array.from({ length: IPV6_GROUPS - left.length - right.length }, () => 0);
  return [...left, ...zeros, ...right];
}

function parseGroups(part: string): number[] {
  if (part === '') {
    return [];
  }
  return part
    .split(':')
    .flatMap((group) => (group.includes('.') ? ipv4Groups(group) : [Number.parseInt(group, 16)]));
}

function ipv4Groups(ipv4: string): number[] {
  const [a = 0, b = 0, c = 0, d = 0] = ipv4.split('.').map(Number);
  return [(a << 8) | b, (c << 8) | d];
}

/** `::ffff:a.b.c.d` (RFC 4291 §2.5.5.2) → `a.b.c.d`; `null` for any other address. */
function mappedIpv4(groups: readonly number[]): string | null {
  const isMapped =
    groups.length === IPV6_GROUPS &&
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xffff;
  if (!isMapped) {
    return null;
  }
  const [high = 0, low = 0] = groups.slice(6);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}
