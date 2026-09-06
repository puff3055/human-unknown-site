(() => {
  'use strict';

  const contact = document.getElementById('contact');
  const world = document.getElementById('worldOne');
  const bridge = document.getElementById('journeyBridge');
  const carrier = document.getElementById('journeyCarrier');
  const nextButton = document.getElementById('worldNext');
  if (!contact || !world || !bridge || !carrier || !window.__worldOne) return;

  const ENTRY_NODE = 'spore-center-low';
  const ARRIVAL_DURATION_MS = 860;
  let descentFrame = 0;
  let descentStarted = false;
  let handoffCommitted = false;
  let carrierAnimation = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smoothstep = (edge0, edge1, value) => {
    const amount = clamp((value - edge0) / Math.max(.0001, edge1 - edge0), 0, 1);
    return amount * amount * (3 - 2 * amount);
  };

  function getHomeState() {
    return window.__humanUnknown?.getState?.() || null;
  }

  function getPupilPosition(home = getHomeState()) {
    const gaze = home?.gaze || { x: 0, y: 0 };
    return {
      x: window.innerWidth / 2 + (Number(gaze.x) || 0),
      y: window.innerHeight / 2 + (Number(gaze.y) || 0),
    };
  }

  function setCarrierPose(point, scale, opacity) {
    bridge.style.setProperty('--journey-carrier-x', `${point.x.toFixed(2)}px`);
    bridge.style.setProperty('--journey-carrier-y', `${point.y.toFixed(2)}px`);
    bridge.style.setProperty('--journey-carrier-scale', scale.toFixed(4));
    bridge.style.setProperty('--journey-carrier-opacity', opacity.toFixed(4));
  }

  function updateDescent() {
    if (!descentStarted || handoffCommitted) return;
    const home = getHomeState();
    if (!home) {
      descentFrame = requestAnimationFrame(updateDescent);
      return;
    }

    const entry = clamp(Number(home.encounter?.entry) || 0, 0, 1);
    const copyIn = smoothstep(.12, .30, entry);
    const copyOut = 1 - smoothstep(.68, .84, entry);
    const carrierIn = smoothstep(.60, .84, entry);
    const scale = .34 - smoothstep(.58, 1, entry) * .08;
    bridge.style.setProperty('--journey-copy-opacity', (copyIn * copyOut * .82).toFixed(4));
    setCarrierPose(getPupilPosition(home), scale, carrierIn);
    descentFrame = requestAnimationFrame(updateDescent);
  }

  function prepareDescent() {
    if (descentStarted) return;
    descentStarted = true;
    window.__worldOne.prepareEntry({ source: 'homepage-v4.5', nodeId: ENTRY_NODE });
    bridge.dataset.state = 'descent';
    bridge.dataset.carrierNode = ENTRY_NODE;
    cancelAnimationFrame(descentFrame);
    descentFrame = requestAnimationFrame(updateDescent);
  }

  function carrierTransform(point, scale) {
    return `translate3d(${point.x.toFixed(2)}px, ${point.y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(4)})`;
  }

  function commitHandoff() {
    if (handoffCommitted) return;
    handoffCommitted = true;
    prepareDescent();
    cancelAnimationFrame(descentFrame);

    const home = getHomeState();
    const origin = getPupilPosition(home);
    const preparedTarget = window.__worldOne.getNodeScreenPosition(ENTRY_NODE);
    const target = window.__worldOne.commitEntry({
      source: 'homepage-v4.5',
      nodeId: ENTRY_NODE,
      arrivalDelayMs: ARRIVAL_DURATION_MS,
    }) || preparedTarget || { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    contact.classList.add('is-world-hidden');
    contact.inert = true;
    bridge.dataset.state = 'crossing';
    bridge.dataset.cutCount = String((Number(bridge.dataset.cutCount) || 0) + 1);
    bridge.style.setProperty('--journey-copy-opacity', '0');
    setCarrierPose(origin, .26, 1);

    carrierAnimation?.cancel();
    carrierAnimation = carrier.animate([
      { transform: carrierTransform(origin, .26), opacity: 1, offset: 0 },
      {
        transform: carrierTransform({
          x: origin.x + (target.x - origin.x) * .72,
          y: origin.y + (target.y - origin.y) * .72,
        }, .15),
        opacity: 1,
        offset: .58,
      },
      { transform: carrierTransform(target, .09), opacity: 1, offset: 1 },
    ], {
      duration: ARRIVAL_DURATION_MS,
      easing: 'cubic-bezier(.16,.84,.28,1)',
      fill: 'forwards',
    });

    carrierAnimation.finished.then(() => {
      setCarrierPose(target, .09, 1);
      bridge.dataset.state = 'impact';
      window.setTimeout(() => {
        bridge.style.setProperty('--journey-carrier-opacity', '0');
        bridge.dataset.state = 'idle';
      }, 540);
    }).catch(() => {});
  }

  contact.addEventListener('humanunknown:phasechange', (event) => {
    if (event.detail?.phase === 'entering') prepareDescent();
  });
  window.addEventListener('humanunknown:homepage-exit', commitHandoff, { once: true });
  world.addEventListener('greenbody:exit', (event) => {
    if (event.detail?.destination === 'home') window.location.reload();
  });
  nextButton?.addEventListener('click', () => {
    window.HumanUnknownJourney?.go('planet-neuron/index.html', { kind: 'scale' });
  });

  window.__humanUnknownJourney = {
    getState: () => ({
      state: bridge.dataset.state,
      carrierNode: bridge.dataset.carrierNode,
      cutCount: Number(bridge.dataset.cutCount) || 0,
      descentStarted,
      handoffCommitted,
      arrivalDurationMs: ARRIVAL_DURATION_MS,
      contract: {
        version: 'home-green-0.1',
        sourceEvent: 'humanunknown:homepage-exit',
        destination: 'green-body',
        entryNode: ENTRY_NODE,
        seam: 'single-carrier-hard-cut',
      },
    }),
  };
})();
