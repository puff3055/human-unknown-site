(() => {
  "use strict";

  const world = document.querySelector("[data-world]");
  const canvas = document.querySelector("[data-canvas]");
  const chapter = document.querySelector("[data-chapter]");
  const narrative = document.querySelector("[data-narrative]");
  const copy = document.querySelector("[data-copy]");
  const prompt = document.querySelector("[data-prompt]");
  const sourceNote = document.querySelector("[data-source-note]");
  const sourceKind = document.querySelector("[data-source-kind]");
  const sourceLink = document.querySelector("[data-source-link]");
  const sourceRelation = document.querySelector("[data-source-relation]");
  const continueButton = document.querySelector("[data-continue]");
  const actions = document.querySelector("[data-actions]");
  const sourceTraces = document.querySelector("[data-source-traces]");
  const openInspirationButton = document.querySelector("[data-open-inspiration]");
  const closeInspirationButton = document.querySelector("[data-close-inspiration]");
  const drawerShade = document.querySelector("[data-drawer-shade]");
  const inspiration = document.querySelector("[data-inspiration]");
  const replayButton = document.querySelector("[data-replay]");
  const nextWorldButton = document.querySelector("[data-next-world]");
  const depthLabel = document.querySelector("[data-depth]");
  const status = document.querySelector("[data-status]");
  const soundButton = document.querySelector("[data-sound]");
  const scaleControl = document.querySelector("[data-scale-control]");
  const scaleInput = document.querySelector("[data-scale-input]");
  const scaleValue = document.querySelector("[data-scale-value]");
  const scaleStepButtons = document.querySelectorAll("[data-scale-step]");
  const scaleRail = document.querySelector(".scale-control__rail-wrap");

  const renderer = new window.PlanetNeuronRenderer(canvas);
  const sound = new window.PlanetNeuronSound();
  const SOUND_STORAGE_KEY = "human-unknown:sound-enabled";
  const HERO = { x: 0.466, y: 0.505 };
  const MIN_DEPTH = Number(scaleInput.min);
  const MAX_DEPTH = Number(scaleInput.max);
  const pointer = { source: { ...HERO }, active: false, overNode: false, speed: 0, lastX: innerWidth / 2, lastY: innerHeight / 2, lastMoveAt: 0, energy: 0, parallax: { x: 0, y: 0 }, parallaxTarget: { x: 0, y: 0 } };
  const state = {
    phase: "loading", depth: 0, targetDepth: 0, lastLevel: 0, maxDepthReached: 0,
    clickedAt: -1, signalAt: -1, signalCopyShown: false, diveAt: -1,
    diveStartDepth: 0, diveTargetDepth: 1, nextAmbientAt: performance.now() + 1800,
    ambientIndex: 0, lastFrameAt: performance.now(), scaleEnergy: 0, hidden: false,
    introComplete: false, narrativeLocked: false, activeScene: null, deferredScene: null,
  };
  const shownMilestones = new Set();
  const acknowledgedScenes = new Set();
  const collectedSources = new Set();
  let scaleDragging = false;
  let soundWanted = (() => {
    try { return localStorage.getItem(SOUND_STORAGE_KEY) !== "off"; }
    catch (_) { return true; }
  })();
  let idleHintTimer = 0;
  let introTimers = [];

  const eventPositions = [
    { x: 0.184, y: 0.812 }, { x: 0.278, y: 0.485 }, { x: 0.748, y: 0.824 },
    { x: 0.826, y: 0.286 }, { x: 0.535, y: 0.638 }, { x: 0.371, y: 0.235 },
  ];

  const sources = {
    powers: {
      type: "实验短片",
      title: "《十的次方》 POWERS OF TEN ↗",
      url: "https://www.eamesoffice.com/the-work/powers-of-ten/",
      relation: "一次从宇宙进入人体与原子内部的尺度旅行：距离改变后，同一个世界会显露出陌生身份。",
    },
    network: {
      type: "科学论文",
      title: "《大脑神经网络与宇宙网的定量比较》 ↗",
      url: "https://www.frontiersin.org/journals/physics/articles/10.3389/fphy.2020.525731/full",
      relation: "研究比较了两种网络的形态与连接特征；相似确实存在，但它们由完全不同的物理过程形成。",
    },
    solaris: {
      type: "科幻小说",
      title: "《索拉里斯星》 SOLARIS ↗",
      url: "https://english.lem.pl/index.php/works/novels/solaris",
      relation: "一整颗行星可能是生命，也可能是意识；人类却始终无法确定它究竟是什么。",
    },
    cosmos: {
      type: "科普著作",
      title: "Carl Sagan《宇宙》 COSMOS ↗",
      url: "https://www.penguinrandomhouse.com/books/159730/cosmos-by-carl-sagan/",
      relation: "人的身体来自宇宙中的物质；人的意识，也因此成为宇宙内部发生的事情。",
    },
    starmaker: {
      type: "科幻小说",
      title: "《造星主》 STAR MAKER ↗",
      url: "https://www.weslpress.org/9780819566935/star-maker/",
      relation: "一个普通意识穿越星球与星系，最终进入一种更庞大的“宇宙心灵”。",
    },
  };

  const scenes = {
    1: {
      id: "scale-one", source: "powers",
      copy: "你以为自己正在靠近一颗行星。\n\n可这道光更像一束神经信号，\n带你穿过一个尚未完成的念头。",
    },
    2: {
      id: "scale-two", source: "network",
      copy: "远看，它们像彼此牵引的行星；\n靠近，又像正在交换信号的神经元。\n\n连接它们的纤维，既像星际通道，\n也像让神经信号通过的轴突。",
    },
    3: {
      id: "scale-three", source: "solaris",
      copy: "它不一定是行星，\n也不一定是神经元。\n\n你只是从一个尺度，\n看见了它的一个名字。",
    },
    4: {
      id: "scale-four", source: "cosmos",
      copy: "你身体里的许多元素，\n也曾在恒星内部形成。\n\n宇宙不只在你之外。\n它也构成了你。",
    },
    core: {
      id: "core", source: "starmaker",
      copy: "这些来自宇宙的物质，\n此刻正在你的神经元之间成为一个念头。\n\n也许我们的意识，\n是宇宙在这个尺度上看见自己的一种方式。",
    },
  };

  function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
  function easeInOutCubic(value) { return value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2; }
  function setPhase(phase) { state.phase = phase; world.dataset.phase = phase; }
  function clearIdleHint() { window.clearTimeout(idleHintTimer); }
  function clearIntroTimers() { introTimers.forEach(window.clearTimeout); introTimers = []; }

  function hideSource() {
    sourceNote.classList.remove("is-visible");
    sourceLink.removeAttribute("href");
  }

  function showSource(sourceId) {
    const source = sources[sourceId];
    sourceKind.textContent = "灵感来源 · " + source.type;
    sourceLink.textContent = source.title;
    sourceLink.href = source.url;
    sourceRelation.textContent = source.relation;
    sourceNote.classList.add("is-visible");
  }

  function collectSource(sourceId) {
    if (!sourceId || collectedSources.has(sourceId)) return;
    collectedSources.add(sourceId);
    const trace = document.createElement("i");
    sourceTraces.appendChild(trace);
  }

  function showNarrative(text, options = {}) {
    narrative.setAttribute("aria-hidden", "false");
    narrative.classList.add("is-visible");
    copy.textContent = text;
    prompt.textContent = options.prompt || "";
    actions.classList.toggle("is-visible", Boolean(options.final));
    continueButton.classList.toggle("is-visible", Boolean(options.continue));
    if (options.source) showSource(options.source); else hideSource();
    status.textContent = text.replace(/\s+/g, " ");
  }

  function showExplorationPrompt() {
    if (!state.introComplete || state.narrativeLocked) return;
    state.activeScene = null;
    showNarrative("", {
      prompt: "继续改变尺度，看看这种结构在哪里结束。\n点击一颗发光的球体，让信号继续。",
    });
  }

  function showScene(scene) {
    state.activeScene = scene;
    state.narrativeLocked = true;
    showNarrative(scene.copy, {
      source: scene.source,
      continue: true,
      prompt: "也可以再次点击球体，让信号带你继续。",
    });
  }

  function showFinal() {
    state.activeScene = { id: "final" };
    state.narrativeLocked = true;
    showNarrative(
      "你来时，以为自己在观察一颗行星。\n\n离开时，你无法确定自己刚刚向外走进了宇宙，\n还是向内走进了意识。",
      {
        prompt: "当你凝视宇宙——\n是你在看它，还是它正借你的神经元看见自己？",
        final: true,
      }
    );
  }

  function processNarrativeMilestones() {
    if (!state.introComplete || state.narrativeLocked) return;
    for (let level = 1; level <= Math.min(4, state.maxDepthReached); level += 1) {
      if (!shownMilestones.has(level)) {
        shownMilestones.add(level);
        showScene(scenes[level]);
        return;
      }
    }
    showExplorationPrompt();
  }

  function advanceFromScene(scene) {
    if (scene.id === "scale-four") {
      window.setTimeout(() => showScene(scenes.core), 280);
    } else if (scene.id === "core") {
      window.setTimeout(showFinal, 280);
    } else {
      window.setTimeout(processNarrativeMilestones, 280);
    }
  }

  function acknowledgeScene(options = {}) {
    const scene = state.activeScene;
    if (!scene) return;
    acknowledgedScenes.add(scene.id);
    collectSource(scene.source);
    state.narrativeLocked = false;
    continueButton.classList.remove("is-visible");
    hideSource();
    if (options.deferUntilSignal) state.deferredScene = scene;
    else advanceFromScene(scene);
  }

  function completeDeferredNarrative() {
    if (!state.deferredScene) return;
    const scene = state.deferredScene;
    state.deferredScene = null;
    advanceFromScene(scene);
  }

  function scheduleIdleHint() {
    clearIdleHint();
    idleHintTimer = window.setTimeout(() => {
      if (!state.narrativeLocked && state.maxDepthReached === 0 && state.clickedAt < 0) {
        showNarrative("你以为那是一颗行星。", { prompt: "试着触碰一颗正在发光的“行星”。" });
      }
    }, 8000);
  }

  function beginIntro() {
    clearIntroTimers();
    clearIdleHint();
    state.introComplete = false;
    world.classList.remove("is-intro-complete");
    chapter.classList.remove("is-docked", "is-visible");
    narrative.classList.remove("is-visible");
    narrative.setAttribute("aria-hidden", "true");
    copy.textContent = "";
    prompt.textContent = "";
    actions.classList.remove("is-visible");
    continueButton.classList.remove("is-visible");
    hideSource();
    introTimers.push(window.setTimeout(() => chapter.classList.add("is-visible"), 260));
    introTimers.push(window.setTimeout(() => chapter.classList.add("is-docked"), 2750));
    introTimers.push(window.setTimeout(() => {
      state.introComplete = true;
      world.classList.add("is-intro-complete");
      showNarrative("你以为那是一颗行星。", {
        prompt: "移动右侧尺度，改变你与它的距离。\n点击一颗发光的球体，让一道信号进入它。",
      });
      scheduleIdleHint();
      if (state.maxDepthReached > 0) processNarrativeMilestones();
    }, 3800));
  }

  function cancelAutomaticDive() {
    if (state.clickedAt < 0) return;
    state.clickedAt = -1;
    renderer.setClick(-1);
    renderer.setSignal(-1);
    renderer.setSeam(0);
    status.textContent = "观察距离已由你接管。";
    setPhase("exploring");
    completeDeferredNarrative();
  }

  function setManualDepth(nextDepth, immediate = false) {
    clearIdleHint();
    cancelAutomaticDive();
    state.targetDepth = clamp(nextDepth, MIN_DEPTH, MAX_DEPTH);
    if (immediate) state.depth = state.targetDepth;
    state.scaleEnergy = 1;
    setPhase("exploring");
    sound.setScaleMotion(1, Math.sign(state.targetDepth - state.depth));
  }

  function updateScaleControl() {
    const progress = (state.depth - MIN_DEPTH) / (MAX_DEPTH - MIN_DEPTH);
    scaleInput.value = String(state.depth);
    scaleControl.style.setProperty("--scale-position", ((1 - clamp(progress)) * 100) + "%");
    const displayLevel = Math.max(0, Math.floor(state.depth)) + 1;
    scaleValue.textContent = "尺度 " + String(displayLevel).padStart(2, "0");
    depthLabel.textContent = "SCALE " + String(displayLevel).padStart(2, "0");
  }

  function setDepthFromScalePointer(event) {
    const rect = scaleRail.getBoundingClientRect();
    const progress = 1 - clamp((event.clientY - rect.top) / rect.height);
    setManualDepth(MIN_DEPTH + progress * (MAX_DEPTH - MIN_DEPTH), true);
  }

  function updatePointer(event) {
    const now = performance.now();
    const elapsed = Math.max(16, now - pointer.lastMoveAt);
    const distance = Math.hypot(event.clientX - pointer.lastX, event.clientY - pointer.lastY);
    pointer.speed = distance / elapsed * 1000;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.lastMoveAt = now;
    pointer.active = true;
    pointer.source = renderer.screenToSource(event.clientX, event.clientY);
    pointer.overNode = renderer.isOverLivingNode(pointer.source);
    pointer.parallaxTarget.x = (event.clientX / innerWidth - .5) * 2;
    pointer.parallaxTarget.y = (.5 - event.clientY / innerHeight) * 2;
  }

  function leaveWorld() {
    pointer.active = false;
    pointer.overNode = false;
    pointer.parallaxTarget.x = 0;
    pointer.parallaxTarget.y = 0;
  }

  function handleWheel(event) {
    if (!state.introComplete || world.classList.contains("is-drawer-open")) return;
    event.preventDefault();
    clearIdleHint();
    if (["compressing", "transmitting", "diving"].includes(state.phase)) return;
    const modeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = clamp(event.deltaY * modeScale, -160, 160);
    state.targetDepth = clamp(state.targetDepth + delta * .00135, MIN_DEPTH, MAX_DEPTH);
    state.scaleEnergy = clamp(state.scaleEnergy + Math.abs(delta) / 130);
    setPhase("exploring");
    sound.setScaleMotion(state.scaleEnergy, Math.sign(delta));
  }

  function handleClick(event) {
    if (!state.introComplete || event.target.closest("[data-ui]") || world.classList.contains("is-drawer-open")) return;
    if (["compressing", "transmitting", "diving"].includes(state.phase)) return;
    clearIdleHint();
    pointer.source = renderer.screenToSource(event.clientX, event.clientY);
    if (!renderer.isOverLivingNode(pointer.source)) return;
    const finalVisible = state.activeScene?.id === "final";
    const now = performance.now();
    state.clickedAt = now;
    state.signalAt = now + 460;
    state.signalCopyShown = false;
    state.diveAt = now + 1280;
    state.diveStartDepth = state.depth;
    state.diveTargetDepth = clamp(Math.floor(state.depth) + 1, MIN_DEPTH, MAX_DEPTH);
    renderer.setClick(0, pointer.source);
    renderer.setSignal(-1);
    renderer.addEvent("burst", pointer.source, 1350);
    setPhase("compressing");
    if (!finalVisible) {
      if (state.narrativeLocked) acknowledgeScene({ deferUntilSignal: true });
      showNarrative("信号被接收了。", { prompt: "这次触碰，也会带你进入下一段。" });
    }
    status.textContent = "信号正在聚拢。";
    sound.triggerSignal();
  }

  function updateNarrativeDepth() {
    const displayLevel = Math.max(0, Math.floor(state.depth));
    if (displayLevel > state.maxDepthReached) {
      state.maxDepthReached = displayLevel;
      processNarrativeMilestones();
    }
  }

  function scheduleAmbientEvent(now) {
    if (now < state.nextAmbientAt || ["compressing", "transmitting"].includes(state.phase)) return;
    const position = eventPositions[state.ambientIndex % eventPositions.length];
    const kind = state.ambientIndex % 3 === 1 ? "annihilation" : "burst";
    renderer.addEvent(kind, position, kind === "burst" ? 1450 : 2250);
    state.ambientIndex += 1;
    state.nextAmbientAt = now + 2700 + Math.random() * 3900;
  }

  function update(now, delta) {
    const calm = 1 - clamp(pointer.speed / 880);
    const targetEnergy = pointer.active && pointer.overNode ? .38 + calm * .62 : 0;
    pointer.energy += (targetEnergy - pointer.energy) * clamp(delta / 135);
    pointer.speed *= Math.pow(.84, delta / 16.67);
    pointer.parallax.x += (pointer.parallaxTarget.x - pointer.parallax.x) * clamp(delta / 260);
    pointer.parallax.y += (pointer.parallaxTarget.y - pointer.parallax.y) * clamp(delta / 260);

    if (state.clickedAt >= 0) {
      const clickAge = clamp((now - state.clickedAt) / 1120);
      renderer.setClick(clickAge);
      if (now >= state.signalAt) {
        setPhase(now < state.diveAt ? "transmitting" : "diving");
        renderer.setSignal(clamp((now - state.signalAt) / 1380));
        if (!state.signalCopyShown && !state.narrativeLocked) {
          state.signalCopyShown = true;
          showNarrative("它没有停在这里。\n\n它正沿着纤维，传向更远的节点。");
        }
      }
      if (now >= state.diveAt) {
        const diveProgress = clamp((now - state.diveAt) / 3650);
        const eased = easeInOutCubic(diveProgress);
        state.depth = state.diveStartDepth + (state.diveTargetDepth - state.diveStartDepth) * eased;
        state.targetDepth = state.depth;
        renderer.setSeam(Math.sin(clamp((diveProgress - .68) / .32) * Math.PI) * .88);
        sound.setScaleMotion(.5 + eased * .5, 1);
        if (diveProgress >= 1) {
          state.depth = state.diveTargetDepth;
          state.targetDepth = state.depth;
          state.clickedAt = -1;
          renderer.setClick(-1);
          renderer.setSignal(-1);
          renderer.setSeam(0);
          setPhase("free");
          status.textContent = "同一种结构仍在更深处延续。";
          updateNarrativeDepth();
          if (state.deferredScene) completeDeferredNarrative();
          else if (!state.narrativeLocked) showExplorationPrompt();
        }
      }
    } else {
      const depthDelta = state.targetDepth - state.depth;
      state.depth += depthDelta * clamp(delta / 145);
      state.scaleEnergy += (Math.min(1, Math.abs(depthDelta) * 4.5) - state.scaleEnergy) * clamp(delta / 150);
      renderer.setSeam(Math.pow(Math.max(0, (state.depth - Math.floor(state.depth) - .78) / .22), 1.4) * .55);
      if (Math.abs(depthDelta) < .0008) {
        state.depth = state.targetDepth;
        if (state.phase === "exploring") setPhase("free");
      }
    }

    const level = Math.floor(state.depth);
    if (level !== state.lastLevel) {
      sound.scaleCrossing(Math.sign(level - state.lastLevel));
      state.lastLevel = level;
      updateNarrativeDepth();
    }
    renderer.setDepth(state.depth);
    pointer.source = renderer.screenToSource(pointer.lastX, pointer.lastY);
    pointer.overNode = pointer.active && renderer.isOverLivingNode(pointer.source);
    renderer.setPointer(pointer.source, pointer.energy);
    renderer.setParallax(pointer.parallax);
    sound.setPointerEnergy(pointer.energy);
    updateScaleControl();
    scheduleAmbientEvent(now);
  }

  function frame(now) {
    const delta = Math.min(50, now - state.lastFrameAt);
    state.lastFrameAt = now;
    if (!state.hidden) {
      update(now, delta);
      renderer.render(now);
    }
    requestAnimationFrame(frame);
  }

  async function toggleSound() {
    soundWanted = !soundWanted;
    try { localStorage.setItem(SOUND_STORAGE_KEY, soundWanted ? "on" : "off"); } catch (_) {}
    if (soundWanted) await sound.enable(); else sound.disable();
    syncSoundControl();
  }

  function syncSoundControl() {
    soundButton.setAttribute("aria-pressed", String(soundWanted));
    soundButton.setAttribute("aria-label", soundWanted ? "关闭声音" : "开启声音");
  }

  function activatePreferredSound(event) {
    if (event.target.closest?.("[data-sound]") || !soundWanted || sound.enabled) return;
    sound.enable();
  }

  function openInspiration() {
    world.classList.add("is-drawer-open");
    inspiration.classList.add("is-open");
    inspiration.setAttribute("aria-hidden", "false");
    closeInspirationButton.focus();
  }

  function closeInspiration() {
    world.classList.remove("is-drawer-open");
    inspiration.classList.remove("is-open");
    inspiration.setAttribute("aria-hidden", "true");
    openInspirationButton.focus();
  }

  function replay() {
    closeInspiration();
    shownMilestones.clear();
    acknowledgedScenes.clear();
    collectedSources.clear();
    sourceTraces.replaceChildren();
    state.depth = 0;
    state.targetDepth = 0;
    state.lastLevel = 0;
    state.maxDepthReached = 0;
    state.clickedAt = -1;
    state.narrativeLocked = false;
    state.activeScene = null;
    state.deferredScene = null;
    renderer.setDepth(0);
    renderer.setClick(-1);
    renderer.setSignal(-1);
    renderer.setSeam(0);
    setPhase("idle");
    updateScaleControl();
    beginIntro();
  }

  async function initialize() {
    try {
      await renderer.initialize("./assets");
      renderer.setDepth(0);
      setPhase("idle");
      status.textContent = "递归宇宙已载入。";
      updateScaleControl();
      syncSoundControl();
      beginIntro();
      requestAnimationFrame(frame);
    } catch (error) {
      console.error(error);
      setPhase("error");
      status.textContent = "这个世界未能正常加载。";
    }
  }

  window.addEventListener("resize", () => renderer.resize());
  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerdown", activatePreferredSound, { passive: true });
  window.addEventListener("pointerleave", leaveWorld);
  window.addEventListener("wheel", handleWheel, { passive: false });
  canvas.addEventListener("click", handleClick);
  scaleInput.addEventListener("pointerdown", cancelAutomaticDive);
  scaleInput.addEventListener("input", () => setManualDepth(Number(scaleInput.value), true));
  scaleRail.addEventListener("pointerdown", (event) => {
    scaleDragging = true;
    scaleRail.setPointerCapture(event.pointerId);
    setDepthFromScalePointer(event);
    event.preventDefault();
  });
  scaleRail.addEventListener("pointermove", (event) => { if (scaleDragging) setDepthFromScalePointer(event); });
  scaleRail.addEventListener("pointerup", (event) => {
    scaleDragging = false;
    if (scaleRail.hasPointerCapture(event.pointerId)) scaleRail.releasePointerCapture(event.pointerId);
    setPhase("free");
  });
  scaleStepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const isNear = button.dataset.scaleStep === "near";
      const nextLevel = isNear ? Math.floor(state.depth) + 1 : Math.ceil(state.depth) - 1;
      setManualDepth(nextLevel);
    });
  });
  continueButton.addEventListener("click", acknowledgeScene);
  soundButton.addEventListener("click", toggleSound);
  openInspirationButton.addEventListener("click", openInspiration);
  closeInspirationButton.addEventListener("click", closeInspiration);
  drawerShade.addEventListener("click", closeInspiration);
  replayButton.addEventListener("click", replay);
  nextWorldButton.addEventListener("click", () => {
    window.HumanUnknownJourney?.go("../eye-multiverse.html", { kind: "branch" });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && world.classList.contains("is-drawer-open")) closeInspiration();
  });
  document.addEventListener("visibilitychange", () => {
    state.hidden = document.hidden;
    sound.setVisible(!document.hidden);
  });

  initialize();
})();
