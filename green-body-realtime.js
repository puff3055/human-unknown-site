(() => {
  'use strict';

  const root = document.getElementById('worldOne');
  if (!root) return;

  const canvas = document.getElementById('greenBodyCanvas');
  const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const cursor = document.getElementById('worldCursor');
  const hint = document.getElementById('worldHint');
  const status = document.getElementById('worldStatus');
  const returnButton = document.getElementById('worldReturn');
  const narrativeContinue = document.getElementById('worldNarrativeContinue');
  const sourcesToggle = document.getElementById('worldSourcesToggle');
  const sourcesPanel = document.getElementById('worldSourcesPanel');
  const sourcesScrim = document.getElementById('worldSourcesScrim');
  const sourcesClose = document.getElementById('worldSourcesClose');
  const sourcesContinue = document.getElementById('worldSourcesContinue');
  const beats = new Map([...root.querySelectorAll('[data-beat]')].map((node) => [node.dataset.beat, node]));
  const narrative = window.GreenBodyNarrative || { hints: {} };
  const soundscape = window.WorldOneSoundscape ? new window.WorldOneSoundscape() : null;
  const reduceMotion = document.documentElement.dataset.motion === 'reduced';
  const TAU = Math.PI * 2;
  const IMAGE_ASPECT = 1672 / 941;
  const NARRATIVE_SEQUENCE = ['collective', 'contrast', 'question', 'human', 'final'];

  const state = {
    active: false,
    prepared: false,
    entering: false,
    width: 1,
    height: 1,
    dpr: 1,
    startedAt: 0,
    lastFrame: performance.now(),
    entrance: 0,
    pointer: {
      x: innerWidth / 2,
      y: innerHeight / 2,
      previousX: innerWidth / 2,
      previousY: innerHeight / 2,
      lastEventAt: 0,
      lastMovedAt: 0,
      eventSpeed: 0,
      speed: 0,
      visible: false,
    },
    hoveredNode: null,
    nodes: [],
    nodesByKey: new Map(),
    edges: [],
    pulses: [],
    pulseQueue: [],
    intakes: [],
    blooms: [],
    traces: [],
    cascades: new Map(),
    cascadeSerial: 0,
    reveal: 0,
    targetReveal: 0.08,
    arrivalCount: 0,
    organArrivalCount: 0,
    crossPlantCount: 0,
    hereShown: false,
    thereShown: false,
    narrativeBeat: '',
    narrativeReady: false,
    narrativeStep: -1,
    wholeStartedAt: 0,
    sourcesReady: false,
    sourcesOpen: false,
    lastActivityAt: 0,
    firstInteractionAt: 0,
    userInteractionCount: 0,
    entryNodeKey: 'spore-center-low',
    entryLandsAt: 0,
    entryChapterAt: 0,
    entryDockAt: 0,
    entryLocalAt: 0,
    entryLanded: false,
    completeAt: 0,
    completeDispatched: false,
    phase: 'prepared',
  };

  let seed = 930514;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const smooth = (value) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

  function cubicPoint(a, c1, c2, b, amount) {
    const inverse = 1 - amount;
    const inverse2 = inverse * inverse;
    const amount2 = amount * amount;
    return {
      x: inverse2 * inverse * a.x + 3 * inverse2 * amount * c1.x + 3 * inverse * amount2 * c2.x + amount2 * amount * b.x,
      y: inverse2 * inverse * a.y + 3 * inverse2 * amount * c1.y + 3 * inverse * amount2 * c2.y + amount2 * amount * b.y,
    };
  }

  function addNode(key, x, y, tissue = 'fiber', organ = null, plant = -1) {
    const node = {
      id: state.nodes.length,
      key,
      x,
      y,
      tissue,
      organ,
      plant,
      activation: 0,
      lastResponseAt: -Infinity,
      links: [],
    };
    state.nodes.push(node);
    state.nodesByKey.set(key, node);
    return node;
  }

  function connect(fromKey, toKey, c1, c2, kind = 'fiber', conductivity = 1) {
    const a = state.nodesByKey.get(fromKey);
    const b = state.nodesByKey.get(toKey);
    if (!a || !b || a.id === b.id) return;
    const control1 = { x: c1[0], y: c1[1] };
    const control2 = { x: c2[0], y: c2[1] };
    let length = 0;
    let previous = a;
    for (let index = 1; index <= 12; index += 1) {
      const point = cubicPoint(a, control1, control2, b, index / 12);
      length += Math.hypot((point.x - previous.x) * IMAGE_ASPECT, point.y - previous.y);
      previous = point;
    }
    const edge = {
      id: state.edges.length,
      a: a.id,
      b: b.id,
      c1: control1,
      c2: control2,
      kind,
      conductivity,
      length,
      phase: random() * TAU,
    };
    state.edges.push(edge);
    a.links.push(edge.id);
    b.links.push(edge.id);
  }

  function buildNetwork() {
    state.nodes.length = 0;
    state.edges.length = 0;
    state.nodesByKey.clear();

    // The hidden routing graph is traced against the visible roots, trunks,
    // membrane veins, mushroom beds and spores in the visual master.
    addNode('left-crown', .220, .012, 'trunk', null, 1);
    addNode('left-upper', .238, .150, 'trunk', null, 1);
    addNode('left-shoulder', .270, .300, 'trunk', null, 1);
    addNode('left-trunk', .312, .430, 'trunk', 'trunk', 1);
    addNode('left-base', .360, .535, 'root', null, 1);

    addNode('root-far-left', .018, .410, 'root', null, 0);
    addNode('root-left-a', .095, .455, 'root', null, 0);
    addNode('root-left-b', .185, .505, 'root', null, 0);
    addNode('root-left-c', .268, .530, 'root', null, 0);
    addNode('root-junction', .365, .565, 'root', null, 0);
    addNode('bridge-center', .475, .562, 'root', null, 0);
    addNode('bridge-light', .565, .530, 'root', null, 0);
    addNode('bridge-heart', .645, .548, 'root', null, 0);
    addNode('bridge-right', .754, .596, 'root', null, 0);
    addNode('right-reach', .868, .650, 'root', null, 0);
    addNode('root-far-right', .982, .625, 'root', null, 0);

    addNode('mush-left', .115, .490, 'mycelium', 'mushroom', 4);
    addNode('mush-left-deep', .230, .605, 'mycelium', 'mushroom', 4);
    addNode('lower-center', .340, .665, 'root', null, 0);
    addNode('mush-center', .435, .748, 'mycelium', 'mushroom', 5);
    addNode('lower-deep', .535, .842, 'root', null, 0);
    addNode('lower-hub', .655, .925, 'root', null, 0);
    addNode('lower-right', .790, .865, 'root', null, 0);
    addNode('mush-right', .895, .790, 'mycelium', 'mushroom', 6);
    addNode('mush-right-edge', .972, .690, 'mycelium', 'mushroom', 6);

    addNode('heart', .735, .278, 'trunk', 'trunk', 3);
    addNode('right-trunk-a', .730, .380, 'trunk', null, 3);
    addNode('right-trunk-b', .718, .495, 'trunk', 'trunk', 3);
    addNode('right-trunk-c', .700, .635, 'trunk', null, 3);
    addNode('right-root', .675, .790, 'root', 'trunk', 3);

    addNode('canopy-upper', .660, .176, 'vein', null, 2);
    addNode('canopy-crown', .575, .058, 'vein', 'canopy', 2);
    addNode('canopy-upper-left', .452, .078, 'vein', 'canopy', 2);
    addNode('canopy-left-a', .592, .236, 'vein', null, 2);
    addNode('canopy-left-b', .480, .266, 'vein', null, 2);
    addNode('canopy-left-far', .376, .220, 'vein', 'canopy', 2);
    addNode('canopy-lower-a', .652, .352, 'vein', null, 2);
    addNode('canopy-lower-b', .584, .438, 'vein', null, 2);
    addNode('canopy-lower-far', .505, .525, 'vein', 'canopy', 2);
    addNode('canopy-right-a', .835, .232, 'vein', null, 2);
    addNode('canopy-right-far', .955, .290, 'vein', 'canopy', 2);
    addNode('canopy-top-right', .842, .108, 'vein', 'canopy', 2);
    addNode('canopy-edge-right', .930, .020, 'vein', null, 2);

    addNode('spore-upper-left', .257, .115, 'filament', 'spore', 7);
    addNode('spore-left', .123, .365, 'filament', 'spore', 8);
    addNode('spore-mid-left', .369, .338, 'filament', 'spore', 9);
    addNode('spore-center', .575, .425, 'filament', 'spore', 10);
    addNode('spore-center-low', .528, .508, 'filament', 'spore', 11);
    addNode('spore-right', .767, .595, 'filament', 'spore', 12);
    addNode('spore-right-low', .804, .782, 'filament', 'spore', 13);
    addNode('spore-far-right', .880, .326, 'filament', 'spore', 14);

    // Left trunk and the root running across the middle of the image.
    connect('left-crown', 'left-upper', [.215, .055], [.225, .105], 'trunk', .74);
    connect('left-upper', 'left-shoulder', [.244, .205], [.255, .255], 'trunk', .76);
    connect('left-shoulder', 'left-trunk', [.280, .350], [.292, .395], 'trunk', .78);
    connect('left-trunk', 'left-base', [.326, .472], [.340, .512], 'trunk', .82);
    connect('left-base', 'root-junction', [.360, .548], [.362, .557], 'root', .92);

    connect('root-far-left', 'root-left-a', [.045, .418], [.070, .440], 'root', .92);
    connect('root-left-a', 'root-left-b', [.125, .472], [.158, .496], 'root', .96);
    connect('root-left-b', 'root-left-c', [.212, .520], [.244, .524], 'root', .98);
    connect('root-left-c', 'root-junction', [.302, .536], [.336, .558], 'root', 1.02);
    connect('root-junction', 'bridge-center', [.402, .578], [.440, .572], 'root', 1.05);
    connect('bridge-center', 'bridge-light', [.505, .555], [.536, .536], 'root', 1.05);
    connect('bridge-light', 'bridge-heart', [.592, .519], [.618, .535], 'root', 1.05);
    connect('bridge-heart', 'bridge-right', [.683, .557], [.716, .582], 'root', 1.02);
    connect('bridge-right', 'right-reach', [.790, .617], [.829, .645], 'root', .98);
    connect('right-reach', 'root-far-right', [.910, .662], [.948, .642], 'root', .90);

    // A second, deeper fungal route carries the signal through the mushroom colonies.
    connect('root-left-a', 'mush-left', [.103, .464], [.108, .480], 'mycelium', 1.10);
    connect('mush-left', 'mush-left-deep', [.150, .522], [.190, .580], 'mycelium', 1.12);
    connect('mush-left-deep', 'lower-center', [.268, .628], [.305, .648], 'mycelium', 1.08);
    connect('lower-center', 'mush-center', [.372, .688], [.405, .730], 'mycelium', 1.10);
    connect('mush-center', 'lower-deep', [.470, .776], [.502, .820], 'mycelium', 1.06);
    connect('lower-deep', 'lower-hub', [.574, .873], [.614, .916], 'root', .94);
    connect('lower-hub', 'lower-right', [.698, .927], [.746, .892], 'root', .90);
    connect('lower-right', 'mush-right', [.826, .846], [.862, .814], 'mycelium', 1.08);
    connect('mush-right', 'mush-right-edge', [.922, .765], [.953, .723], 'mycelium', 1.08);
    connect('mush-left-deep', 'root-left-c', [.242, .575], [.255, .548], 'mycelium', 1.02);
    connect('mush-center', 'bridge-center', [.452, .690], [.466, .612], 'mycelium', 1.02);
    connect('lower-hub', 'right-root', [.665, .880], [.672, .830], 'root', .92);
    connect('mush-right', 'right-reach', [.884, .742], [.874, .690], 'mycelium', 1.00);

    // The luminous heart sends information up through leaf membranes and down the trunk.
    connect('heart', 'right-trunk-a', [.744, .312], [.737, .348], 'trunk', .78);
    connect('right-trunk-a', 'right-trunk-b', [.724, .418], [.722, .458], 'trunk', .82);
    connect('right-trunk-b', 'right-trunk-c', [.714, .542], [.706, .590], 'trunk', .86);
    connect('right-trunk-c', 'right-root', [.691, .687], [.681, .740], 'trunk', .88);
    connect('right-trunk-c', 'bridge-heart', [.681, .606], [.660, .568], 'root', .94);
    connect('right-trunk-c', 'bridge-right', [.718, .625], [.736, .607], 'root', .94);

    connect('heart', 'canopy-upper', [.714, .238], [.688, .202], 'vein', 1.12);
    connect('canopy-upper', 'canopy-crown', [.633, .142], [.600, .088], 'vein', 1.15);
    connect('canopy-crown', 'canopy-upper-left', [.535, .050], [.493, .056], 'vein', 1.12);
    connect('heart', 'canopy-left-a', [.690, .267], [.637, .246], 'vein', 1.18);
    connect('canopy-left-a', 'canopy-left-b', [.553, .238], [.515, .258], 'vein', 1.18);
    connect('canopy-left-b', 'canopy-left-far', [.448, .267], [.410, .238], 'vein', 1.14);
    connect('canopy-left-far', 'left-upper', [.330, .193], [.278, .166], 'vein', .98);
    connect('heart', 'canopy-lower-a', [.709, .302], [.680, .330], 'vein', 1.14);
    connect('canopy-lower-a', 'canopy-lower-b', [.635, .386], [.608, .416], 'vein', 1.14);
    connect('canopy-lower-b', 'canopy-lower-far', [.560, .472], [.530, .505], 'vein', 1.10);
    connect('canopy-lower-far', 'bridge-center', [.493, .538], [.483, .551], 'vein', 1.02);
    connect('heart', 'canopy-right-a', [.772, .258], [.804, .238], 'vein', 1.14);
    connect('canopy-right-a', 'canopy-right-far', [.876, .240], [.921, .270], 'vein', 1.10);
    connect('heart', 'canopy-top-right', [.770, .220], [.810, .155], 'vein', 1.10);
    connect('canopy-top-right', 'canopy-edge-right', [.870, .075], [.905, .035], 'vein', 1.02);
    connect('canopy-right-far', 'root-far-right', [.975, .390], [.988, .525], 'vein', .86);

    // Fine filament links end at the visible floating spores.
    connect('spore-upper-left', 'left-upper', [.253, .126], [.246, .142], 'filament', 1.22);
    connect('spore-left', 'root-left-a', [.116, .396], [.104, .428], 'filament', 1.18);
    connect('spore-left', 'left-shoulder', [.166, .342], [.224, .314], 'filament', 1.14);
    connect('spore-mid-left', 'left-trunk', [.350, .365], [.330, .404], 'filament', 1.20);
    connect('spore-mid-left', 'canopy-left-b', [.405, .305], [.446, .278], 'filament', 1.14);
    connect('spore-center', 'canopy-lower-b', [.580, .428], [.582, .433], 'filament', 1.24);
    connect('spore-center', 'bridge-light', [.575, .462], [.570, .500], 'filament', 1.20);
    connect('spore-center-low', 'bridge-center', [.511, .525], [.493, .548], 'filament', 1.22);
    connect('spore-right', 'bridge-right', [.764, .596], [.759, .596], 'filament', 1.24);
    connect('spore-right', 'right-trunk-c', [.742, .610], [.718, .626], 'filament', 1.16);
    connect('spore-right-low', 'lower-right', [.800, .812], [.796, .838], 'filament', 1.22);
    connect('spore-right-low', 'right-root', [.760, .782], [.716, .786], 'filament', 1.14);
    connect('spore-far-right', 'canopy-right-far', [.910, .318], [.936, .304], 'filament', 1.18);
    connect('spore-far-right', 'right-reach', [.892, .430], [.882, .565], 'filament', 1.02);
  }

  function resize() {
    state.width = Math.max(1, canvas.clientWidth || innerWidth);
    state.height = Math.max(1, canvas.clientHeight || innerHeight);
    state.dpr = Math.min(reduceMotion ? 1.1 : 1.5, devicePixelRatio || 1);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function coverMetrics() {
    const screenAspect = state.width / Math.max(1, state.height);
    return screenAspect > IMAGE_ASPECT
      ? { x: 1, y: IMAGE_ASPECT / screenAspect }
      : { x: screenAspect / IMAGE_ASPECT, y: 1 };
  }

  function project(point) {
    const visible = coverMetrics();
    return {
      x: (.5 + (point.x - .5) / visible.x) * state.width,
      y: (.5 + (point.y - .5) / visible.y) * state.height,
    };
  }

  function showBeat(name) {
    beats.forEach((beat, key) => beat.classList.toggle('is-visible', key === name || (Boolean(name) && key === 'chapter' && name !== 'falling')));
    state.narrativeBeat = name || '';
    root.dataset.narrative = name || 'none';
  }

  function setChapterStage(stage) {
    root.dataset.chapterStage = stage;
  }

  function hideNarrativeContinue() {
    root.dataset.awaitingNarrative = 'false';
    if (!narrativeContinue) return;
    narrativeContinue.classList.remove('is-visible');
    window.setTimeout(() => {
      if (root.dataset.awaitingNarrative === 'false') narrativeContinue.hidden = true;
    }, 480);
  }

  function showNarrativeContinue({ sources = false } = {}) {
    if (!narrativeContinue) return;
    const label = narrativeContinue.querySelector('span');
    const english = narrativeContinue.querySelector('small');
    if (label) label.textContent = sources ? '查看灵感来源与推荐阅读' : '继续';
    if (english) english.textContent = sources ? 'INSPIRATION & READING' : 'CONTINUE';
    narrativeContinue.hidden = false;
    root.dataset.awaitingNarrative = 'true';
    requestAnimationFrame(() => narrativeContinue.classList.add('is-visible'));
  }

  function advanceNarrative() {
    if (!state.narrativeReady) return;
    if (state.phase === 'network') {
      state.narrativeStep = 0;
      setPhase('whole');
      showBeat(NARRATIVE_SEQUENCE[state.narrativeStep]);
      showNarrativeContinue();
      state.targetReveal = 1;
      return;
    }
    if (state.phase !== 'whole' || state.narrativeStep < 0) return;
    if (state.narrativeStep < NARRATIVE_SEQUENCE.length - 1) {
      state.narrativeStep += 1;
      showBeat(NARRATIVE_SEQUENCE[state.narrativeStep]);
      showNarrativeContinue({ sources: state.narrativeStep === NARRATIVE_SEQUENCE.length - 1 });
      return;
    }
    hideNarrativeContinue();
    revealSources();
    openSources();
    state.completeAt = performance.now();
  }

  function setHint(copy, english) {
    hint.firstChild.nodeValue = `${copy} `;
    const translation = hint.querySelector('span');
    if (translation && english) translation.textContent = english;
  }

  function closeSources() {
    if (!state.sourcesOpen) return;
    state.sourcesOpen = false;
    root.dataset.sourcesOpen = 'false';
    sourcesToggle?.setAttribute('aria-expanded', 'false');
    sourcesPanel?.setAttribute('aria-hidden', 'true');
    sourcesPanel?.classList.remove('is-open');
    sourcesScrim?.classList.remove('is-visible');
    window.setTimeout(() => {
      if (state.sourcesOpen) return;
      if (sourcesPanel) sourcesPanel.hidden = true;
      if (sourcesScrim) sourcesScrim.hidden = true;
    }, 640);
  }

  function openSources() {
    if (!state.sourcesReady || !sourcesPanel || !sourcesScrim) return;
    state.sourcesOpen = true;
    root.dataset.sourcesOpen = 'true';
    sourcesToggle?.setAttribute('aria-expanded', 'true');
    sourcesPanel.hidden = false;
    sourcesScrim.hidden = false;
    requestAnimationFrame(() => {
      sourcesPanel.classList.add('is-open');
      sourcesScrim.classList.add('is-visible');
      sourcesPanel.setAttribute('aria-hidden', 'false');
      sourcesClose?.focus({ preventScroll: true });
    });
  }

  function revealSources() {
    if (state.sourcesReady || !sourcesToggle) return;
    state.sourcesReady = true;
    sourcesToggle.hidden = false;
    requestAnimationFrame(() => sourcesToggle.classList.add('is-visible'));
  }

  function resetSources() {
    state.sourcesReady = false;
    state.sourcesOpen = false;
    root.dataset.sourcesOpen = 'false';
    if (sourcesToggle) {
      sourcesToggle.hidden = true;
      sourcesToggle.classList.remove('is-visible');
      sourcesToggle.setAttribute('aria-expanded', 'false');
    }
    if (sourcesPanel) {
      sourcesPanel.hidden = true;
      sourcesPanel.classList.remove('is-open');
      sourcesPanel.setAttribute('aria-hidden', 'true');
    }
    if (sourcesScrim) {
      sourcesScrim.hidden = true;
      sourcesScrim.classList.remove('is-visible');
    }
  }

  function setPhase(phase) {
    if (state.phase === phase) return;
    state.phase = phase;
    root.dataset.phase = phase;
    if (phase === 'prepared' || phase === 'arrival') {
      showBeat('');
      setChapterStage('hidden');
    }
    if (phase === 'chapter') {
      setChapterStage('centered');
      showBeat('chapter');
    }
    if (phase === 'local') {
      setChapterStage('docked');
      showBeat('chapter');
      setHint(narrative.hints.local || '移动你的感知，看看哪里会注意到你。', 'MOVE TO EXPLORE');
    }
    if (phase === 'network') setHint(narrative.hints.network || '感知正在沿着同一个身体，去往更远的地方。', 'SIGNAL MOVING THROUGH ONE BODY');
    if (phase === 'whole') {
      setHint(narrative.hints.whole || '现在，试着从许多地方感受同一个“我”。', 'FEEL ONE SELF FROM MANY PLACES');
      if (!state.wholeStartedAt) state.wholeStartedAt = performance.now();
    }
    status.textContent = phase === 'network' ? '你触发的信息正在沿根、菌丝与叶脉向远处传导。' : '';
  }

  function nearestNode(screenX, screenY, nearbyOnly = true) {
    let best = null;
    let bestDistance = Infinity;
    state.nodes.forEach((node) => {
      const point = project(node);
      if (point.x < -40 || point.x > state.width + 40 || point.y < -40 || point.y > state.height + 40) return;
      const distance = Math.hypot(point.x - screenX, point.y - screenY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node;
      }
    });
    if (!nearbyOnly) return best;
    return bestDistance < Math.max(86, Math.min(state.width, state.height) * .115) ? best : null;
  }

  function pathFor(edge, fromId) {
    const forward = fromId === edge.a;
    return {
      a: state.nodes[forward ? edge.a : edge.b],
      c1: forward ? edge.c1 : edge.c2,
      c2: forward ? edge.c2 : edge.c1,
      b: state.nodes[forward ? edge.b : edge.a],
    };
  }

  function pointOnPulse(pulse, amount, organicOffset = true) {
    const route = pathFor(pulse.edge, pulse.from);
    const a = project(route.a);
    const c1 = project(route.c1);
    const c2 = project(route.c2);
    const b = project(route.b);
    const point = cubicPoint(a, c1, c2, b, amount);
    if (!organicOffset || amount <= 0 || amount >= 1) return point;
    const before = cubicPoint(a, c1, c2, b, Math.max(0, amount - .002));
    const after = cubicPoint(a, c1, c2, b, Math.min(1, amount + .002));
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.max(.001, Math.hypot(dx, dy));
    const weave = Math.sin(amount * Math.PI) * Math.sin(amount * TAU * 2.2 + pulse.edge.phase) * (0.55 + pulse.intensity * .65);
    point.x += -dy / length * weave;
    point.y += dx / length * weave;
    return point;
  }

  function launch(edgeId, fromId, cascade, generation, intensity, scheduledAt) {
    if (!cascade || cascade.visitedEdges.has(edgeId) || state.pulses.length + state.pulseQueue.length > 240) return;
    const edge = state.edges[edgeId];
    if (!edge) return;
    const to = edge.a === fromId ? edge.b : edge.a;
    cascade.visitedEdges.add(edgeId);
    cascade.lastTouchedAt = scheduledAt;
    const duration = clamp(edge.length * 3.9 / edge.conductivity, .32, 1.42) * (reduceMotion ? .42 : 1);
    state.pulseQueue.push({
      from: fromId,
      to,
      edge,
      cascadeId: cascade.id,
      generation,
      intensity: Math.max(.34, intensity),
      progress: 0,
      duration,
      scheduledAt,
      packetPhase: random() * TAU,
    });
    state.targetReveal = Math.max(state.targetReveal, cascade.visitedEdges.size / state.edges.length);
  }

  function scheduleBranches(node, cascade, generation, intensity, scheduledAt) {
    const available = node.links
      .filter((edgeId) => !cascade.visitedEdges.has(edgeId))
      .sort((left, right) => {
        const leftEdge = state.edges[left];
        const rightEdge = state.edges[right];
        const leftTarget = state.nodes[leftEdge.a === node.id ? leftEdge.b : leftEdge.a];
        const rightTarget = state.nodes[rightEdge.a === node.id ? rightEdge.b : rightEdge.a];
        return Number(Boolean(rightTarget.organ)) - Number(Boolean(leftTarget.organ)) || left - right;
      });
    available.forEach((edgeId, index) => {
      const branchDelay = index === 0 ? 0 : .055 + index * .045;
      launch(edgeId, node.id, cascade, generation, intensity, scheduledAt + branchDelay * 1000);
    });
  }

  function addBloom(point, now, kind = 'junction', intensity = 1) {
    state.blooms.push({ x: point.x, y: point.y, startedAt: now, kind, intensity });
    if (state.blooms.length > 90) state.blooms.splice(0, state.blooms.length - 90);
  }

  function emitArrival(node, cascade, now, intensity) {
    if (!node.organ || cascade.reachedOrgans.has(node.id)) return;
    cascade.reachedOrgans.add(node.id);
    state.organArrivalCount += 1;
    const screen = project(node);
    const detail = {
      cascadeId: cascade.id,
      nodeId: node.key,
      organ: node.organ,
      x: clamp(screen.x / state.width, 0, 1),
      y: clamp(screen.y / state.height, 0, 1),
      imageX: node.x,
      imageY: node.y,
      intensity,
    };
    root.dispatchEvent(new CustomEvent('greenbody:arrival', { detail }));
    canvas.dataset.lastArrival = node.organ;
    node.lastResponseAt = now;
    if (soundscape && cascade.source === 'user') {
      const kind = node.tissue === 'root' ? 'root' : node.tissue === 'mycelium' ? 'flow' : 'signal';
      soundscape.pulse(kind, clamp(intensity, .35, 1), clamp(detail.x * 2 - 1, -.72, .72));
    }
  }

  function arrive(pulse, now) {
    const node = state.nodes[pulse.to];
    const cascade = state.cascades.get(pulse.cascadeId);
    if (!node || !cascade) return;

    state.arrivalCount += 1;
    node.activation = Math.max(node.activation, pulse.intensity);
    cascade.lastTouchedAt = now;
    state.traces.push({ edge: pulse.edge, from: pulse.from, startedAt: now, intensity: pulse.intensity });
    if (state.traces.length > 120) state.traces.splice(0, state.traces.length - 120);
    addBloom(node, now, node.organ || (node.links.length > 2 ? 'junction' : 'relay'), pulse.intensity);

    if (node.plant >= 0) {
      if (cascade.originPlant === null) cascade.originPlant = node.plant;
      if (!cascade.reachedPlants.has(node.plant)) {
        cascade.reachedPlants.add(node.plant);
        if (cascade.reachedPlants.size > 1) {
          state.crossPlantCount += 1;
        }
      }
    }

    emitArrival(node, cascade, now, pulse.intensity);

    const hold = node.organ ? .26 : node.links.length > 2 ? .105 : .035;
    const nextIntensity = Math.max(.36, pulse.intensity * (pulse.generation < 5 ? .93 : .88));
    scheduleBranches(node, cascade, pulse.generation + 1, nextIntensity, now + hold * 1000);
  }

  function ignite(node, originPoint = null, options = {}) {
    if (!node || state.pulses.length + state.pulseQueue.length > 220) return;
    const now = performance.now();
    const sourceKind = options.source === 'journey' ? 'journey' : 'user';
    const cascade = {
      id: ++state.cascadeSerial,
      createdAt: now,
      lastTouchedAt: now,
      originPlant: node.plant >= 0 ? node.plant : null,
      reachedPlants: new Set(node.plant >= 0 ? [node.plant] : []),
      reachedOrgans: new Set(),
      visitedEdges: new Set(),
      source: sourceKind,
    };
    state.cascades.set(cascade.id, cascade);
    node.activation = 1;
    state.lastActivityAt = now;
    if (sourceKind === 'user') {
      state.userInteractionCount += 1;
      if (!state.firstInteractionAt) state.firstInteractionAt = now;
    }

    const target = project(node);
    const source = originPoint || target;
    if (options.immediateArrival) {
      addBloom(node, now, node.organ || 'contact', 1);
      emitArrival(node, cascade, now, 1);
      scheduleBranches(node, cascade, 0, 1, now + 90);
    } else {
      const distance = Math.hypot(target.x - source.x, target.y - source.y);
      const intakeDuration = reduceMotion ? .12 : clamp(.22 + distance / 900, .22, .58);
      state.intakes.push({
        from: source,
        to: node,
        cascadeId: cascade.id,
        startedAt: now,
        duration: intakeDuration,
        intensity: 1,
        phase: random() * TAU,
        arrived: false,
      });
      scheduleBranches(node, cascade, 0, 1, now + intakeDuration * 1000 + 90);
    }

    if (sourceKind === 'user') {
      cursor.classList.remove('is-active');
      void cursor.offsetWidth;
      cursor.classList.add('is-active');
    }
    if (!options.preservePhase) {
      setPhase('network');
      if (!state.thereShown && !state.narrativeReady) showBeat('here');
    }
    return cascade.id;
  }

  function updateNarrative() {
    if (
      state.phase === 'network'
      && state.narrativeReady
      && state.thereShown
      && root.dataset.awaitingNarrative !== 'true'
    ) showNarrativeContinue();
  }

  function update(delta, now) {
    if (state.active && state.phase === 'arrival') {
      if (!state.entryLanded && now >= state.entryLandsAt) {
        state.entryLanded = true;
        root.dataset.entry = 'landed';
        const node = state.nodesByKey.get(state.entryNodeKey) || state.nodesByKey.get('spore-center-low');
        if (node) {
          ignite(node, project(node), {
            source: 'journey',
            immediateArrival: true,
            preservePhase: true,
          });
        }
      }
      if (state.entryLanded && now >= state.entryChapterAt) setPhase('chapter');
    }
    if (
      state.active
      && state.phase === 'chapter'
      && now >= state.entryDockAt
      && root.dataset.chapterStage !== 'docked'
    ) setChapterStage('docked');
    if (state.active && state.phase === 'chapter' && now >= state.entryLocalAt) {
      root.dataset.entry = 'active';
      setPhase('local');
    }

    state.reveal += (state.targetReveal - state.reveal) * (1 - Math.exp(-delta * .5));
    state.nodes.forEach((node) => {
      node.activation *= Math.exp(-delta * 1.55);
      if (node === state.hoveredNode) node.activation = Math.max(node.activation, .38);
    });

    state.intakes.forEach((intake) => {
      if (intake.arrived || now < intake.startedAt + intake.duration * 1000) return;
      intake.arrived = true;
      const cascade = state.cascades.get(intake.cascadeId);
      addBloom(intake.to, now, intake.to.organ || 'contact', 1);
      if (cascade) emitArrival(intake.to, cascade, now, 1);
    });
    state.intakes = state.intakes.filter((intake) => now - intake.startedAt < intake.duration * 1000 + 180);
    state.blooms = state.blooms.filter((bloom) => now - bloom.startedAt < (bloom.kind === 'relay' ? 620 : 1650));
    state.traces = state.traces.filter((trace) => now - trace.startedAt < 1750);

    if (state.pulseQueue.length) state.pulses.push(...state.pulseQueue.splice(0));
    const travelling = [];
    state.pulses.forEach((pulse) => {
      if (now < pulse.scheduledAt) {
        travelling.push(pulse);
        return;
      }
      pulse.progress += delta / pulse.duration;
      if (pulse.progress >= 1) arrive(pulse, now);
      else travelling.push(pulse);
    });
    state.pulses = travelling.concat(state.pulseQueue.splice(0));

    for (const [id, cascade] of state.cascades) {
      if (now - cascade.lastTouchedAt > 16000) state.cascades.delete(id);
    }

    const interactionAge = state.firstInteractionAt ? now - state.firstInteractionAt : 0;
    if (!state.thereShown && state.crossPlantCount >= 1 && interactionAge > 2600) {
      state.thereShown = true;
      showBeat('there');
    }
    if (!state.narrativeReady && state.firstInteractionAt && (
      (state.organArrivalCount >= 5 && state.crossPlantCount >= 2 && interactionAge > 7200) ||
      interactionAge > 18000
    )) {
      state.narrativeReady = true;
    }

    updateNarrative(now);

    if (
      state.phase === 'whole'
      && state.completeAt
      && now >= state.completeAt
      && !state.completeDispatched
    ) {
      state.completeDispatched = true;
      const detail = {
        world: 'green-body',
        phase: 'whole',
        userInteractions: state.userInteractionCount,
        organArrivals: state.organArrivalCount,
        crossPlantCount: state.crossPlantCount,
        completedAt: now,
      };
      root.dispatchEvent(new CustomEvent('greenbody:complete', { detail }));
      window.dispatchEvent(new CustomEvent('greenbody:complete', { detail }));
    }
  }

  function drawFalling(now) {
    const elapsed = (now - state.startedAt) / 1000;
    const fade = 1 - smooth((elapsed - 2.4) / 1.2);
    context.save();
    context.translate(state.width / 2, state.height / 2);
    context.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 180; i += 1) {
      const angle = i * 2.399 + Math.sin(i) * .12;
      const phase = ((elapsed * (reduceMotion ? .08 : .55) + i * .031) % 1);
      const inner = 22 + phase * phase * Math.max(state.width, state.height) * .68;
      const length = 10 + phase * 130;
      const alpha = fade * (.025 + (i % 11 === 0 ? .17 : .055)) * phase;
      context.strokeStyle = `rgba(224,235,218,${alpha})`;
      context.lineWidth = i % 13 === 0 ? 1.25 : .55;
      context.beginPath();
      context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * .58);
      context.lineTo(Math.cos(angle) * (inner + length), Math.sin(angle) * (inner + length) * .58);
      context.stroke();
    }
    context.restore();
  }

  function drawSignalSegment(pulse, fromAmount, toAmount, width, color) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.beginPath();
    for (let step = 0; step <= 18; step += 1) {
      const point = pointOnPulse(pulse, lerp(fromAmount, toAmount, step / 18));
      if (step === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  function drawIntakes(now) {
    state.intakes.forEach((intake) => {
      const raw = clamp((now - intake.startedAt) / (intake.duration * 1000), 0, 1);
      if (raw <= 0 || raw >= 1) return;
      const target = project(intake.to);
      const dx = target.x - intake.from.x;
      const dy = target.y - intake.from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const normal = { x: -dy / distance, y: dx / distance };
      const curl = Math.min(34, distance * .18) * Math.sin(intake.phase);
      const c1 = { x: intake.from.x + dx * .28 + normal.x * curl, y: intake.from.y + dy * .28 + normal.y * curl };
      const c2 = { x: intake.from.x + dx * .72 - normal.x * curl * .45, y: intake.from.y + dy * .72 - normal.y * curl * .45 };
      const pointAt = (amount) => cubicPoint(intake.from, c1, c2, target, amount);
      const headT = smooth(raw);
      const tailT = Math.max(0, headT - .28);
      const tail = pointAt(tailT);
      const head = pointAt(headT);
      const gradient = context.createLinearGradient(tail.x, tail.y, head.x, head.y);
      gradient.addColorStop(0, 'rgba(151,190,87,0)');
      gradient.addColorStop(.72, 'rgba(210,235,138,.42)');
      gradient.addColorStop(1, 'rgba(251,255,220,.95)');
      context.strokeStyle = gradient;
      context.lineWidth = 1.8;
      context.lineCap = 'round';
      context.beginPath();
      for (let step = 0; step <= 14; step += 1) {
        const point = pointAt(lerp(tailT, headT, step / 14));
        if (step === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.stroke();
      const glow = context.createRadialGradient(head.x, head.y, 0, head.x, head.y, 20);
      glow.addColorStop(0, 'rgba(251,255,220,.9)');
      glow.addColorStop(.2, 'rgba(184,219,108,.42)');
      glow.addColorStop(1, 'rgba(122,175,74,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(head.x, head.y, 20, 0, TAU);
      context.fill();
    });
  }

  function drawBlooms(now) {
    state.blooms.forEach((bloom) => {
      const age = Math.max(0, (now - bloom.startedAt) / 1000);
      if (age <= 0) return;
      const point = project(bloom);
      const organ = bloom.kind !== 'relay' && bloom.kind !== 'junction' && bloom.kind !== 'contact';
      const lifetime = bloom.kind === 'relay' ? .62 : organ ? 1.55 : 1.05;
      const life = clamp(age / lifetime, 0, 1);
      const arrival = 1 - smooth(life);
      const coreRadius = organ ? 30 : bloom.kind === 'junction' ? 20 : 14;
      const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, coreRadius * (1 + life * .8));
      glow.addColorStop(0, `rgba(251,255,218,${arrival * .72 * bloom.intensity})`);
      glow.addColorStop(.18, `rgba(185,220,108,${arrival * .34 * bloom.intensity})`);
      glow.addColorStop(1, 'rgba(112,167,70,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(point.x, point.y, coreRadius * (1 + life * .8), 0, TAU);
      context.fill();
      if (organ) {
        context.strokeStyle = `rgba(222,241,158,${arrival * .32})`;
        context.lineWidth = .8;
        context.beginPath();
        context.arc(point.x, point.y, 5 + smooth(life) * 36, 0, TAU);
        context.stroke();
      }
    });
  }

  function drawNetwork(now) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    drawIntakes(now);

    // A completed segment remembers the signal briefly, then disappears completely.
    // This exposes the network only as a consequence of the user's click.
    state.traces.forEach((trace) => {
      const life = clamp((now - trace.startedAt) / 1750, 0, 1);
      const alpha = (1 - smooth(life)) * trace.intensity;
      const tracedPulse = { edge: trace.edge, from: trace.from, intensity: trace.intensity };
      drawSignalSegment(tracedPulse, 0, 1, 5.5, `rgba(105,164,62,${alpha * .035})`);
      drawSignalSegment(tracedPulse, 0, 1, .72, `rgba(176,211,103,${alpha * .14})`);
    });

    // Only moving information is visible. The traced routing graph never appears at rest.
    state.pulses.forEach((pulse) => {
      if (now < pulse.scheduledAt) return;
      const headT = clamp(pulse.progress, 0, 1);
      const tailSpan = clamp(.18 + .07 / Math.max(.16, pulse.edge.length), .20, .38);
      const tailT = Math.max(0, headT - tailSpan);
      const tail = pointOnPulse(pulse, tailT);
      const head = pointOnPulse(pulse, headT);
      const gradient = context.createLinearGradient(tail.x, tail.y, head.x, head.y);
      gradient.addColorStop(0, 'rgba(121,170,70,0)');
      gradient.addColorStop(.42, `rgba(153,198,84,${.10 * pulse.intensity})`);
      gradient.addColorStop(.78, `rgba(211,235,137,${.52 * pulse.intensity})`);
      gradient.addColorStop(1, `rgba(252,255,222,${.96 * pulse.intensity})`);

      drawSignalSegment(pulse, tailT, headT, 8 + pulse.intensity * 4, `rgba(126,181,72,${.045 * pulse.intensity})`);
      drawSignalSegment(pulse, tailT, headT, 1.05 + pulse.intensity * 1.05, gradient);

      const precursorT = Math.min(1, headT + .022 + .012 * Math.sin(now * .006 + pulse.packetPhase));
      const precursor = pointOnPulse(pulse, precursorT);
      const precursorGlow = context.createRadialGradient(precursor.x, precursor.y, 0, precursor.x, precursor.y, 12);
      precursorGlow.addColorStop(0, `rgba(220,239,151,${.18 * pulse.intensity})`);
      precursorGlow.addColorStop(1, 'rgba(130,180,75,0)');
      context.fillStyle = precursorGlow;
      context.beginPath();
      context.arc(precursor.x, precursor.y, 12, 0, TAU);
      context.fill();

      for (let bead = 1; bead <= 2; bead += 1) {
        const beadT = Math.max(tailT, headT - bead * .055);
        const point = pointOnPulse(pulse, beadT);
        const alpha = (.30 / bead) * pulse.intensity;
        context.fillStyle = `rgba(223,241,158,${alpha})`;
        context.beginPath();
        context.arc(point.x, point.y, 1.45 - bead * .24, 0, TAU);
        context.fill();
      }

      const glow = context.createRadialGradient(head.x, head.y, 0, head.x, head.y, 22 * pulse.intensity);
      glow.addColorStop(0, `rgba(253,255,225,${.94 * pulse.intensity})`);
      glow.addColorStop(.13, `rgba(190,222,113,${.58 * pulse.intensity})`);
      glow.addColorStop(1, 'rgba(102,162,62,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(head.x, head.y, 22 * pulse.intensity, 0, TAU);
      context.fill();
      context.fillStyle = `rgba(254,255,232,${pulse.intensity})`;
      context.beginPath();
      context.arc(head.x, head.y, 1.5 + pulse.intensity * .7, 0, TAU);
      context.fill();
    });

    drawBlooms(now);
    context.restore();
  }

  function render(now) {
    const delta = Math.min(.04, Math.max(.001, (now - state.lastFrame) / 1000));
    state.lastFrame = now;
    if (state.active) update(delta, now);
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    context.clearRect(0, 0, state.width, state.height);
    if (state.active) {
      drawNetwork(now);
      if (soundscape) {
        const idleFor = state.pointer.lastMovedAt ? now - state.pointer.lastMovedAt : Infinity;
        state.pointer.speed = idleFor < 90
          ? state.pointer.eventSpeed
          : state.pointer.eventSpeed * Math.exp(-(idleFor - 90) / 420);
        const scene = state.phase === 'arrival' ? 1
          : state.phase === 'chapter' ? 2
            : state.phase === 'local' ? 3
              : state.phase === 'network' ? 4
                : 5;
        soundscape.setScene(scene);
        soundscape.update({
          scene,
          pointer: {
            x: state.pointer.x,
            y: state.pointer.y,
            speed: state.pointer.speed,
          },
          interaction: {
            hovering: Boolean(state.hoveredNode),
            hover: state.hoveredNode ? clamp(state.hoveredNode.activation / .38, 0, 1) : 0,
          },
        });
      }
    }
    canvas.dataset.phase = state.phase;
    canvas.dataset.reveal = state.reveal.toFixed(3);
    canvas.dataset.pulses = String(state.pulses.filter((pulse) => now >= pulse.scheduledAt).length);
    canvas.dataset.queuedPulses = String(state.pulses.length + state.pulseQueue.length);
    canvas.dataset.arrivals = String(state.arrivalCount);
    canvas.dataset.organArrivals = String(state.organArrivalCount);
    canvas.dataset.crossPlant = String(state.crossPlantCount);
    canvas.dataset.traces = String(state.traces.length);
    canvas.dataset.networkNodes = String(state.nodes.length);
    canvas.dataset.networkEdges = String(state.edges.length);
    canvas.dataset.userInteractions = String(state.userInteractionCount);
    canvas.dataset.entryNode = state.entryNodeKey;
    canvas.dataset.complete = String(state.completeDispatched);
    requestAnimationFrame(render);
  }

  function getNodeScreenPosition(nodeKey = 'spore-center-low') {
    const node = state.nodesByKey.get(nodeKey) || state.nodesByKey.get('spore-center-low');
    if (!node) return null;
    const point = project(node);
    return {
      nodeId: node.key,
      x: point.x,
      y: point.y,
      imageX: node.x,
      imageY: node.y,
      organ: node.organ,
      plant: node.plant,
    };
  }

  function resetExperience(now) {
    state.startedAt = now;
    state.lastFrame = now;
    state.lastActivityAt = now;
    state.reveal = 0;
    state.targetReveal = .08;
    state.arrivalCount = 0;
    state.organArrivalCount = 0;
    state.crossPlantCount = 0;
    state.hereShown = false;
    state.thereShown = false;
    state.narrativeBeat = '';
    state.narrativeReady = false;
    state.narrativeStep = -1;
    state.wholeStartedAt = 0;
    state.firstInteractionAt = 0;
    state.userInteractionCount = 0;
    state.completeAt = 0;
    state.completeDispatched = false;
    state.pulses.length = 0;
    state.pulseQueue.length = 0;
    state.intakes.length = 0;
    state.blooms.length = 0;
    state.traces.length = 0;
    state.cascades.clear();
    state.hoveredNode = null;
    state.nodes.forEach((node) => { node.activation = 0; });
    setChapterStage('hidden');
    hideNarrativeContinue();
    resetSources();
    root.dispatchEvent(new CustomEvent('greenbody:reset'));
  }

  function prepareEntry(options = {}) {
    if (state.active) return getNodeScreenPosition(options.nodeId);
    state.prepared = true;
    state.entering = true;
    root.hidden = false;
    root.dataset.active = 'false';
    root.dataset.entry = 'prepared';
    root.setAttribute('aria-hidden', 'true');
    root.classList.remove('is-visible');
    showBeat('');
    setPhase('prepared');
    resize();
    return getNodeScreenPosition(options.nodeId);
  }

  function commitEntry(options = {}) {
    if (state.active) return getNodeScreenPosition(state.entryNodeKey);
    prepareEntry(options);
    const now = performance.now();
    const arrivalDelayMs = clamp(Number(options.arrivalDelayMs) || 860, 30, 1800);
    state.entryNodeKey = state.nodesByKey.has(options.nodeId)
      ? options.nodeId
      : 'spore-center-low';
    resetExperience(now);
    state.prepared = false;
    state.entering = false;
    state.active = true;
    state.entryLanded = false;
    state.entryLandsAt = now + arrivalDelayMs;
    state.entryChapterAt = state.entryLandsAt + 520;
    state.entryDockAt = state.entryChapterAt + 2500;
    state.entryLocalAt = state.entryDockAt + 1250;
    root.dataset.active = 'true';
    root.dataset.entry = 'crossing';
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('world-one-active');
    setPhase('arrival');
    root.classList.add('is-visible');
    resize();
    if (soundscape) {
      soundscape.setActive(true);
    }
    const target = getNodeScreenPosition(state.entryNodeKey);
    root.dispatchEvent(new CustomEvent('greenbody:entry', {
      detail: {
        source: options.source || 'direct',
        nodeId: state.entryNodeKey,
        arrivalDelayMs,
        target,
      },
    }));
    return target;
  }

  function enter(options = {}) {
    prepareEntry(options);
    return commitEntry({
      ...options,
      source: options.source || 'direct',
      arrivalDelayMs: options.immediate ? 30 : options.arrivalDelayMs,
    });
  }

  function exit(options = {}) {
    if (!state.active && !state.entering && !state.prepared) return;
    state.active = false;
    state.prepared = false;
    state.entering = false;
    root.classList.remove('is-visible');
    root.dataset.active = 'false';
    root.dataset.entry = 'idle';
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('world-one-active');
    cursor.classList.remove('is-visible', 'is-active');
    if (soundscape) soundscape.setActive(false);
    resetSources();
    hideNarrativeContinue();
    showBeat('');
    root.dispatchEvent(new CustomEvent('greenbody:exit', {
      detail: { destination: options.destination || 'home' },
    }));
    setTimeout(() => { if (!state.active && !state.prepared) root.hidden = true; }, 40);
  }

  addEventListener('pointermove', (event) => {
    const now = performance.now();
    const deltaSeconds = state.pointer.lastEventAt
      ? clamp((now - state.pointer.lastEventAt) / 1000, .008, .08)
      : .016;
    const distance = Math.hypot(
      event.clientX - state.pointer.previousX,
      event.clientY - state.pointer.previousY
    );
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.previousX = event.clientX;
    state.pointer.previousY = event.clientY;
    state.pointer.lastEventAt = now;
    if (distance > .35) {
      state.pointer.lastMovedAt = now;
      state.pointer.eventSpeed = distance / deltaSeconds;
    }
    state.pointer.visible = true;
    cursor.style.setProperty('--cursor-x', `${event.clientX}px`);
    cursor.style.setProperty('--cursor-y', `${event.clientY}px`);
    const interactive = state.active
      && (state.phase === 'local' || state.phase === 'network' || state.phase === 'whole');
    cursor.classList.toggle('is-visible', interactive);
    if (!interactive) return;
    state.hoveredNode = nearestNode(event.clientX, event.clientY);
    if (state.phase === 'local' && state.hoveredNode && !state.hereShown) {
      state.hereShown = true;
      showBeat('here');
      setHint(narrative.hints.touched || '点击，把你的感知送进去。', 'CLICK TO SEND THE SIGNAL');
    }
  }, { passive: true });
  addEventListener('pointerleave', () => {
    state.pointer.visible = false;
    state.hoveredNode = null;
    cursor.classList.remove('is-visible');
  });
  addEventListener('pointerdown', (event) => {
    if (!state.active || event.target === returnButton || event.target.closest?.('#worldSoundToggle, .world-one__narrative-continue, .world-one__source-trigger, .world-one__sources')) return;
    if (state.phase !== 'local' && state.phase !== 'network' && state.phase !== 'whole') return;
    const node = nearestNode(event.clientX, event.clientY, false);
    ignite(node, { x: event.clientX, y: event.clientY }, { source: 'user' });
  }, { passive: true });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.sourcesOpen) {
      closeSources();
      return;
    }
    if (event.key === 'Escape' && state.active) exit();
    if (event.target.closest?.('.world-one__narrative-continue, .world-one__source-trigger, .world-one__sources')) return;
    if (
      (event.key === 'Enter' || event.key === ' ')
      && state.active
      && (state.phase === 'local' || state.phase === 'network' || state.phase === 'whole')
    ) {
      ignite(
        nearestNode(state.width / 2, state.height / 2, false),
        { x: state.width / 2, y: state.height / 2 },
        { source: 'user' }
      );
    }
  });
  addEventListener('resize', resize);
  returnButton.addEventListener('click', () => exit({ destination: 'home' }));
  narrativeContinue?.addEventListener('click', advanceNarrative);
  sourcesToggle?.addEventListener('click', openSources);
  sourcesClose?.addEventListener('click', closeSources);
  sourcesContinue?.addEventListener('click', closeSources);
  sourcesScrim?.addEventListener('click', closeSources);

  buildNetwork();
  resize();
  requestAnimationFrame(render);
  window.__worldOne = {
    prepareEntry,
    commitEntry,
    enter,
    exit,
    getNodeScreenPosition,
    enterForTesting: () => enter({ immediate: true }),
    exitForTesting: () => exit({ destination: 'test' }),
    getState: () => ({
      active: state.active,
      prepared: state.prepared,
      phase: state.phase,
      entry: root.dataset.entry,
      entryNode: state.entryNodeKey,
      entryLanded: state.entryLanded,
      reveal: state.reveal,
      pulses: state.pulses.length + state.pulseQueue.length,
      arrivals: state.arrivalCount,
      organArrivals: state.organArrivalCount,
      crossPlantCount: state.crossPlantCount,
      userInteractions: state.userInteractionCount,
      complete: state.completeDispatched,
      narrative: state.narrativeBeat,
      narrativeReady: state.narrativeReady,
      narrativeStep: state.narrativeStep,
      sourcesReady: state.sourcesReady,
      sourcesOpen: state.sourcesOpen,
      networkNodes: state.nodes.length,
      networkEdges: state.edges.length,
      sound: soundscape ? soundscape.getState() : null,
      contract: {
        version: 'home-green-0.1',
        entryNode: 'spore-center-low',
        entryEvent: 'greenbody:entry',
        arrivalEvent: 'greenbody:arrival',
        completeEvent: 'greenbody:complete',
        exitEvent: 'greenbody:exit',
      },
    }),
  };
  if (new URLSearchParams(location.search).has('greenBodyTest')) enter({ immediate: true });
  window.addEventListener('pagehide', () => soundscape?.destroy());
})();
