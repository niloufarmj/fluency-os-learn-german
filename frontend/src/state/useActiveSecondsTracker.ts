import { useEffect, useRef } from 'react';
import { apiPost } from '../utils/api';

export function useActiveSecondsTracker() {
  const secondsRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      secondsRef.current++;
      if (secondsRef.current % 60 === 0) {
        void apiPost('/track-time', { date: new Date().toISOString(), minutes: 1 }).catch(() => {
          // ignore tracking failures
        });
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, []);
}

