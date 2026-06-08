import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Announcement } from '../../lib/types';

/** Aktif duyurular — tek satır şeritte sırayla döner (hover'da durur). */
export default function AnnouncementBar({ items }: { items: Announcement[] }) {
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => {
      if (!paused.current) setIdx((i) => (i + 1) % items.length);
    }, 6000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const a = items[Math.min(idx, items.length - 1)];

  const content = a.link_slug ? (
    <Link to={`/kampanya/${a.link_slug}`}>{a.message}</Link>
  ) : a.link_url ? (
    <a href={a.link_url} target="_blank" rel="noopener noreferrer">
      {a.message}
    </a>
  ) : (
    <span>{a.message}</span>
  );

  return (
    <div
      className="ds-announce"
      onMouseEnter={() => {
        paused.current = true;
      }}
      onMouseLeave={() => {
        paused.current = false;
      }}
    >
      <div className="ds-announce__inner">
        {content}
        {items.length > 1 && (
          <span className="ds-announce__dots">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                className={`ds-announce__dot${i === idx ? ' active' : ''}`}
                onClick={() => setIdx(i)}
                aria-label={`Duyuru ${i + 1}`}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
