(() => {
  'use strict';

  const LIFE_EVENT_COUNT = 3;
  const WAVE_COUNT = 3;
  const LIFE_KIND = Object.freeze({
    decay: -1,
    transfer: 0,
    growth: 1,
  });

  const contact = document.getElementById('contact');
  const cosmos = document.getElementById('cosmos');
  const nebulaCanvas = document.getElementById('nebulaCanvas');
  const nebulaFallback = document.getElementById('nebulaFallback');
  const guideText = document.getElementById('guideText');
  const gazeCountdown = document.getElementById('gazeCountdown');
  const countdownNumber = document.getElementById('countdownNumber');
  const entryControl = document.getElementById('entryControl');
  const contactCursor = document.getElementById('contactCursor');
  const soundToggle = document.getElementById('soundToggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const encounterApi = window.HumanUnknownEncounter;
  const encounterTiming = encounterApi
    ? (reduceMotion ? encounterApi.REDUCED_TIMING : encounterApi.STANDARD_TIMING)
    : { guideSwapMs: reduceMotion ? 80 : 400 };
  const guideSwapDelay = encounterTiming.guideSwapMs;
  const encounter = encounterApi
    ? new encounterApi.EncounterMachine({ reducedMotion: reduceMotion })
    : null;
  const soundscape = window.LivingSoundscape && soundToggle
    ? new window.LivingSoundscape(soundToggle)
    : null;
  const lightCursor = window.HumanUnknownLightCursor && contactCursor
    ? new window.HumanUnknownLightCursor(contactCursor, { reducedMotion: reduceMotion })
    : null;

  const formatGuide = (copy) => `“${copy}”`;

  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    previousX: window.innerWidth / 2,
    previousY: window.innerHeight / 2,
    hasMoved: false,
    inside: true,
    travel: 0,
    speed: 0,
    eventSpeed: 0,
    previousEventSpeed: 0,
    acceleration: 0,
    targetVelocityX: 0,
    targetVelocityY: 0,
    velocityX: 0,
    velocityY: 0,
    directionX: 1,
    directionY: 0,
    disturbance: 0,
    stillness: 0,
    lastMovedAt: 0,
    lastEventAt: 0,
    stopWaveArmed: false,
  };

  const interaction = {
    inputType: 'none',
    intentTravel: 0,
    intentSamples: 0,
    intentional: false,
    touchActive: false,
    keyboardActive: false,
    entryActive: false,
    outer: false,
    core: false,
    coreAmount: 0,
  };

  const gaze = {
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    perceivedX: 0,
    perceivedY: 0,
  };

  const presence = {
    awareness: 0,
    targetAwareness: 0,
    approach: 0,
    targetApproach: 0,
    proximity: 0,
    previousProximity: 0,
    study: 0,
    targetStudy: 0,
    hold: 0,
    targetHold: 0,
    studyStartedAt: 0,
  };

  const curiosity = {
    energy: 0,
    adaptation: 0,
    armed: true,
    lastImpulseAt: 0,
    lastImpulseKind: 'none',
    visitedCells: new Set(),
  };

  const pupil = {
    value: 0,
    amplitude: 0,
    active: false,
    startedAt: 0,
    riseDuration: 0,
    holdDuration: 0,
    fallDuration: 0,
    lastCompletedAt: 0,
  };

  const LIFE_ZONES = [
    { x: -0.54, y: -0.42, directionX: 0.72, directionY: 0.28, lastUsedAt: -Infinity },
    { x: 0.48, y: -0.43, directionX: -0.48, directionY: 0.42, lastUsedAt: -Infinity },
    { x: -0.60, y: 0.24, directionX: 0.62, directionY: -0.20, lastUsedAt: -Infinity },
    { x: 0.57, y: 0.30, directionX: -0.66, directionY: -0.18, lastUsedAt: -Infinity },
    { x: -0.15, y: -0.64, directionX: 0.20, directionY: 0.82, lastUsedAt: -Infinity },
    { x: 0.10, y: 0.63, directionX: -0.12, directionY: -0.88, lastUsedAt: -Infinity },
    { x: -0.38, y: 0.53, directionX: 0.52, directionY: -0.55, lastUsedAt: -Infinity },
    { x: 0.36, y: -0.58, directionX: -0.32, directionY: 0.68, lastUsedAt: -Infinity },
  ];

  const metabolism = {
    startedAt: 0,
    events: new Array(LIFE_EVENT_COUNT).fill(null),
    lifeA: new Float32Array(LIFE_EVENT_COUNT * 4),
    lifeB: new Float32Array(LIFE_EVENT_COUNT * 4),
    activeCount: 0,
    growthCount: 0,
    decayCount: 0,
    transferCount: 0,
    lastZoneIndex: -1,
  };

  const waves = {
    items: [],
    waveA: new Float32Array(WAVE_COUNT * 4),
    waveB: new Float32Array(WAVE_COUNT * 4),
    nextAllowedAt: 0,
    serial: 0,
  };

  let nebula = null;
  let phase = 'opening';
  let lifeState = 'resting';
  let firstContactAt = 0;
  let guideSwapTimer = 0;
  let pendingGuide = '';
  let reducedFrameTimer = 0;
  let exitEventDispatched = false;
  let entryOriginX = 0;
  let entryOriginY = 0;
  let encounterState = encounter ? encounter.getState() : {
    phase: 'opening',
    intro: 'blackout',
    guide: '',
    reveal: 0,
    guideExit: 0,
    finalGuideReadComplete: false,
    finalGuideComplete: false,
    countdownReady: false,
    countdownState: 'waiting',
    countdownValue: null,
    hold: 0,
    entry: 0,
    zoom: 0,
    collapse: 0,
    boundarySilence: 0,
    fall: 0,
    noticeSerial: 0,
    handoff: false,
    reducedMotion: reduceMotion,
  };
  let lastFrame = performance.now();
  let telemetryFrame = 0;
  let frameWindowStartedAt = lastFrame;
  let frameWindowCount = 0;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function easeInOut(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function damp(current, target, rate, deltaSeconds) {
    return current + (target - current) * (1 - Math.exp(-rate * deltaSeconds));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function normalizeDirection(x, y, fallbackX = 1, fallbackY = 0) {
    const length = Math.hypot(x, y);
    if (length < 0.0001) return { x: fallbackX, y: fallbackY };
    return { x: x / length, y: y / length };
  }

  function reveal() {
    if (contact.classList.contains('is-ready')) return;
    contact.classList.add('is-ready');
    if (encounter) encounter.start(performance.now());
  }

  function showStaticFallback() {
    contact.classList.add('no-webgl');
    nebulaCanvas.dataset.renderer = 'fallback';
  }

  function showReducedMotionFallback() {
    contact.classList.add('no-webgl');
    nebulaCanvas.dataset.renderer = 'static-reduced-motion';
    nebulaCanvas.dataset.texture = 'continuous-static';

    if (nebulaFallback.complete) {
      requestAnimationFrame(reveal);
    } else {
      nebulaFallback.addEventListener('load', reveal, { once: true });
    }
  }

  function recoverNebula() {
    const interruptedNebula = nebula;
    nebula = null;
    if (interruptedNebula) interruptedNebula.destroy();
    bootNebula();
  }

  async function bootNebula() {
    if (!encounter) {
      console.warn('Encounter state machine is unavailable; static fallback enabled.');
      showStaticFallback();
      reveal();
      return;
    }

    if (reduceMotion) {
      showReducedMotionFallback();
      return;
    }

    try {
      if (!window.LivingNebula) throw new Error('Living nebula renderer is unavailable');
      nebula = new window.LivingNebula(nebulaCanvas, {
        reducedMotion: reduceMotion,
        onContextLost: showStaticFallback,
        onContextRestored: recoverNebula,
      });
      await nebula.init('assets/home-contact-background.png');
      contact.classList.remove('no-webgl');
      nebulaCanvas.dataset.renderer = 'living-nebula';
      nebulaCanvas.dataset.texture = 'continuous';
      initializeMetabolism(performance.now());
      nebula.render(0, {
        pointerX: 0,
        pointerY: 0,
        reveal: 0,
        zoom: 0,
        entry: 0,
        lifeA: metabolism.lifeA,
        lifeB: metabolism.lifeB,
        waveA: waves.waveA,
        waveB: waves.waveB,
      });
      requestAnimationFrame(reveal);
    } catch (error) {
      console.warn('Living nebula fallback enabled:', error.message);
      showStaticFallback();
      if (nebulaFallback.complete) {
        requestAnimationFrame(reveal);
      } else {
        nebulaFallback.addEventListener('load', reveal, { once: true });
      }
    }
  }

  function setLifeState(nextState) {
    if (lifeState === nextState) return;
    lifeState = nextState;
    contact.dataset.life = nextState;
  }

  function setGuide(copy) {
    const displayCopy = formatGuide(copy);
    if (guideText.textContent === displayCopy || pendingGuide === copy) return;
    window.clearTimeout(guideSwapTimer);

    if (!guideText.textContent) {
      guideText.textContent = displayCopy;
      pendingGuide = '';
      requestAnimationFrame(() => guideText.classList.add('is-visible'));
      return;
    }

    pendingGuide = copy;
    guideText.classList.remove('is-visible');
    guideSwapTimer = window.setTimeout(() => {
      guideText.textContent = displayCopy;
      guideText.classList.add('is-visible');
      pendingGuide = '';
    }, guideSwapDelay);
  }

  function isSoundTarget(target) {
    return Boolean(
      target
      && target.closest
      && target.closest('#soundToggle')
    );
  }

  function isEntryTarget(target) {
    return Boolean(target && target.closest && target.closest('#entryControl'));
  }

  function setEntryActive(active) {
    interaction.entryActive = Boolean(active && phase === 'aligned');
    entryControl?.classList.toggle('is-holding', interaction.entryActive);
  }

  function isPointerOverSoundControl() {
    if (
      !soundToggle
      || soundToggle.disabled
      || !pointer.inside
      || contact.dataset.intro === 'blackout'
    ) return false;
    const bounds = soundToggle.getBoundingClientRect();
    return pointer.x >= bounds.left
      && pointer.x <= bounds.right
      && pointer.y >= bounds.top
      && pointer.y <= bounds.bottom;
  }

  function isTrackingPhase(value = phase) {
    return value === 'contact'
      || value === 'near'
      || value === 'noticed'
      || value === 'aligned';
  }

  function markIntentionalInput(now, inputType) {
    if (interaction.intentional || !encounter) return;
    interaction.intentional = true;
    interaction.inputType = inputType;
    firstContactAt = now;
    contact.dataset.input = inputType;
    encounter.markIntent(now);
  }

  function getContactIsActive() {
    return encounterApi.resolveContactActive({
      inputType: interaction.inputType,
      touchActive: interaction.touchActive,
      keyboardActive: interaction.keyboardActive,
      hasMoved: pointer.hasMoved,
      pointerInside: pointer.inside,
    });
  }

  function applyEncounterState(nextState, now) {
    const previousPhase = phase;
    encounterState = nextState;
    phase = nextState.phase;

    if (previousPhase !== phase && phase === 'entering') {
      entryOriginX = gaze.x;
      entryOriginY = gaze.y;
    }

    contact.dataset.intro = nextState.intro;
    contact.dataset.phase = phase;
    contact.dataset.hold = nextState.hold.toFixed(3);
    contact.dataset.entry = nextState.entry.toFixed(3);
    contact.dataset.countdown = nextState.countdownState;
    contact.dataset.countdownValue = nextState.countdownValue === null
      ? ''
      : String(nextState.countdownValue);
    contact.dataset.hotzone = interaction.core
      ? 'core'
      : interaction.outer
        ? 'outer'
        : 'none';
    contact.dataset.exitReady = String(nextState.handoff);
    contact.setAttribute('aria-busy', String(phase === 'entering'));

    const reveal = clamp(nextState.reveal, 0, 1);
    const entry = clamp(nextState.entry, 0, 1);
    const zoom = reduceMotion ? 0 : clamp(nextState.zoom || 0, 0, 1);
    const cosmosScale = reduceMotion
      ? 1
      : 1 + nextState.hold * 0.05 + zoom * 3.55;
    const guideExit = 1 - clamp(nextState.guideExit || 0, 0, 1);
    const finalBlack = smoothstep(0.86, 1, zoom);
    const handoffBlack = Math.max(finalBlack, nextState.handoff ? 1 : 0);
    const pull = phase === 'entering' || phase === 'handoff'
      ? 1
      : phase === 'aligned'
        ? interaction.coreAmount * (0.34 + nextState.hold * 0.66)
        : interaction.coreAmount * 0.16;
    const hotzoneCue = isTrackingPhase(phase)
      ? clamp(
        0.36
          + presence.proximity * 0.36
          + interaction.coreAmount * 0.17
          + nextState.hold * 0.11
          + (nextState.countdownReady ? 0.16 : 0),
        0,
        1
      )
      : 0;
    const hotzoneScale = 0.96
      + interaction.coreAmount * 0.05
      + nextState.hold * 0.07;
    const pupilOriginX = phase === 'entering' || phase === 'handoff'
      ? entryOriginX
      : gaze.x;
    const pupilOriginY = phase === 'entering' || phase === 'handoff'
      ? entryOriginY
      : gaze.y;

    contact.style.setProperty('--intro-reveal', reveal.toFixed(4));
    contact.style.setProperty('--cosmos-brightness', (0.18 + reveal * 0.82).toFixed(3));
    contact.style.setProperty('--cosmos-contrast', (1.72 - reveal * 0.72).toFixed(3));
    contact.style.setProperty('--cosmos-scale', cosmosScale.toFixed(4));
    contact.style.setProperty('--entry-shift-y', '0px');
    contact.style.setProperty('--entry-scale', '1');
    contact.style.setProperty('--guide-exit-opacity', guideExit.toFixed(4));
    contact.style.setProperty('--handoff-black', handoffBlack.toFixed(4));
    contact.style.setProperty('--contact-proximity', presence.proximity.toFixed(4));
    contact.style.setProperty('--contact-core', interaction.coreAmount.toFixed(4));
    contact.style.setProperty('--contact-hold', nextState.hold.toFixed(4));
    contact.style.setProperty('--contact-countdown', nextState.hold.toFixed(4));
    contact.style.setProperty('--contact-pull', pull.toFixed(4));
    contact.style.setProperty('--contact-entry', entry.toFixed(4));
    contact.style.setProperty('--hotzone-cue', hotzoneCue.toFixed(4));
    contact.style.setProperty('--hotzone-scale', hotzoneScale.toFixed(4));
    contact.style.setProperty('--pupil-x', `${pupilOriginX.toFixed(2)}px`);
    contact.style.setProperty('--pupil-y', `${pupilOriginY.toFixed(2)}px`);

    if (nextState.guide && guideText.textContent !== formatGuide(nextState.guide)) {
      setGuide(nextState.guide);
    }

    if (countdownNumber && gazeCountdown) {
      const showCountdown = (
        nextState.countdownState === 'active'
        || nextState.countdownState === 'releasing'
      ) && nextState.countdownValue !== null;
      const countdownCopy = showCountdown ? String(nextState.countdownValue) : '';
      if (countdownNumber.textContent !== countdownCopy) {
        countdownNumber.textContent = countdownCopy;
      }
      gazeCountdown.setAttribute('aria-hidden', String(!showCountdown));
    }

    presence.targetAwareness = isTrackingPhase(phase) || phase === 'entering' ? 1 : 0;
    presence.targetHold = nextState.hold;

    if (previousPhase !== phase) {
      if (phase === 'contact') {
        setLifeState('sensing');
      } else if (phase === 'near') {
        setLifeState('observing');
      } else if (phase === 'noticed') {
        setLifeState('orienting');
        addCuriosityImpulse(1.12, 'mutual-notice', now);
        startPupilReaction(now, 1);
      } else if (phase === 'aligned') {
        setLifeState('approaching');
      } else if (phase === 'entering') {
        setLifeState('entering');
      } else if (phase === 'handoff') {
        setLifeState('handoff');
      }

      contact.dispatchEvent(new CustomEvent('humanunknown:phasechange', {
        detail: {
          phase,
          intro: nextState.intro,
          noticeSerial: nextState.noticeSerial,
        },
      }));
    }

    if (nextState.handoff && !exitEventDispatched) {
      exitEventDispatched = true;
      window.dispatchEvent(new CustomEvent('humanunknown:homepage-exit', {
        detail: {
          source: 'homepage-v4',
          phase: 'handoff',
          reducedMotion: reduceMotion,
          completedAt: now,
        },
      }));
    }
  }

  function addCuriosityImpulse(amount, kind, now) {
    if (reduceMotion || amount <= 0) return;
    const repeated = curiosity.lastImpulseKind === kind
      && now - curiosity.lastImpulseAt < 900;
    const repetitionScale = repeated ? 0.42 : 1;
    const adaptationScale = 1 - curiosity.adaptation * 0.58;

    curiosity.energy = clamp(
      curiosity.energy + amount * repetitionScale * adaptationScale,
      0,
      1.4
    );
    curiosity.adaptation = clamp(
      curiosity.adaptation + (repeated ? 0.12 : 0.035),
      0,
      1
    );
    curiosity.lastImpulseAt = now;
    curiosity.lastImpulseKind = kind;
  }

  function pickLifeZone(now, excludedIndexes = []) {
    const cooledZones = LIFE_ZONES
      .map((zone, index) => ({ zone, index }))
      .filter(({ zone, index }) => (
        index !== metabolism.lastZoneIndex
        && !excludedIndexes.includes(index)
        && now - zone.lastUsedAt > 12500
      ));
    const pool = cooledZones.length > 0
      ? cooledZones
      : LIFE_ZONES
        .map((zone, index) => ({ zone, index }))
        .filter(({ index }) => (
          index !== metabolism.lastZoneIndex
          && !excludedIndexes.includes(index)
        ))
        .sort((a, b) => a.zone.lastUsedAt - b.zone.lastUsedAt)
        .slice(0, 4);
    const selection = pool[Math.floor(Math.random() * pool.length)] || {
      zone: LIFE_ZONES[0],
      index: 0,
    };
    selection.zone.lastUsedAt = now;
    metabolism.lastZoneIndex = selection.index;
    return selection;
  }

  function createLifeEvent(
    slot,
    now,
    kind,
    delay = 0,
    durationOverride = 0,
    sourceEvent = null,
    targetEvent = null
  ) {
    const isTransfer = kind === LIFE_KIND.transfer;
    const excludedIndexes = metabolism.events
      .filter(Boolean)
      .map((event) => event.zoneIndex)
      .filter((index) => index >= 0);
    const selection = isTransfer && sourceEvent
      ? {
        zone: {
          x: sourceEvent.x,
          y: sourceEvent.y,
          directionX: sourceEvent.directionX,
          directionY: sourceEvent.directionY,
        },
        index: sourceEvent.zoneIndex,
      }
      : pickLifeZone(now + delay, excludedIndexes);
    const { zone, index } = selection;
    const jitter = randomBetween(-0.20, 0.20);
    const transferTarget = targetEvent || metabolism.events[0];
    const transferDeltaX = transferTarget
      ? (transferTarget.x - zone.x) * window.innerWidth / Math.max(1, window.innerHeight)
      : zone.directionX;
    const transferDeltaY = transferTarget
      ? transferTarget.y - zone.y
      : zone.directionY;
    const transferDistance = Math.hypot(transferDeltaX, transferDeltaY);
    const direction = isTransfer && transferTarget
      ? normalizeDirection(
        transferDeltaX,
        transferDeltaY,
        zone.directionX,
        zone.directionY
      )
      : normalizeDirection(
        zone.directionX - zone.directionY * jitter,
        zone.directionY + zone.directionX * jitter,
        zone.directionX,
        zone.directionY
      );
    const duration = durationOverride || (
      kind === LIFE_KIND.growth
        ? randomBetween(4700, 6400)
        : kind === LIFE_KIND.decay
          ? randomBetween(5200, 7000)
          : randomBetween(3900, 5200)
    );

    metabolism.events[slot] = {
      slot,
      zoneIndex: index,
      x: zone.x + (isTransfer ? 0 : randomBetween(-0.030, 0.030)),
      y: zone.y + (isTransfer ? 0 : randomBetween(-0.026, 0.026)),
      directionX: direction.x,
      directionY: direction.y,
      kind,
      energy: kind === LIFE_KIND.transfer
        ? randomBetween(0.88, 1.0)
        : randomBetween(0.90, 1.0),
      seed: isTransfer
        ? clamp(transferDistance, 0.48, 1.45)
        : randomBetween(0.05, 0.95),
      startedAt: now + delay,
      duration,
      signalled: false,
      touchedAt: -Infinity,
    };
  }

  function initializeMetabolism(now) {
    metabolism.startedAt = now;
    createLifeEvent(0, now, LIFE_KIND.growth, -950, 5600);
    createLifeEvent(1, now, LIFE_KIND.decay, -1750, 6500);
    createLifeEvent(
      2,
      now,
      LIFE_KIND.transfer,
      650,
      4500,
      metabolism.events[1],
      metabolism.events[0]
    );
  }

  function advectLifeEvents(deltaX, deltaY, clientX, clientY, now) {
    const movement = normalizeDirection(deltaX, deltaY, pointer.directionX, pointer.directionY);

    metabolism.events.forEach((event) => {
      if (!event) return;
      const progress = (now - event.startedAt) / event.duration;
      if (progress < 0 || progress > 0.94) return;

      const position = getEventScreenPosition(event);
      const distance = Math.hypot(clientX - position.x, clientY - position.y);
      const influence = 1 - smoothstep(110, 310, distance);
      if (influence <= 0) return;

      const response = event.kind === LIFE_KIND.transfer ? 0.20 : 0.10;
      event.x = clamp(
        event.x + (deltaX / Math.max(1, window.innerWidth)) * response * influence,
        -0.78,
        0.78
      );
      event.y = clamp(
        event.y + (deltaY / Math.max(1, window.innerHeight)) * response * influence,
        -0.76,
        0.76
      );
      const blendedDirection = normalizeDirection(
        event.directionX * (1 - 0.12 * influence) + movement.x * 0.12 * influence,
        event.directionY * (1 - 0.12 * influence) + movement.y * 0.12 * influence,
        event.directionX,
        event.directionY
      );
      event.directionX = blendedDirection.x;
      event.directionY = blendedDirection.y;
      event.touchedAt = now;
    });
  }

  function getEventScreenPosition(event) {
    return {
      x: (event.x * 0.5 + 0.5) * window.innerWidth,
      y: (event.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function spawnWave({
    x,
    y,
    directionX,
    directionY,
    energy,
    now,
    kind,
    reach,
    duration,
    bypassCadence = false,
  }) {
    if (reduceMotion) return false;
    if (!bypassCadence && now < waves.nextAllowedAt) return false;

    waves.items = waves.items.filter((wave) => (
      (now - wave.startedAt) / wave.duration < 1.035
    ));

    if (waves.items.length >= WAVE_COUNT) {
      const recyclableIndex = waves.items.findIndex((wave) => {
        const progress = (now - wave.startedAt) / wave.duration;
        return progress > 0.92 && wave.energy * (1 - progress) < 0.055;
      });
      if (recyclableIndex === -1) return false;
      waves.items.splice(recyclableIndex, 1);
    }

    const direction = normalizeDirection(
      directionX,
      directionY,
      pointer.directionX,
      pointer.directionY
    );
    const clampedEnergy = clamp(energy, 0.35, 1);
    waves.items.push({
      id: ++waves.serial,
      x,
      y,
      directionX: direction.x,
      directionY: direction.y,
      energy: clampedEnergy,
      startedAt: now,
      duration: duration || randomBetween(3200, 5800),
      reach: reach || randomBetween(280, 445),
      seed: randomBetween(0.02, 0.98),
      kind,
    });
    waves.nextAllowedAt = now + randomBetween(280, 760);
    return true;
  }

  function advectExistingWaves(deltaX, deltaY, clientX, clientY) {
    const movementLength = Math.hypot(deltaX, deltaY);
    if (movementLength < 0.5) return;
    const movementDirection = normalizeDirection(deltaX, deltaY);
    const now = performance.now();

    waves.items.forEach((wave) => {
      const progress = clamp((now - wave.startedAt) / wave.duration, 0, 1);
      const distance = Math.hypot(clientX - wave.x, clientY - wave.y);
      const influence = 1 - smoothstep(90, 330, distance);
      if (influence <= 0 || progress > 0.96) return;

      const carry = influence * (1 - progress * 0.55);
      wave.x += deltaX * 0.22 * carry;
      wave.y += deltaY * 0.22 * carry;
      const blended = normalizeDirection(
        wave.directionX * (1 - 0.12 * carry) + movementDirection.x * 0.12 * carry,
        wave.directionY * (1 - 0.12 * carry) + movementDirection.y * 0.12 * carry
      );
      wave.directionX = blended.x;
      wave.directionY = blended.y;
    });
  }

  function updatePointer(
    clientX,
    clientY,
    pointerType = 'mouse',
    now = performance.now(),
    options = {}
  ) {
    const hadMoved = pointer.hasMoved;
    const deltaX = clientX - pointer.previousX;
    const deltaY = clientY - pointer.previousY;
    const distance = Math.hypot(deltaX, deltaY);
    const elapsedSeconds = clamp(
      pointer.lastEventAt ? (now - pointer.lastEventAt) / 1000 : 0.016,
      0.008,
      0.12
    );
    const rawVelocityX = deltaX / elapsedSeconds;
    const rawVelocityY = deltaY / elapsedSeconds;
    const eventSpeed = Math.hypot(rawVelocityX, rawVelocityY);
    const previousDirection = normalizeDirection(
      pointer.targetVelocityX,
      pointer.targetVelocityY,
      pointer.directionX,
      pointer.directionY
    );
    const nextDirection = normalizeDirection(
      rawVelocityX,
      rawVelocityY,
      pointer.directionX,
      pointer.directionY
    );
    const directionDot = previousDirection.x * nextDirection.x
      + previousDirection.y * nextDirection.y;

    pointer.travel += distance;
    pointer.previousEventSpeed = pointer.eventSpeed;
    pointer.eventSpeed = eventSpeed;
    pointer.acceleration = Math.abs(eventSpeed - pointer.previousEventSpeed)
      / elapsedSeconds;
    pointer.targetVelocityX = rawVelocityX;
    pointer.targetVelocityY = rawVelocityY;
    pointer.x = clientX;
    pointer.y = clientY;
    pointer.previousX = clientX;
    pointer.previousY = clientY;
    pointer.lastEventAt = now;
    const moved = distance > 1.5;
    pointer.hasMoved = pointer.hasMoved || moved || Boolean(options.explicit);
    pointer.inside = true;
    interaction.inputType = pointerType;
    contact.dataset.input = pointerType;

    if (options.countIntent !== false && moved) {
      interaction.intentSamples += 1;
      interaction.intentTravel += Math.min(distance, 96);
      if (interaction.intentSamples >= 2 && interaction.intentTravel >= 28) {
        markIntentionalInput(now, pointerType);
      }
    }
    if (options.explicit) markIntentionalInput(now, pointerType);

    if (moved) {
      advectExistingWaves(deltaX, deltaY, clientX, clientY);
      advectLifeEvents(deltaX, deltaY, clientX, clientY, now);
      pointer.lastMovedAt = now;
      pointer.stopWaveArmed = eventSpeed > 65;
      pointer.directionX = nextDirection.x;
      pointer.directionY = nextDirection.y;
      pointer.disturbance = Math.max(
        pointer.disturbance,
        clamp(0.28 + eventSpeed / 1350, 0.28, 1)
      );

      if (!hadMoved) {
        addCuriosityImpulse(0.72, 'arrival', now);
      } else {
        const cellWidth = Math.max(1, window.innerWidth / 4);
        const cellHeight = Math.max(1, window.innerHeight / 3);
        const cellKey = `${Math.floor(clientX / cellWidth)}:${Math.floor(clientY / cellHeight)}`;
        if (!curiosity.visitedCells.has(cellKey)) {
          curiosity.visitedCells.add(cellKey);
          addCuriosityImpulse(0.22, 'new-region', now);
        }

        if (directionDot < 0.50 && eventSpeed > 180) {
          addCuriosityImpulse(0.42 * (1 - directionDot), 'direction-change', now);
          spawnWave({
            x: clientX,
            y: clientY,
            directionX: nextDirection.x,
            directionY: nextDirection.y,
            energy: clamp(0.55 + (1 - directionDot) * 0.32, 0.55, 0.92),
            now,
            kind: 'turn',
          });
        } else if (pointer.acceleration > 1450 && eventSpeed > 240) {
          addCuriosityImpulse(0.24, 'acceleration', now);
          spawnWave({
            x: clientX,
            y: clientY,
            directionX: nextDirection.x,
            directionY: nextDirection.y,
            energy: clamp(0.48 + eventSpeed / 2600, 0.48, 0.82),
            now,
            kind: 'acceleration',
            reach: randomBetween(260, 380),
          });
        } else {
          curiosity.adaptation = clamp(curiosity.adaptation + 0.004, 0, 1);
        }
      }

      presence.studyStartedAt = 0;
      if (phase === 'near' || phase === 'noticed') setLifeState('observing');
      if (phase === 'aligned') setLifeState('approaching');
    }

    if (pointerType !== 'touch') {
      contact.classList.add('has-pointer');
      if (lightCursor) {
        lightCursor.moveTo(clientX, clientY);
      } else if (contactCursor) {
        contactCursor.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
      }
    }
  }

  window.addEventListener('pointermove', (event) => {
    if (lightCursor) {
      lightCursor.setHoverTarget(isSoundTarget(event.target) ? 'sound' : 'none');
    }
    updatePointer(
      event.clientX,
      event.clientY,
      event.pointerType,
      performance.now(),
      { countIntent: !isSoundTarget(event.target) }
    );
  }, { passive: true });

  window.addEventListener('pointerdown', (event) => {
    if (lightCursor && event.pointerType !== 'touch') {
      lightCursor.setPressed(true);
      lightCursor.setHoverTarget(isSoundTarget(event.target) ? 'sound' : 'none');
    }
    if (isSoundTarget(event.target)) return;
    if (isEntryTarget(event.target)) {
      setEntryActive(true);
      entryControl.setPointerCapture?.(event.pointerId);
    }
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      interaction.touchActive = true;
    }
    updatePointer(
      event.clientX,
      event.clientY,
      event.pointerType,
      performance.now(),
      { explicit: event.pointerType === 'touch' || event.pointerType === 'pen' }
    );
  }, { passive: true });

  window.addEventListener('pointerup', (event) => {
    setEntryActive(false);
    if (lightCursor) lightCursor.setPressed(false);
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      interaction.touchActive = false;
    }
  }, { passive: true });

  window.addEventListener('pointercancel', (event) => {
    setEntryActive(false);
    if (lightCursor) lightCursor.setPressed(false);
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      interaction.touchActive = false;
      pointer.inside = false;
    }
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (
      event.altKey
      || event.ctrlKey
      || event.metaKey
      || isSoundTarget(event.target)
      || (event.key !== 'Enter' && event.key !== ' ')
    ) return;
    event.preventDefault();
    if (event.repeat) return;
    if (isEntryTarget(event.target)) {
      setEntryActive(true);
      return;
    }
    interaction.keyboardActive = true;
    pointer.x = window.innerWidth / 2 + gaze.x;
    pointer.y = window.innerHeight / 2 + gaze.y;
    pointer.previousX = pointer.x;
    pointer.previousY = pointer.y;
    pointer.hasMoved = true;
    pointer.inside = true;
    pointer.lastMovedAt = performance.now();
    interaction.inputType = 'keyboard';
    contact.dataset.input = 'keyboard';
    markIntentionalInput(pointer.lastMovedAt, 'keyboard');
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      setEntryActive(false);
      interaction.keyboardActive = false;
    }
  });

  document.documentElement.addEventListener('mouseleave', () => {
    pointer.inside = false;
    presence.targetStudy = 0;
    contact.classList.remove('has-pointer');
    if (lightCursor) {
      lightCursor.setPressed(false);
      lightCursor.setHoverTarget('none');
    }
  });

  document.documentElement.addEventListener('mouseenter', () => {
    pointer.inside = true;
    pointer.lastMovedAt = performance.now();
    pointer.lastEventAt = pointer.lastMovedAt;
    if (pointer.hasMoved) contact.classList.add('has-pointer');
  });

  window.addEventListener('blur', () => {
    pointer.inside = false;
    presence.targetStudy = 0;
    interaction.touchActive = false;
    interaction.keyboardActive = false;
    setEntryActive(false);
    contact.classList.remove('has-pointer');
    if (lightCursor) {
      lightCursor.setPressed(false);
      lightCursor.setHoverTarget('none');
    }
  });

  window.addEventListener('focus', () => {
    pointer.inside = true;
    pointer.lastMovedAt = performance.now();
    pointer.lastEventAt = pointer.lastMovedAt;
  });

  window.addEventListener('resize', () => {
    if (!pointer.hasMoved) {
      pointer.x = window.innerWidth / 2;
      pointer.y = window.innerHeight / 2;
      pointer.previousX = pointer.x;
      pointer.previousY = pointer.y;
    }
  });

  function updatePointerDynamics(deltaSeconds, now) {
    const idleFor = pointer.lastMovedAt ? now - pointer.lastMovedAt : Infinity;
    const activelyMoving = pointer.hasMoved && pointer.inside && idleFor < 82;
    const targetVelocityX = activelyMoving ? pointer.targetVelocityX : 0;
    const targetVelocityY = activelyMoving ? pointer.targetVelocityY : 0;
    const velocityRate = activelyMoving ? 16 : 4.4;

    pointer.velocityX = damp(pointer.velocityX, targetVelocityX, velocityRate, deltaSeconds);
    pointer.velocityY = damp(pointer.velocityY, targetVelocityY, velocityRate, deltaSeconds);
    pointer.speed = Math.hypot(pointer.velocityX, pointer.velocityY);

    const disturbanceTarget = activelyMoving
      ? clamp(0.34 + pointer.eventSpeed / 1250, 0.34, 1)
      : 0;
    pointer.disturbance = damp(
      pointer.disturbance,
      disturbanceTarget,
      disturbanceTarget > pointer.disturbance ? 18 : 2.35,
      deltaSeconds
    );
    pointer.stillness = pointer.hasMoved && pointer.inside
      ? smoothstep(75, 390, idleFor)
      : 0;

    if (
      pointer.stopWaveArmed
      && pointer.inside
      && idleFor > 88
      && pointer.eventSpeed > 65
    ) {
      const stopEnergy = clamp(0.56 + pointer.eventSpeed / 2100, 0.56, 0.94);
      spawnWave({
        x: pointer.x,
        y: pointer.y,
        directionX: pointer.directionX,
        directionY: pointer.directionY,
        energy: stopEnergy,
        now,
        kind: 'settling',
        duration: randomBetween(3800, 6000),
        reach: randomBetween(300, 455),
        bypassCadence: true,
      });
      addCuriosityImpulse(clamp(pointer.eventSpeed / 2400, 0.18, 0.40), 'slowdown', now);
      pointer.stopWaveArmed = false;
    }
  }

  function updateStudy(deltaSeconds, now) {
    const idleFor = pointer.lastMovedAt ? now - pointer.lastMovedAt : Infinity;
    const canStudy = pointer.hasMoved
      && pointer.inside
      && isTrackingPhase()
      && idleFor > 72;

    presence.targetStudy = canStudy && !reduceMotion
      ? smoothstep(72, 310, idleFor)
      : 0;
    presence.study = damp(
      presence.study,
      presence.targetStudy,
      presence.targetStudy > presence.study ? 7.8 : 2.9,
      deltaSeconds
    );

    if (presence.targetStudy > 0.16 && !presence.studyStartedAt) {
      presence.studyStartedAt = now;
      setLifeState('studying');
    } else if (!presence.targetStudy && presence.study < 0.04) {
      presence.studyStartedAt = 0;
    }
  }

  function updateGaze(deltaSeconds) {
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const canTrack = pointer.hasMoved
      && pointer.inside
      && isTrackingPhase()
      && !reduceMotion;

    const directionX = canTrack
      ? clamp((pointer.x - viewportCenterX) / Math.max(1, viewportCenterX), -1, 1)
      : 0;
    const directionY = canTrack
      ? clamp((pointer.y - viewportCenterY) / Math.max(1, viewportCenterY), -1, 1)
      : 0;
    const directionLength = Math.hypot(directionX, directionY) || 1;
    const studyReach = presence.study * 7;
    const rawTargetX = directionX * 48 + directionX / directionLength * studyReach;
    const rawTargetY = directionY * 31 + directionY / directionLength * studyReach * 0.68;
    const perceptionRate = canTrack ? 3.0 : 1.25;

    gaze.perceivedX = damp(gaze.perceivedX, rawTargetX, perceptionRate, deltaSeconds);
    gaze.perceivedY = damp(gaze.perceivedY, rawTargetY, perceptionRate, deltaSeconds);

    const stiffness = 17.5;
    const damping = 7.9;
    gaze.velocityX += (
      (gaze.perceivedX - gaze.x) * stiffness - gaze.velocityX * damping
    ) * deltaSeconds;
    gaze.velocityY += (
      (gaze.perceivedY - gaze.y) * stiffness - gaze.velocityY * damping
    ) * deltaSeconds;
    gaze.x += gaze.velocityX * deltaSeconds;
    gaze.y += gaze.velocityY * deltaSeconds;
  }

  function updateApproach(deltaSeconds, now) {
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const pupilX = viewportCenterX + gaze.x;
    const hotzoneOffsetY = window.innerHeight * (window.innerWidth <= 720 ? -0.09 : -0.11);
    const pupilY = viewportCenterY + gaze.y + hotzoneOffsetY;
    const distance = Math.hypot(pointer.x - pupilX, pointer.y - pupilY);
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const hasRealInput = pointer.hasMoved && pointer.inside && interaction.intentional;
    const proximity = hasRealInput
      ? 1 - smoothstep(shortSide * 0.065, shortSide * 0.36, distance)
      : 0;
    const coreAmount = hasRealInput
      ? 1 - smoothstep(shortSide * 0.085, shortSide * 0.145, distance)
      : 0;

    presence.previousProximity = presence.proximity;
    presence.proximity = proximity;
    interaction.outer = hasRealInput && distance <= shortSide * 0.30;
    interaction.core = hasRealInput && distance <= shortSide * 0.125;
    interaction.coreAmount = coreAmount;

    if (
      proximity > 0.58
      && presence.previousProximity <= 0.58
      && isTrackingPhase()
    ) {
      addCuriosityImpulse(0.76, 'approach', now);
      if (pupil.active) pupil.amplitude = Math.max(pupil.amplitude, 0.96);
    }

    const approaching = phase === 'near'
      || phase === 'noticed'
      || phase === 'aligned'
      || phase === 'entering';
    presence.targetApproach = approaching && !reduceMotion ? proximity : 0;
    presence.approach = damp(presence.approach, presence.targetApproach, 3.9, deltaSeconds);
  }

  function startPupilReaction(now, forcedAmplitude = 0) {
    const approachWeight = presence.proximity > 0.58 ? 1 : 0;
    const strength = clamp(curiosity.energy, 0.58, 1.35);
    pupil.active = true;
    pupil.startedAt = now;
    pupil.riseDuration = randomBetween(360, 620);
    pupil.holdDuration = randomBetween(420, 980) * (0.82 + strength * 0.24);
    pupil.fallDuration = randomBetween(1900, 3300);
    pupil.amplitude = clamp(
      Math.max(forcedAmplitude, 0.48 + strength * 0.25 + approachWeight * 0.18),
      0.58,
      1
    );
    curiosity.energy *= 0.38;
    curiosity.adaptation = clamp(curiosity.adaptation + 0.24, 0, 1);
    curiosity.armed = false;
  }

  function updateCuriosity(deltaSeconds, now) {
    const moving = pointer.hasMoved && now - pointer.lastMovedAt < 110;
    const energyDecay = moving
      ? 0.10 + curiosity.adaptation * 0.12
      : 0.16 + curiosity.adaptation * 0.15;
    curiosity.energy = Math.max(0, curiosity.energy - energyDecay * deltaSeconds);
    curiosity.adaptation = damp(
      curiosity.adaptation,
      moving ? 0.44 : 0.08,
      moving ? 0.24 : 0.12,
      deltaSeconds
    );

    if (!pupil.active && curiosity.energy < 0.24) curiosity.armed = true;

    if (reduceMotion || !pupil.active) {
      pupil.value = 0;
      return;
    }

    const elapsed = now - pupil.startedAt;
    const riseEnd = pupil.riseDuration;
    const holdEnd = riseEnd + pupil.holdDuration;
    const fallEnd = holdEnd + pupil.fallDuration;

    if (elapsed < riseEnd) {
      pupil.value = easeInOut(elapsed / riseEnd) * pupil.amplitude;
    } else if (elapsed < holdEnd) {
      const holdProgress = (elapsed - riseEnd) / pupil.holdDuration;
      pupil.value = pupil.amplitude * (1 - Math.sin(holdProgress * Math.PI) * 0.015);
    } else if (elapsed < fallEnd) {
      const fallProgress = (elapsed - holdEnd) / pupil.fallDuration;
      pupil.value = (1 - easeInOut(fallProgress)) * pupil.amplitude;
    } else {
      pupil.value = 0;
      pupil.active = false;
      pupil.lastCompletedAt = now;
    }
  }

  function updatePresence(deltaSeconds) {
    presence.awareness = damp(
      presence.awareness,
      presence.targetAwareness,
      1.35,
      deltaSeconds
    );
    presence.hold = damp(
      presence.hold,
      presence.targetHold,
      presence.targetHold ? 8.0 : 2.6,
      deltaSeconds
    );
  }

  function updateLightCursor(deltaSeconds) {
    if (!lightCursor) return;

    lightCursor.setHoverTarget(isPointerOverSoundControl() ? 'sound' : 'none');

    const lockedPupilX = phase === 'entering' || phase === 'handoff'
      ? entryOriginX
      : gaze.x;
    const lockedPupilY = phase === 'entering' || phase === 'handoff'
      ? entryOriginY
      : gaze.y;

    lightCursor.update(deltaSeconds, {
      pointer,
      centralTarget: interaction.outer && isTrackingPhase(phase),
      phase,
      entry: encounterState.entry,
      pupilX: window.innerWidth / 2 + lockedPupilX,
      pupilY: window.innerHeight / 2 + lockedPupilY,
    });
  }

  function updateMetabolism(now) {
    if (reduceMotion) {
      metabolism.lifeA.fill(0);
      metabolism.lifeB.fill(0);
      metabolism.activeCount = 0;
      metabolism.growthCount = 0;
      metabolism.decayCount = 0;
      metabolism.transferCount = 0;
      return;
    }
    if (!metabolism.startedAt) initializeMetabolism(now);

    metabolism.lifeA.fill(0);
    metabolism.lifeB.fill(0);
    metabolism.activeCount = 0;
    metabolism.growthCount = 0;
    metabolism.decayCount = 0;
    metabolism.transferCount = 0;

    metabolism.events.forEach((event, slot) => {
      if (!event) return;
      let progress = (now - event.startedAt) / event.duration;

      if (progress >= 1) {
        const delay = event.kind === LIFE_KIND.transfer
          ? randomBetween(240, 620)
          : 0;
        createLifeEvent(
          slot,
          now,
          event.kind,
          delay,
          0,
          event.kind === LIFE_KIND.transfer ? metabolism.events[1] : null,
          event.kind === LIFE_KIND.transfer ? metabolism.events[0] : null
        );
        event = metabolism.events[slot];
        progress = (now - event.startedAt) / event.duration;
      }

      const offset = slot * 4;
      const active = progress >= 0 && progress <= 1;
      progress = clamp(progress, 0, 1);
      const touchBoost = Number.isFinite(event.touchedAt)
        ? 1 + 0.22 * (1 - smoothstep(0, 1450, now - event.touchedAt))
        : 1;
      const energy = active && !reduceMotion
        ? clamp(event.energy * touchBoost, 0, 1.18)
        : 0;

      metabolism.lifeA[offset] = event.x;
      metabolism.lifeA[offset + 1] = event.y;
      metabolism.lifeA[offset + 2] = progress;
      metabolism.lifeA[offset + 3] = event.kind;
      metabolism.lifeB[offset] = event.directionX;
      metabolism.lifeB[offset + 1] = event.directionY;
      metabolism.lifeB[offset + 2] = energy;
      metabolism.lifeB[offset + 3] = event.seed;

      if (!active) return;
      metabolism.activeCount += 1;
      if (event.kind === LIFE_KIND.growth) metabolism.growthCount += 1;
      else if (event.kind === LIFE_KIND.decay) metabolism.decayCount += 1;
      else metabolism.transferCount += 1;

      if (
        pointer.hasMoved
        && !event.signalled
        && progress > 0.24
        && progress < 0.62
      ) {
        const eventPosition = getEventScreenPosition(event);
        const distance = Math.hypot(pointer.x - eventPosition.x, pointer.y - eventPosition.y);
        if (distance < 250) {
          const didSpawn = spawnWave({
            x: eventPosition.x,
            y: eventPosition.y,
            directionX: event.directionX,
            directionY: event.directionY,
            energy: 0.48 + event.energy * 0.22,
            now,
            kind: event.kind === LIFE_KIND.growth
              ? 'growth-transfer'
              : event.kind === LIFE_KIND.decay
                ? 'decay-transfer'
                : 'metabolic-transfer',
            duration: randomBetween(3600, 5400),
            reach: randomBetween(270, 390),
          });
          if (didSpawn) event.signalled = true;
        }
      }
    });
  }

  function updateWaves(now) {
    waves.waveA.fill(0);
    waves.waveB.fill(0);
    if (reduceMotion) {
      waves.items.length = 0;
      return;
    }
    waves.items = waves.items.filter((wave) => (
      (now - wave.startedAt) / wave.duration < 1.035
    ));

    waves.items.slice(0, WAVE_COUNT).forEach((wave, index) => {
      const offset = index * 4;
      const progress = clamp((now - wave.startedAt) / wave.duration, 0, 1);
      waves.waveA[offset] = wave.x - window.innerWidth / 2;
      waves.waveA[offset + 1] = wave.y - window.innerHeight / 2;
      waves.waveA[offset + 2] = progress;
      waves.waveA[offset + 3] = wave.energy;
      waves.waveB[offset] = wave.directionX;
      waves.waveB[offset + 1] = wave.directionY;
      waves.waveB[offset + 2] = wave.reach;
      waves.waveB[offset + 3] = wave.seed;
    });
  }

  function getSignalProgress(now) {
    if (!waves.items.length) return 0;
    return waves.items.reduce((maximum, wave) => {
      const progress = clamp((now - wave.startedAt) / wave.duration, 0, 1);
      return Math.max(maximum, progress);
    }, 0);
  }

  function updateTelemetry(now, signalProgress) {
    telemetryFrame += 1;
    if (telemetryFrame % 8 !== 0) return;

    nebulaCanvas.dataset.phase = phase;
    nebulaCanvas.dataset.intro = encounterState.intro;
    nebulaCanvas.dataset.life = lifeState;
    nebulaCanvas.dataset.rhythm = 'metabolic';
    nebulaCanvas.dataset.rhythmProgress = '0.000';
    nebulaCanvas.dataset.breath = '0.000';
    nebulaCanvas.dataset.gazeX = gaze.x.toFixed(2);
    nebulaCanvas.dataset.gazeY = gaze.y.toFixed(2);
    nebulaCanvas.dataset.awareness = presence.awareness.toFixed(3);
    nebulaCanvas.dataset.hold = presence.hold.toFixed(3);
    nebulaCanvas.dataset.study = presence.study.toFixed(3);
    nebulaCanvas.dataset.signal = signalProgress.toFixed(3);
    nebulaCanvas.dataset.waveCount = String(waves.items.length);
    nebulaCanvas.dataset.disturbance = pointer.disturbance.toFixed(3);
    nebulaCanvas.dataset.pointerSpeed = pointer.speed.toFixed(1);
    nebulaCanvas.dataset.stillness = pointer.stillness.toFixed(3);
    nebulaCanvas.dataset.curiosity = curiosity.energy.toFixed(3);
    nebulaCanvas.dataset.adaptation = curiosity.adaptation.toFixed(3);
    nebulaCanvas.dataset.pupil = pupil.value.toFixed(3);
    nebulaCanvas.dataset.approach = presence.approach.toFixed(3);
    nebulaCanvas.dataset.hotzone = contact.dataset.hotzone;
    nebulaCanvas.dataset.contactHold = encounterState.hold.toFixed(3);
    nebulaCanvas.dataset.entry = encounterState.entry.toFixed(3);
    nebulaCanvas.dataset.zoom = (encounterState.zoom || 0).toFixed(3);
    nebulaCanvas.dataset.collapse = encounterState.collapse.toFixed(3);
    nebulaCanvas.dataset.fall = encounterState.fall.toFixed(3);
    nebulaCanvas.dataset.metabolism = String(metabolism.activeCount);
    nebulaCanvas.dataset.growth = String(metabolism.growthCount);
    nebulaCanvas.dataset.decay = String(metabolism.decayCount);
    nebulaCanvas.dataset.transfer = String(metabolism.transferCount);
    metabolism.events.forEach((event) => {
      if (!event) return;
      const eventProgress = clamp((now - event.startedAt) / event.duration, 0, 1).toFixed(3);
      if (event.kind === LIFE_KIND.growth) {
        nebulaCanvas.dataset.growthProgress = eventProgress;
      } else if (event.kind === LIFE_KIND.decay) {
        nebulaCanvas.dataset.decayProgress = eventProgress;
      } else {
        nebulaCanvas.dataset.transferProgress = eventProgress;
      }
    });
    nebulaCanvas.dataset.awakening = 'metabolic';
    nebulaCanvas.dataset.awaken = '0.000';
    nebulaCanvas.dataset.uptime = (now / 1000).toFixed(2);
  }

  function animate(now) {
    const deltaSeconds = Math.min(0.04, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;

    updatePointerDynamics(deltaSeconds, now);
    updatePresence(deltaSeconds);
    updateStudy(deltaSeconds, now);
    updateGaze(deltaSeconds);
    updateApproach(deltaSeconds, now);
    if (encounter) {
      const usingEntryControl = phase === 'aligned';
      applyEncounterState(encounter.update(now, {
        outer: interaction.intentional,
        core: usingEntryControl ? interaction.entryActive : interaction.intentional,
        active: usingEntryControl ? interaction.entryActive : interaction.intentional,
      }), now);
    }
    updateLightCursor(deltaSeconds);
    updateCuriosity(deltaSeconds, now);
    updateMetabolism(now);
    updateWaves(now);
    const signalProgress = getSignalProgress(now);

    if (soundscape) {
      soundscape.update({
        phase,
        lifeState,
        pointer,
        presence,
        pupil,
        curiosity,
        metabolism,
        waves: waves.items,
        encounter: encounterState,
      }, deltaSeconds);
    }

    if (nebula) {
      nebula.render(now / 1000, {
        gazeX: gaze.x,
        gazeY: gaze.y,
        pointerX: pointer.x - window.innerWidth / 2,
        pointerY: pointer.y - window.innerHeight / 2,
        flowVelocityX: pointer.velocityX,
        flowVelocityY: pointer.velocityY,
        disturbance: pointer.disturbance,
        stillness: pointer.stillness,
        awareness: presence.awareness,
        study: presence.study,
        approach: presence.approach,
        pupilDilation: clamp(
          Math.max(
            pupil.value
              + interaction.coreAmount * 0.12
              + encounterState.hold * 0.18,
            (
              encounterState.countdownState === 'active'
              || encounterState.countdownState === 'releasing'
            )
              ? 0.38 + encounterState.hold * 0.38
              : 0,
            phase === 'entering' || phase === 'handoff'
              ? 0.30 + (encounterState.zoom || 0) * 0.70
              : 0
          ),
          0,
          1
        ),
        reveal: encounterState.reveal,
        zoom: encounterState.zoom,
        entry: encounterState.entry,
        lifeA: metabolism.lifeA,
        lifeB: metabolism.lifeB,
        waveA: waves.waveA,
        waveB: waves.waveB,
      });
    }
    updateTelemetry(now, signalProgress);

    frameWindowCount += 1;
    if (now - frameWindowStartedAt >= 1000) {
      nebulaCanvas.dataset.fps = (
        frameWindowCount * 1000 / (now - frameWindowStartedAt)
      ).toFixed(1);
      frameWindowCount = 0;
      frameWindowStartedAt = now;
    }

    if (reduceMotion) {
      reducedFrameTimer = window.setTimeout(() => requestAnimationFrame(animate), 90);
    } else {
      requestAnimationFrame(animate);
    }
  }

  window.__humanUnknown = {
    getState: () => ({
      phase,
      intro: encounterState.intro,
      guide: encounterState.guide,
      lifeState,
      renderer: nebula && nebula.ready ? 'living-nebula' : 'fallback',
      textureMode: 'continuous',
      rhythm: { stage: 'metabolic', progress: 0, breath: 0, duration: 0 },
      metabolism: {
        active: metabolism.activeCount,
        growth: metabolism.growthCount,
        decay: metabolism.decayCount,
        transfer: metabolism.transferCount,
        events: metabolism.events.map((event) => event ? ({
          kind: event.kind === LIFE_KIND.growth
            ? 'growth'
            : event.kind === LIFE_KIND.decay
              ? 'decay'
              : 'transfer',
          zoneIndex: event.zoneIndex,
          startedAt: event.startedAt,
          duration: event.duration,
        }) : null),
      },
      waves: waves.items.map((wave) => ({
        id: wave.id,
        kind: wave.kind,
        progress: clamp((performance.now() - wave.startedAt) / wave.duration, 0, 1),
        duration: wave.duration,
        reach: wave.reach,
      })),
      pupil: { value: pupil.value, active: pupil.active, amplitude: pupil.amplitude },
      curiosity: {
        energy: curiosity.energy,
        adaptation: curiosity.adaptation,
        armed: curiosity.armed,
      },
      flow: {
        speed: pointer.speed,
        disturbance: pointer.disturbance,
        stillness: pointer.stillness,
        velocityX: pointer.velocityX,
        velocityY: pointer.velocityY,
      },
      gaze: {
        x: gaze.x,
        y: gaze.y,
        perceivedX: gaze.perceivedX,
        perceivedY: gaze.perceivedY,
        velocityX: gaze.velocityX,
        velocityY: gaze.velocityY,
      },
      awareness: presence.awareness,
      hold: presence.hold,
      study: presence.study,
      approach: presence.approach,
      encounter: {
        titleFullyVisibleAt: encounterState.titleFullyVisibleAt,
        titleReadableFor: encounterState.titleReadableFor,
        titleMinReadMs: encounterState.titleMinReadMs,
        intentionalAt: encounterState.intentionalAt,
        guideReadableFor: encounterState.guideReadableFor,
        finalGuideReadComplete: encounterState.finalGuideReadComplete,
        finalGuideComplete: encounterState.finalGuideComplete,
        countdownReady: encounterState.countdownReady,
        countdownState: encounterState.countdownState,
        countdownValue: encounterState.countdownValue,
        noticeSerial: encounterState.noticeSerial,
        outerDwell: encounterState.outerDwell,
        coreDwell: encounterState.coreDwell,
        hold: encounterState.hold,
        holdMs: encounterState.holdMs,
        entry: encounterState.entry,
        zoom: encounterState.zoom,
        entryDurationMs: encounterState.entryDurationMs,
        collapse: encounterState.collapse,
        boundarySilence: encounterState.boundarySilence,
        fall: encounterState.fall,
        handoff: encounterState.handoff,
        reducedMotion: encounterState.reducedMotion,
      },
      input: {
        type: interaction.inputType,
        intentional: interaction.intentional,
        touchActive: interaction.touchActive,
        keyboardActive: interaction.keyboardActive,
        hotzone: interaction.core ? 'core' : interaction.outer ? 'outer' : 'none',
        coreAmount: interaction.coreAmount,
      },
      cursor: lightCursor ? lightCursor.getState() : null,
      pointerTravel: pointer.travel,
      firstContactAt,
      sound: soundscape ? soundscape.getState() : null,
      contract: {
        version: '4.4',
        phaseAttribute: 'data-phase',
        introAttribute: 'data-intro',
        countdownAttribute: 'data-countdown',
        countdownValueAttribute: 'data-countdown-value',
        cursorModeAttribute: 'data-mode',
        cursorTargetAttribute: 'data-target',
        cursorModes: ['cloud', 'condensing', 'point', 'absorbing'],
        exitEvent: 'humanunknown:homepage-exit',
        cssVariables: [
          '--contact-proximity',
          '--contact-core',
          '--contact-hold',
          '--contact-countdown',
          '--contact-pull',
          '--contact-entry',
          '--hotzone-cue',
          '--hotzone-scale',
          '--pupil-x',
          '--pupil-y',
        ],
      },
    }),
  };

  contact.dataset.life = lifeState;
  bootNebula();
  requestAnimationFrame(animate);

  window.addEventListener('pagehide', () => {
    window.clearTimeout(guideSwapTimer);
    window.clearTimeout(reducedFrameTimer);
    if (soundscape) soundscape.destroy();
    if (nebula) nebula.destroy();
    if (lightCursor) lightCursor.destroy();
  });
})();
