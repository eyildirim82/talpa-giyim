import type { ReactNode } from 'react';

type Tone = 'accent' | 'danger' | 'warning' | 'neutral';

/** Küçük durum/etiket rozeti. Vurgu (mavi) ile semantik renkler ayrıdır. */
export default function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ds-badge ds-badge--${tone}`}>{children}</span>;
}
