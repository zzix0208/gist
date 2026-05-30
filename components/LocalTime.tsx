'use client';

import { useEffect, useState } from 'react';

// Render an ISO timestamp in the viewer's local time.
// SSR and the first client render output the same stable string (so there is no
// hydration mismatch — server runs in UTC on Vercel, the browser in local time);
// after mount we upgrade to the viewer's localized value.
export default function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => iso.replace('T', ' ').slice(0, 16) + ' UTC');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(new Date(iso).toLocaleString());
  }, [iso]);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
