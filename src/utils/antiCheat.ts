import { useEffect, useRef } from 'react';

interface AntiCheatOptions {
  isActive: boolean;
  isWarningModalOpen?: boolean;
  onWarning: (count: number) => void;
  onDisqualify: (reason: string) => void;
}

export function useAntiCheat({
  isActive,
  isWarningModalOpen = false,
  onWarning,
  onDisqualify,
}: AntiCheatOptions) {
  const switchCountRef = useRef<number>(0);
  const lastSwitchTimeRef = useRef<number>(0);
  const mountTimeRef = useRef<number>(Date.now());
  const lastFullscreenToggleRef = useRef<number>(0);
  const hiddenTimerRef = useRef<any>(null);
  const isWarningModalOpenRef = useRef<boolean>(isWarningModalOpen);

  useEffect(() => {
    isWarningModalOpenRef.current = isWarningModalOpen;
  }, [isWarningModalOpen]);

  useEffect(() => {
    if (!isActive) return;

    mountTimeRef.current = Date.now();

    // Listen to fullscreen changes to suppress false-positive visibility events
    const handleFullscreenChange = () => {
      lastFullscreenToggleRef.current = Date.now();
      if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current);
        hiddenTimerRef.current = null;
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange, true);

    // Block keyboard developer shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+S, Ctrl+P
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Block right click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Block copy / cut / paste
    const handleCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    // Handle genuine tab switch / window hide
    const handleVisibilityChange = () => {
      const now = Date.now();

      // 1. Initial 10-second grace period after exam begins
      if (now - mountTimeRef.current < 10000) {
        return;
      }

      // 2. Ignore if fullscreen changed within last 4 seconds
      if (now - lastFullscreenToggleRef.current < 4000) {
        return;
      }

      // 3. Clear any pending verification timer if document becomes visible again
      if (document.visibilityState !== 'hidden') {
        if (hiddenTimerRef.current) {
          clearTimeout(hiddenTimerRef.current);
          hiddenTimerRef.current = null;
        }
        return;
      }

      // 4. If warning modal is already being displayed, do not count further violations
      if (isWarningModalOpenRef.current) {
        return;
      }

      // 5. Debounce: at least 5 seconds between registered infractions
      if (now - lastSwitchTimeRef.current < 5000) {
        return;
      }

      // 6. Verify that document remains sustained hidden for at least 1200ms
      // (filters out microsecond OS window flicker, notifications, or permissions checks)
      if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current);
      }

      hiddenTimerRef.current = setTimeout(() => {
        hiddenTimerRef.current = null;
        // Re-check sustained hidden state
        if (document.visibilityState === 'hidden') {
          const actionNow = Date.now();
          lastSwitchTimeRef.current = actionNow;
          switchCountRef.current += 1;
          const count = switchCountRef.current;

          if (count === 1) {
            onWarning(1);
          } else if (count >= 2) {
            onDisqualify("2-marta boshqa oynaga/tabga o'tish qoidabuzarligi aniqlangani sababli imtihon to'xtatildi!");
          }
        }
      }, 1200);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('copy', handleCopyCutPaste, true);
    window.addEventListener('cut', handleCopyCutPaste, true);
    window.addEventListener('paste', handleCopyCutPaste, true);
    document.addEventListener('visibilitychange', handleVisibilityChange, true);

    return () => {
      if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current);
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('copy', handleCopyCutPaste, true);
      window.removeEventListener('cut', handleCopyCutPaste, true);
      window.removeEventListener('paste', handleCopyCutPaste, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    };
  }, [isActive, onWarning, onDisqualify]);

  return {
    switchCount: switchCountRef.current,
  };
}
