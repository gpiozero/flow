import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

/** The canvas needs a mouse and a wide-enough screen for drag & drop; below this width it isn't usable. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
