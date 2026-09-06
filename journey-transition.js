(() => {
  'use strict';

  const STORAGE_KEY = 'human-unknown:journey-transfer';
  const MAX_TRANSFER_AGE = 20000;
  let leaving = false;

  const copyByKind = Object.freeze({
    scale: {
      eyebrow: 'CHAPTER 02 · SCALE UNKNOWN',
      line: '边界消失以后，尺度也开始失效。',
      title: '再远一点。',
    },
    branch: {
      eyebrow: 'CHAPTER 03 · MULTIVERSE',
      line: '你看见的尺度，只是现实的一个切面。',
      title: '再向外，现实开始分岔。',
    },
  });

  function safeReadTransfer() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (!value || Date.now() - Number(value.createdAt) > MAX_TRANSFER_AGE) return null;
      return value;
    } catch (_) {
      return null;
    }
  }

  function clearTransfer() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function createOverlay(kind, state, customCopy = {}) {
    const copy = { ...(copyByKind[kind] || copyByKind.scale), ...customCopy };
    const overlay = document.createElement('div');
    overlay.className = 'journey-transition';
    overlay.dataset.kind = kind;
    overlay.dataset.state = state;
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', '正在进入下一个世界');

    const paragraph = document.createElement('p');
    paragraph.className = 'journey-transition__copy';
    const eyebrow = document.createElement('span');
    eyebrow.textContent = copy.eyebrow;
    const title = document.createElement('strong');
    title.textContent = copy.line;
    const ending = document.createElement('small');
    ending.textContent = copy.title;
    paragraph.append(eyebrow, title, ending);

    const carrier = document.createElement('i');
    carrier.className = 'journey-transition__carrier';
    carrier.setAttribute('aria-hidden', 'true');
    overlay.append(paragraph, carrier);
    document.body.append(overlay);
    return overlay;
  }

  function go(href, options = {}) {
    if (leaving) return;
    leaving = true;
    const kind = options.kind === 'branch' ? 'branch' : 'scale';
    const target = new URL(href, window.location.href);
    const transfer = {
      kind,
      targetPath: target.pathname,
      createdAt: Date.now(),
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(transfer)); } catch (_) {}

    document.body.classList.add('is-journey-leaving');
    const overlay = createOverlay(kind, 'leaving', options.copy);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-copy-visible')));
    window.setTimeout(() => overlay.classList.add('is-copy-gone'), 1450);
    window.setTimeout(() => overlay.classList.add('is-carrier-visible'), 1620);
    window.setTimeout(() => window.location.assign(target.href), 2920);
  }

  function revealArrival() {
    const transfer = safeReadTransfer();
    if (!transfer || transfer.targetPath !== window.location.pathname) {
      clearTransfer();
      return;
    }
    clearTransfer();
    const overlay = createOverlay(transfer.kind, 'arriving');
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-revealing')));
    window.setTimeout(() => overlay.remove(), 1700);
  }

  window.HumanUnknownJourney = Object.freeze({ go, getPendingTransfer: safeReadTransfer });
  revealArrival();
})();
