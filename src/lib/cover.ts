// Görsel olmayan kampanyalar için deterministik "editorial" gradient kapak tonu.
const TONES = ['bb', 'navy', 'warm', 'slate', 'green'] as const;
export type CoverTone = (typeof TONES)[number];

export function coverTone(key: string): CoverTone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
