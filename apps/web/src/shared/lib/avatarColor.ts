import { avatarPalette } from '@/design/tokens';
import { hashOf } from '@/shared/lib/hash';

/**
 * Buddy colours are not stored: one is derived from the id, among the avatar palette (a stable
 * hash, so that a buddy keeps the same colour on every screen).
 */
export function avatarColorOf(id: string): string {
  return avatarPalette[hashOf(id) % avatarPalette.length] ?? avatarPalette[0];
}
