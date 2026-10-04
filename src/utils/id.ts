let counter = 0;

/**
 * Short, collision-resistant local id (time + counter + randomness).
 * Good enough for on-device records; never used as a security token.
 */
export function createId(prefix = ''): string {
  counter = (counter + 1) % 1679616; // 36^4
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(4, '0');
  const rand = Math.floor(Math.random() * 1679616)
    .toString(36)
    .padStart(4, '0');
  return `${prefix}${time}${seq}${rand}`;
}
