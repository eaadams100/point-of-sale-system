/**
 * BarcodeScanner — universal barcode scanner service
 *
 * Hardware scanners act as keyboard wedges: they type characters rapidly
 * and send Enter (keyCode 13) at the end. We detect this by:
 *   1. Buffering keystrokes
 *   2. Checking if they arrived faster than a human can type (< 50ms apart)
 *   3. Treating the buffered string as a barcode on Enter
 *
 * Usage:
 *   BarcodeScanner.init();
 *   BarcodeScanner.onScan(barcode => { ... });
 *   BarcodeScanner.destroy();
 */

const BarcodeScanner = (() => {
  const MIN_LENGTH     = 3;       // ignore codes shorter than this
  const MAX_CHAR_DELAY = 50;      // ms — scanner types faster than this
  const INDICATOR_ID   = 'barcode-indicator';

  let buffer       = '';
  let lastKeyTime  = 0;
  let handlers     = [];
  let listening    = false;
  let lastScanTime = 0;
  const DEBOUNCE   = 500; // ms — ignore duplicate scans within this window

  // ── Audio feedback ──────────────────────────
  function beep(success = true) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = success ? 1200 : 400;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.12 : 0.25));
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + (success ? 0.12 : 0.25));
    } catch(_) {}
  }

  // ── Visual indicator ─────────────────────────
  function flashIndicator(success = true) {
    const el = document.getElementById(INDICATOR_ID);
    if (!el) return;
    el.className = `scanner-indicator ${success ? 'flash-ok' : 'flash-err'}`;
    el.textContent = success ? '▮ SCAN OK' : '▮ NOT FOUND';
    setTimeout(() => {
      el.className = 'scanner-indicator idle';
      el.textContent = '▮ READY';
    }, 800);
  }

  // ── Keydown handler ───────────────────────────
  function onKeyDown(e) {
    // Ignore if focus is inside an input/textarea/select (manual typing)
    const tag = document.activeElement && document.activeElement.tagName;
    const isEditable = document.activeElement && document.activeElement.isContentEditable;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || isEditable) {
      // Special case: if the focused input is the designated barcode field, allow it
      if (!document.activeElement.dataset.barcodeInput) return;
    }

    const now = Date.now();

    if (e.key === 'Enter') {
      const code = buffer.trim();
      buffer = '';
      if (code.length >= MIN_LENGTH) {
        const timeSinceLast = now - lastScanTime;
        if (timeSinceLast > DEBOUNCE) {
          lastScanTime = now;
          dispatch(code);
        }
      }
      return;
    }

    // Reset buffer if there's a long gap (human typing)
    if (now - lastKeyTime > MAX_CHAR_DELAY && buffer.length > 0) {
      buffer = '';
    }

    lastKeyTime = now;

    // Only collect printable characters
    if (e.key.length === 1) {
      buffer += e.key;
    }
  }

  function dispatch(code) {
    handlers.forEach(fn => {
      try { fn(code); } catch(err) { console.error('BarcodeScanner handler error:', err); }
    });
  }

  // ── Public API ────────────────────────────────
  return {
    init() {
      if (listening) return;
      document.addEventListener('keydown', onKeyDown);
      listening = true;
      this.renderIndicator();
    },

    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      listening = false;
      handlers = [];
    },

    onScan(fn) {
      handlers.push(fn);
    },

    offScan(fn) {
      handlers = handlers.filter(h => h !== fn);
    },

    // Call after a successful scan lookup
    scanSuccess() {
      beep(true);
      flashIndicator(true);
    },

    // Call when a scanned code wasn't found
    scanError() {
      beep(false);
      flashIndicator(false);
    },

    // Render the status indicator into a container element
    renderIndicator(containerId = null) {
      // Remove existing
      const old = document.getElementById(INDICATOR_ID);
      if (old) old.remove();

      const el = document.createElement('div');
      el.id = INDICATOR_ID;
      el.className = 'scanner-indicator idle';
      el.textContent = '▮ READY';

      if (containerId) {
        const container = document.getElementById(containerId);
        if (container) { container.appendChild(el); return; }
      }

      // Default: inject into topbar
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.insertBefore(el, topbar.querySelector('#logout-btn'));
      } else {
        document.body.appendChild(el);
      }
    },

    // Simulate a scan (for testing without hardware)
    simulate(code) {
      dispatch(code);
    }
  };
})();
