import { useEffect, useRef } from 'react';

/** Put keyboard/screen-reader focus on a heading and scroll it into view when `when` is true. */
export function useFocusHeading<T extends HTMLElement = HTMLHeadingElement>(when = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!when) return;
    ref.current?.focus();
    ref.current?.scrollIntoView?.({ block: 'start' });
  }, [when]);
  return ref;
}
