(() => {
  'use strict';

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const STORAGE_KEY = 'human-unknown:sound-enabled';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function smoothstep(edge0, edge1, value) {
    const amount = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return amount * amount * (3 - 2 * amount);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function safeStoredPreference() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function savePreference(enabled) {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch (error) {
      // The visible control remains usable when storage is unavailable.
    }
  }

  class LivingSoundscape {
    constructor(toggle) {
      this.toggle = toggle;
      this.icon = toggle ? toggle.querySelector('img') : null;
      this.status = document.getElementById('soundStatus');
      this.prompt = document.getElementById('soundPrompt');
      this.supported = Boolean(AudioContextClass && toggle);
      // The experience is sound-on by intent. A fresh visit waits in an
      // explicit "armed" state until a browser-approved gesture; only a
      // deliberate stored opt-out remains off.
      this.enabled = safeStoredPreference() !== 'off';
      this.activated = false;
      this.sceneActive = true;
      this.profile = 'home';
      this.context = null;
      this.nodes = null;
      this.levelData = null;
      this.timers = new Set();
      this.activeEvents = [];
      this.seenMetabolism = new Set();
      this.suspendTimer = 0;
      this.visibilityTimer = 0;
      this.promptTimer = 0;
      this.operationSerial = 0;
      this.telemetryFrame = 0;
      this.lastControlAt = 0;
      this.lastPhase = 'opening';
      this.lastNoticeSerial = 0;
      this.lastMetabolismAt = -Infinity;
      this.hoverEnteredAt = 0;
      this.hoverTriggered = false;
      this.plantHoverEnteredAt = 0;
      this.plantHoverTriggered = false;
      this.duckUntil = 0;
      this.diveTriggered = false;
      this.telemetry = {
        level: 0,
        presence: 0,
        pressure: 0,
        movement: 0,
        resonance: 0,
        focus: 0,
        entry: 0,
        silence: 0,
        events: 0,
      };
      this.mirrorControls = [];

      this.handleToggle = this.handleToggle.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleGesture = this.handleGesture.bind(this);
      this.handleVisibility = this.handleVisibility.bind(this);

      if (!this.supported) {
        this.setUiState('unsupported');
        if (this.toggle) this.toggle.disabled = true;
        return;
      }

      this.toggle.addEventListener('click', this.handleToggle);
      document.addEventListener('keydown', this.handleKeydown);
      document.addEventListener('pointerdown', this.handleGesture, { capture: true });
      document.addEventListener('visibilitychange', this.handleVisibility);
      this.setUiState(this.enabled ? 'armed' : 'off');
    }

    createGain(value = 0) {
      const gain = this.context.createGain();
      gain.gain.value = value;
      return gain;
    }

    createPanner(value = 0) {
      if (typeof this.context.createStereoPanner === 'function') {
        const panner = this.context.createStereoPanner();
        panner.pan.value = value;
        return panner;
      }

      const gain = this.context.createGain();
      gain.pan = {
        value,
        cancelScheduledValues() {},
        setTargetAtTime() {},
      };
      return gain;
    }

    glide(parameter, value, now, timeConstant) {
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(value, now, timeConstant);
    }

    buildGraph() {
      const context = this.context;
      const master = this.createGain(0);
      const sceneBus = this.createGain(1);
      const movementBus = this.createGain(1);
      const eventBus = this.createGain(1);
      const presenceGain = this.createGain(0);
      const focusFilter = context.createBiquadFilter();
      focusFilter.type = 'lowpass';
      focusFilter.frequency.value = 680;
      focusFilter.Q.value = 0.38;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.86;

      movementBus.connect(sceneBus);
      eventBus.connect(sceneBus);
      presenceGain.connect(sceneBus);
      sceneBus.connect(focusFilter);
      focusFilter.connect(master);
      master.connect(analyser);
      analyser.connect(context.destination);

      const movementFilter = context.createBiquadFilter();
      movementFilter.type = 'lowpass';
      movementFilter.frequency.value = 210;
      movementFilter.Q.value = 0.72;
      const movementPanner = this.createPanner(0);
      const movementGain = this.createGain(0);
      const movementLow = context.createOscillator();
      movementLow.type = 'sine';
      movementLow.frequency.value = 46.8;
      const movementLowGain = this.createGain(0.76);
      const movementHarmonic = context.createOscillator();
      movementHarmonic.type = 'sine';
      movementHarmonic.frequency.value = 103.7;
      const movementHarmonicGain = this.createGain(0.20);
      const movementColor = context.createOscillator();
      movementColor.type = 'triangle';
      movementColor.frequency.value = 72.4;
      const movementColorGain = this.createGain(0.055);

      movementLow.connect(movementLowGain);
      movementHarmonic.connect(movementHarmonicGain);
      movementColor.connect(movementColorGain);
      movementLowGain.connect(movementFilter);
      movementHarmonicGain.connect(movementFilter);
      movementColorGain.connect(movementFilter);
      movementFilter.connect(movementPanner);
      movementPanner.connect(movementGain);
      movementGain.connect(movementBus);
      movementLow.start();
      movementHarmonic.start();
      movementColor.start();

      // A narrow, gently drifting mass layer makes the sound state legible on
      // ordinary speakers without reintroducing broadband hiss or a noise bed.
      const presenceFilter = context.createBiquadFilter();
      presenceFilter.type = 'lowpass';
      presenceFilter.frequency.value = 148;
      presenceFilter.Q.value = 0.46;
      const presenceLow = context.createOscillator();
      presenceLow.type = 'sine';
      presenceLow.frequency.value = 44.2;
      const presenceLowGain = this.createGain(0.72);
      const presenceUpper = context.createOscillator();
      presenceUpper.type = 'sine';
      presenceUpper.frequency.value = 99.4;
      const presenceUpperGain = this.createGain(0.38);
      presenceLow.connect(presenceLowGain);
      presenceUpper.connect(presenceUpperGain);
      presenceLowGain.connect(presenceFilter);
      presenceUpperGain.connect(presenceFilter);
      presenceFilter.connect(presenceGain);
      presenceLow.start();
      presenceUpper.start();

      this.nodes = {
        master,
        sceneBus,
        movementBus,
        eventBus,
        focusFilter,
        analyser,
        movementFilter,
        movementPanner,
        movementGain,
        movementLow,
        movementLowGain,
        movementHarmonic,
        movementHarmonicGain,
        movementColor,
        movementColorGain,
        presenceGain,
        presenceFilter,
        presenceLow,
        presenceLowGain,
        presenceUpper,
        presenceUpperGain,
      };
      this.levelData = new Float32Array(analyser.fftSize);
    }

    registerMirror(toggle, status = null) {
      if (!toggle || this.mirrorControls.some((control) => control.toggle === toggle)) return;
      const click = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (toggle.dataset.soundState === 'starting') return;
        if (this.enabled && !this.activated) await this.setEnabled(true, false);
        else await this.setEnabled(!this.enabled);
      };
      toggle.addEventListener('click', click);
      this.mirrorControls.push({ toggle, status, click });
      this.syncMirrorControl(toggle, status, this.toggle.dataset.soundState || (this.enabled ? 'armed' : 'off'));
    }

    syncMirrorControl(toggle, status, state) {
      const icon = toggle.querySelector('img');
      const visiblyOn = state === 'on' || state === 'starting' || state === 'armed';
      const label = visiblyOn
        ? state === 'armed' ? '轻触开启声音' : state === 'starting' ? '正在唤醒声音' : '关闭声音'
        : state === 'unsupported' ? '当前浏览器不支持声音' : '开启声音';
      toggle.dataset.soundState = state;
      toggle.classList.toggle('is-on', visiblyOn);
      toggle.setAttribute('aria-pressed', String(visiblyOn));
      toggle.setAttribute('aria-busy', String(state === 'starting'));
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      if (icon) icon.src = visiblyOn ? 'assets/tabler-volume.svg' : 'assets/tabler-volume-off.svg';
      if (status) {
        status.textContent = state === 'on'
          ? '声音已开启'
          : state === 'armed' ? '声音等待触碰开启' : '声音已关闭';
      }
    }

    setProfile(profile) {
      const nextProfile = profile === 'plant' ? 'plant' : 'home';
      if (this.profile === nextProfile) return;
      this.profile = nextProfile;
      this.hoverEnteredAt = 0;
      this.hoverTriggered = false;
      this.plantHoverEnteredAt = 0;
      this.plantHoverTriggered = false;
      if (!this.context || !this.nodes) return;
      const now = this.context.currentTime;
      this.glide(this.nodes.movementGain.gain, 0, now, 0.12);
      this.glide(this.nodes.presenceGain.gain, 0, now, 0.12);
      this.glide(this.nodes.eventBus.gain, 0, now, 0.08);
      this.glide(this.nodes.eventBus.gain, 0.78, now + 0.16, 0.20);
    }

    setSceneActive(active) {
      this.sceneActive = Boolean(active);
      if (!this.context || !this.nodes) return;
      const now = this.context.currentTime;
      this.glide(this.nodes.sceneBus.gain, this.sceneActive ? 1 : 0, now, this.sceneActive ? 0.24 : 0.12);
    }

    trackTimer(callback, delay) {
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        callback();
      }, delay);
      this.timers.add(timer);
      return timer;
    }

    registerEvent(kind, durationMs, peak) {
      this.activeEvents.push({ kind, startedAt: performance.now(), durationMs, peak });
    }

    cleanupNodes(nodes, durationMs) {
      this.trackTimer(() => {
        nodes.forEach((node) => {
          try {
            node.disconnect();
          } catch (error) {
            // A closed AudioContext may already have released the node.
          }
        });
      }, durationMs + 180);
    }

    createEventPair(options) {
      if (!this.sceneActive || !this.context || !this.nodes || this.context.state !== 'running') return;
      const eventNow = performance.now();
      this.activeEvents = this.activeEvents.filter((event) => eventNow - event.startedAt < event.durationMs);
      if (this.activeEvents.length >= 2) return;
      const audioNow = this.context.currentTime;
      const duration = options.duration;
      const panner = this.createPanner(clamp(options.pan || 0, -0.34, 0.34));
      const gain = this.createGain(1);
      gain.connect(panner);
      panner.connect(this.nodes.eventBus);

      const low = this.context.createOscillator();
      low.type = options.lowType || 'sine';
      low.frequency.setValueAtTime(options.lowFrom, audioNow);
      low.frequency.exponentialRampToValueAtTime(options.lowTo, audioNow + duration * 0.82);
      const lowGain = this.createGain(0.0001);
      lowGain.gain.exponentialRampToValueAtTime(options.lowLevel, audioNow + options.attack);
      lowGain.gain.setTargetAtTime(0.0001, audioNow + options.releaseAt, options.release);
      low.connect(lowGain);
      lowGain.connect(gain);

      const upper = this.context.createOscillator();
      upper.type = options.upperType || 'sine';
      upper.frequency.setValueAtTime(options.upperFrom, audioNow);
      upper.frequency.exponentialRampToValueAtTime(options.upperTo, audioNow + duration * 0.76);
      const upperGain = this.createGain(0.0001);
      upperGain.gain.exponentialRampToValueAtTime(options.upperLevel, audioNow + options.attack * 1.18);
      upperGain.gain.setTargetAtTime(0.0001, audioNow + options.releaseAt, options.release * 0.82);
      upper.connect(upperGain);
      upperGain.connect(gain);

      low.start(audioNow);
      upper.start(audioNow);
      low.stop(audioNow + duration);
      upper.stop(audioNow + duration);
      this.cleanupNodes([low, lowGain, upper, upperGain, gain, panner], duration * 1000);
      this.registerEvent(options.kind, duration * 1000, options.lowLevel + options.upperLevel);
    }

    triggerEnableCue() {
      this.createEventPair({
        kind: 'enable', duration: 2.1, pan: 0,
        lowFrom: 43.8, lowTo: 47.1,
        upperFrom: 98.6, upperTo: 104.2,
        lowLevel: 0.015, upperLevel: 0.0035,
        attack: 0.18, releaseAt: 0.92, release: 0.48,
      });
    }

    triggerHoverResonance(pan = 0) {
      const base = randomBetween(41.0, 48.5);
      this.createEventPair({
        kind: 'resonance', duration: 4.2, pan: pan * 0.28,
        lowFrom: base, lowTo: base * 0.91,
        upperFrom: base * 2.31, upperTo: base * 2.47,
        lowLevel: 0.012, upperLevel: 0.0031,
        attack: 0.82, releaseAt: 2.0, release: 0.72,
      });
    }

    triggerNotice(strength = 0.9) {
      const amount = clamp(strength, 0.55, 1);
      this.duckUntil = performance.now() + 2800;
      this.createEventPair({
        kind: 'notice', duration: 3.6, pan: 0,
        lowFrom: 36.8, lowTo: 51.2,
        upperFrom: 88.7, upperTo: 116.3,
        lowLevel: 0.022 * amount, upperLevel: 0.0042 * amount,
        attack: 0.46, releaseAt: 1.35, release: 0.76,
      });
    }

    triggerDive() {
      this.createEventPair({
        kind: 'dive', duration: 4.0, pan: 0,
        lowFrom: 54.0, lowTo: 31.5,
        upperFrom: 113.0, upperTo: 63.7,
        lowLevel: 0.019, upperLevel: 0.0035,
        attack: 0.34, releaseAt: 2.35, release: 0.72,
      });
    }

    triggerMetabolicWhisper(event) {
      const kind = event.kind > 0.5 ? 'growth' : event.kind < -0.5 ? 'decay' : 'transfer';
      const base = kind === 'growth' ? 44.6 : kind === 'decay' ? 49.8 : 39.7;
      const direction = kind === 'growth' ? 1.045 : kind === 'decay' ? 0.91 : 0.98;
      this.createEventPair({
        kind: 'metabolism', duration: 2.8,
        pan: clamp(event.x || 0, -0.30, 0.30),
        lowFrom: base, lowTo: base * direction,
        upperFrom: base * 2.21,
        upperTo: base * (kind === 'growth' ? 2.37 : 2.13),
        lowLevel: 0.0046, upperLevel: 0.0011,
        attack: 0.62, releaseAt: 1.18, release: 0.55,
      });
    }

    maybeTriggerMetabolism(events, now) {
      if (!Array.isArray(events) || now - this.lastMetabolismAt < 4400) return;
      const candidate = events.find((event) => {
        if (!event || !Number.isFinite(event.startedAt) || !event.duration) return false;
        const key = `${event.kind}:${event.startedAt}`;
        if (this.seenMetabolism.has(key)) return false;
        const progress = (now - event.startedAt) / event.duration;
        return progress >= 0.46 && progress <= 0.72;
      });
      if (!candidate) return;
      this.seenMetabolism.add(`${candidate.kind}:${candidate.startedAt}`);
      this.lastMetabolismAt = now;
      this.triggerMetabolicWhisper(candidate);
      if (this.seenMetabolism.size > 36) this.seenMetabolism.clear();
    }

    async ensureAudio() {
      if (!this.supported) return false;
      if (!this.context) {
        try {
          this.context = new AudioContextClass({ latencyHint: 'interactive' });
        } catch (error) {
          this.context = new AudioContextClass();
        }
        this.buildGraph();
      }
      if (this.context.state !== 'running') {
        let resumeTimeout = 0;
        try {
          await Promise.race([
            this.context.resume(),
            new Promise((resolve) => {
              resumeTimeout = window.setTimeout(resolve, 900);
            }),
          ]);
        } catch (error) {
          this.activated = false;
          return false;
        } finally {
          window.clearTimeout(resumeTimeout);
        }
      }
      this.activated = this.context.state === 'running';
      return this.activated;
    }

    async setEnabled(enabled, persist = true) {
      if (!this.supported) return false;
      const operation = ++this.operationSerial;
      this.enabled = Boolean(enabled);
      if (persist) savePreference(this.enabled);
      window.clearTimeout(this.suspendTimer);

      if (this.enabled) {
        this.setUiState('starting');
        const didStart = await this.ensureAudio();
        if (operation !== this.operationSerial || !this.enabled) return false;
        if (!didStart) {
          this.setUiState('armed');
          return false;
        }
        const now = this.context.currentTime;
        this.nodes.master.gain.cancelScheduledValues(now);
        this.nodes.master.gain.setValueAtTime(this.nodes.master.gain.value, now);
        this.nodes.master.gain.setTargetAtTime(0.52, now, 0.12);
        this.triggerEnableCue();
        this.setUiState('on');
        return true;
      }

      this.setUiState('off');
      if (!this.context || !this.nodes) return true;
      const now = this.context.currentTime;
      this.nodes.master.gain.cancelScheduledValues(now);
      this.nodes.master.gain.setValueAtTime(this.nodes.master.gain.value, now);
      this.nodes.master.gain.setTargetAtTime(0, now, 0.18);
      this.suspendTimer = window.setTimeout(() => {
        if (!this.enabled && this.context && this.context.state === 'running') {
          this.context.suspend().catch(() => {});
        }
      }, 900);
      return true;
    }

    async handleToggle(event) {
      event.preventDefault();
      event.stopPropagation();
      if (this.toggle.dataset.soundState === 'starting') return;
      if (this.enabled && !this.activated) await this.setEnabled(true, false);
      else await this.setEnabled(!this.enabled);
    }

    async handleGesture(event) {
      if (!this.enabled || this.activated) return;
      if (this.toggle.dataset.soundState === 'starting') return;
      if (
        (this.toggle && this.toggle.contains(event.target))
        || this.mirrorControls.some((control) => control.toggle.contains(event.target))
      ) return;
      await this.setEnabled(true, false);
    }

    async handleKeydown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (this.toggle.dataset.soundState === 'starting') return;
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (key !== 'm') {
        if (this.enabled && !this.activated && !event.repeat) {
          await this.setEnabled(true, false);
        }
        return;
      }
      event.preventDefault();
      if (this.enabled && !this.activated) await this.setEnabled(true, false);
      else await this.setEnabled(!this.enabled);
    }

    handleVisibility() {
      if (!this.context || !this.nodes) return;
      window.clearTimeout(this.visibilityTimer);
      if (document.hidden) {
        const now = this.context.currentTime;
        this.nodes.master.gain.cancelScheduledValues(now);
        this.nodes.master.gain.setTargetAtTime(0, now, 0.10);
        this.visibilityTimer = window.setTimeout(() => {
          if (document.hidden && this.context && this.context.state === 'running') {
            this.context.suspend().catch(() => {});
          }
        }, 520);
      } else if (this.enabled) {
        this.ensureAudio().then((didStart) => {
          if (!didStart || !this.nodes || !this.enabled || document.hidden) return;
          const now = this.context.currentTime;
          this.nodes.master.gain.setTargetAtTime(0.52, now, 0.38);
          this.setUiState('on');
        });
      }
    }

    setUiState(state) {
      if (!this.toggle) return;
      const previousState = this.toggle.dataset.soundState;
      const visiblyOn = state === 'on' || state === 'starting' || state === 'armed';
      const label = visiblyOn
        ? state === 'armed' ? '轻触开启声音' : state === 'starting' ? '正在唤醒声音' : '关闭声音'
        : state === 'unsupported' ? '当前浏览器不支持声音' : '开启声音';

      this.toggle.dataset.soundState = state;
      this.toggle.classList.toggle('is-on', visiblyOn);
      this.toggle.setAttribute('aria-pressed', String(visiblyOn));
      this.toggle.setAttribute('aria-busy', String(state === 'starting'));
      this.toggle.setAttribute('aria-label', label);
      this.toggle.title = label;
      if (this.icon) {
        this.icon.src = visiblyOn ? 'assets/tabler-volume.svg' : 'assets/tabler-volume-off.svg';
      }
      if (this.status) {
        this.status.textContent = state === 'on'
          ? '声音已开启'
          : state === 'armed' ? '声音等待触碰开启' : '声音已关闭';
      }
      if (this.prompt) {
        if (state === 'armed' || state === 'starting') {
          window.clearTimeout(this.promptTimer);
          this.prompt.textContent = state === 'armed' ? '轻触开启声音' : '正在唤醒声音';
          this.prompt.classList.toggle('is-visible', true);
        } else if (state === 'on' && previousState !== 'on') {
          window.clearTimeout(this.promptTimer);
          this.prompt.textContent = '声音已开启';
          this.prompt.classList.toggle('is-visible', true);
          this.promptTimer = window.setTimeout(() => {
            if (this.prompt) this.prompt.classList.toggle('is-visible', false);
          }, 1500);
        } else if (state !== 'on') {
          window.clearTimeout(this.promptTimer);
          this.prompt.classList.toggle('is-visible', false);
        }
      }
      this.mirrorControls.forEach((control) => {
        this.syncMirrorControl(control.toggle, control.status, state);
      });
    }

    updateEventTelemetry(now) {
      this.activeEvents = this.activeEvents.filter((event) => now - event.startedAt < event.durationMs);
      let pressure = 0;
      let resonance = 0;
      this.activeEvents.forEach((event) => {
        const progress = clamp((now - event.startedAt) / event.durationMs, 0, 1);
        const envelope = smoothstep(0, 0.22, progress) * (1 - smoothstep(0.56, 1, progress));
        const level = event.peak * envelope;
        if (event.kind === 'pressure') pressure += level;
        else resonance += level;
      });
      this.telemetry.pressure = pressure;
      this.telemetry.resonance = resonance;
      this.telemetry.events = this.activeEvents.length;
    }

    update(state) {
      if (!this.enabled || !this.activated || !this.context || !this.nodes) return;
      if (this.context.state !== 'running') return;
      if (!this.sceneActive || this.profile !== 'home') return;
      const now = performance.now();
      if (now - this.lastControlAt < 42) return;
      this.lastControlAt = now;

      const pointer = state.pointer || {};
      const presence = state.presence || {};
      const encounter = state.encounter || {};
      const phase = encounter.phase || state.phase || 'opening';
      const audioNow = this.context.currentTime;
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const pan = clamp(((pointer.x || width / 2) / width) * 2 - 1, -0.45, 0.45);
      const vertical = clamp((pointer.y || height / 2) / height, 0, 1);
      const speed = Math.max(0, pointer.speed || 0);
      const speedAmount = 1 - Math.exp(-speed / 520);
      const disturbance = clamp(pointer.disturbance || 0, 0, 1);
      const movingPhase = phase === 'contact' || phase === 'near'
        || phase === 'noticed' || phase === 'aligned';
      const movement = movingPhase ? clamp(speedAmount * 0.72 + disturbance * 0.28, 0, 1) : 0;
      const focus = clamp(
        (presence.approach || 0) * 0.55 + (encounter.hold || 0) * 0.45,
        0,
        1
      );
      const entry = clamp(encounter.entry || 0, 0, 1);
      const boundarySilence = clamp(encounter.boundarySilence || 0, 0, 1);
      const baseFrequency = 43.5 + movement * 13.5 + (0.5 - vertical) * 3.2;
      const presenceWave = 0;
      const presenceLevel = 0;

      this.glide(
        this.nodes.presenceLow.frequency,
        43.8 + Math.sin(now * 0.00031) * 1.7 + Math.sin(now * 0.00011) * 0.6,
        audioNow,
        0.72
      );
      this.glide(
        this.nodes.presenceUpper.frequency,
        99.3 + Math.sin(now * 0.00023 + 0.8) * 3.1,
        audioNow,
        0.82
      );
      this.glide(this.nodes.presenceFilter.frequency, 136 + presenceWave * 24, audioNow, 0.66);

      this.glide(this.nodes.movementLow.frequency, baseFrequency, audioNow, 0.11);
      this.glide(
        this.nodes.movementHarmonic.frequency,
        baseFrequency * (2.23 + pan * 0.08),
        audioNow,
        0.16
      );
      this.glide(this.nodes.movementColor.frequency, baseFrequency * 1.57, audioNow, 0.14);
      this.glide(this.nodes.movementFilter.frequency, 155 + movement * 92, audioNow, 0.13);
      this.glide(this.nodes.movementPanner.pan, pan * (1 - focus * 0.82), audioNow, 0.10);
      this.glide(
        this.nodes.movementGain.gain,
        movement * (0.008 + speedAmount * 0.013) * (1 - focus * 0.48),
        audioNow,
        movement > 0.08 ? 0.10 : 0.72
      );

      if (encounter.noticeSerial > this.lastNoticeSerial) {
        this.lastNoticeSerial = encounter.noticeSerial;
        this.triggerNotice(1);
      }

      const inOuterField = Boolean(encounter.outerDwell > 0 || phase === 'near');
      if (inOuterField) {
        if (!this.hoverEnteredAt) this.hoverEnteredAt = now;
        if (!this.hoverTriggered && now - this.hoverEnteredAt >= 820) {
          this.hoverTriggered = true;
          this.triggerHoverResonance(pan);
        }
      } else {
        this.hoverEnteredAt = 0;
        this.hoverTriggered = false;
      }

      if (phase === 'entering' && !this.diveTriggered) {
        this.diveTriggered = true;
        this.triggerDive();
      }

      const ducked = now < this.duckUntil;
      const audiblePresence = presenceLevel * (ducked ? 0.22 : 1);
      this.glide(
        this.nodes.presenceGain.gain,
        audiblePresence,
        audioNow,
        ducked ? 0.08 : 0.58
      );
      this.glide(this.nodes.movementBus.gain, ducked ? 0.24 : 1, audioNow, ducked ? 0.08 : 0.72);
      this.glide(
        this.nodes.focusFilter.frequency,
        phase === 'handoff' ? 72 : 680 - focus * 430 - entry * 170,
        audioNow,
        entry > 0 ? 0.12 : 0.34
      );
      this.glide(this.nodes.focusFilter.Q, 0.38 + focus * 0.72, audioNow, 0.24);

      const boundaryActive = boundarySilence > 0.18;
      const sceneLevel = phase === 'handoff' ? 0 : boundaryActive ? 0.006 : 1;
      this.glide(
        this.nodes.sceneBus.gain,
        sceneLevel,
        audioNow,
        boundaryActive ? 0.022 : 0.12
      );
      this.lastPhase = phase;
      this.telemetry.presence = audiblePresence;
      this.telemetry.movement = movement;
      this.telemetry.focus = focus;
      this.telemetry.entry = entry;
      this.telemetry.silence = boundarySilence;
      this.updateEventTelemetry(now);

      this.telemetryFrame += 1;
      if (this.telemetryFrame % 8 === 0) this.updateTelemetry();
    }

    updatePlant(state = {}) {
      if (!this.enabled || !this.activated || !this.context || !this.nodes) return;
      if (this.context.state !== 'running' || !this.sceneActive || this.profile !== 'plant') return;
      const now = performance.now();
      if (now - this.lastControlAt < 42) return;
      this.lastControlAt = now;

      const pointer = state.pointer || {};
      const interaction = state.interaction || {};
      const speed = Math.max(0, pointer.speed || 0);
      const movement = clamp(1 - Math.exp(-speed / 460), 0, 1);
      const hover = clamp(interaction.hover || 0, 0, 1);
      const pan = clamp(
        ((pointer.x || window.innerWidth / 2) / Math.max(1, window.innerWidth)) * 2 - 1,
        -0.42,
        0.42
      );
      const audioNow = this.context.currentTime;
      const baseFrequency = 51 + movement * 17 + hover * 4;

      this.glide(this.nodes.presenceGain.gain, 0, audioNow, 0.12);
      this.glide(this.nodes.movementLow.frequency, baseFrequency, audioNow, 0.11);
      this.glide(this.nodes.movementHarmonic.frequency, baseFrequency * 2.08, audioNow, 0.15);
      this.glide(this.nodes.movementColor.frequency, baseFrequency * 1.43, audioNow, 0.14);
      this.glide(this.nodes.movementFilter.frequency, 125 + movement * 120 + hover * 55, audioNow, 0.16);
      this.glide(this.nodes.movementPanner.pan, pan * 0.62, audioNow, 0.12);
      this.glide(
        this.nodes.movementGain.gain,
        movement * (0.006 + movement * 0.012) * (1 + hover * 0.16),
        audioNow,
        movement > 0.06 ? 0.11 : 0.64
      );
      this.glide(this.nodes.focusFilter.frequency, 410 - hover * 135, audioNow, 0.28);

      if (interaction.hovering) {
        if (!this.plantHoverEnteredAt) this.plantHoverEnteredAt = now;
        if (!this.plantHoverTriggered && now - this.plantHoverEnteredAt >= 620) {
          this.plantHoverTriggered = true;
          this.createEventPair({
            kind: 'plant-hover', duration: 2.3, pan: pan * 0.34,
            lowFrom: 58, lowTo: 54,
            upperFrom: 121, upperTo: 132,
            lowLevel: 0.0072, upperLevel: 0.0018,
            attack: 0.48, releaseAt: 0.96, release: 0.52,
          });
        }
      } else {
        this.plantHoverEnteredAt = 0;
        this.plantHoverTriggered = false;
      }

      this.telemetry.presence = 0;
      this.telemetry.movement = movement;
      this.telemetry.focus = hover;
      this.updateEventTelemetry(now);
      this.telemetryFrame += 1;
      if (this.telemetryFrame % 8 === 0) this.updateTelemetry();
    }

    triggerPlantPulse(kind = 'signal', strength = 0.7, pan = 0) {
      if (this.profile !== 'plant') return;
      const amount = clamp(strength, 0.25, 1);
      const root = kind === 'root';
      const flow = kind === 'flow';
      this.createEventPair({
        kind: `plant-${kind}`,
        duration: 1.55,
        pan: clamp(pan, -0.42, 0.42),
        lowFrom: root ? 54 : flow ? 66 : 74,
        lowTo: root ? 47 : flow ? 82 : 96,
        upperFrom: root ? 108 : flow ? 136 : 151,
        upperTo: root ? 96 : flow ? 166 : 188,
        lowLevel: 0.0085 * amount,
        upperLevel: 0.0022 * amount,
        attack: 0.07,
        releaseAt: 0.32,
        release: 0.34,
      });
    }

    updateTelemetry() {
      if (!this.nodes || !this.levelData || !this.toggle) return;
      this.nodes.analyser.getFloatTimeDomainData(this.levelData);
      let sum = 0;
      for (let index = 0; index < this.levelData.length; index += 1) {
        sum += this.levelData[index] * this.levelData[index];
      }
      const rms = Math.sqrt(sum / this.levelData.length);
      this.telemetry.level = rms;
      this.toggle.dataset.soundLevel = rms.toFixed(4);
      this.toggle.dataset.presenceLevel = this.telemetry.presence.toFixed(4);
      this.toggle.dataset.pressureLevel = this.telemetry.pressure.toFixed(4);
      this.toggle.dataset.movementLevel = this.telemetry.movement.toFixed(3);
      this.toggle.dataset.resonanceLevel = this.telemetry.resonance.toFixed(4);
      this.toggle.dataset.focusLevel = this.telemetry.focus.toFixed(3);
      this.toggle.dataset.entryLevel = this.telemetry.entry.toFixed(3);
      this.toggle.dataset.silenceLevel = this.telemetry.silence.toFixed(3);
      const visibleLevel = clamp(rms * 26, 0, 1);
      this.toggle.style.setProperty('--sound-glow', `${8 + visibleLevel * 13}px`);
      this.toggle.style.setProperty('--sound-glow-alpha', (0.015 + visibleLevel * 0.035).toFixed(3));
    }

    getState() {
      return {
        supported: this.supported,
        enabled: this.enabled,
        activated: this.activated,
        contextState: this.context ? this.context.state : 'uninitialized',
        uiState: this.toggle ? this.toggle.dataset.soundState : 'missing',
        architecture: 'interaction-led-shared-bus',
        profile: this.profile,
        sceneActive: this.sceneActive,
        telemetry: { ...this.telemetry },
      };
    }

    destroy() {
      window.clearTimeout(this.suspendTimer);
      window.clearTimeout(this.visibilityTimer);
      window.clearTimeout(this.promptTimer);
      this.timers.forEach((timer) => window.clearTimeout(timer));
      this.timers.clear();
      if (this.toggle) this.toggle.removeEventListener('click', this.handleToggle);
      this.mirrorControls.forEach((control) => {
        control.toggle.removeEventListener('click', control.click);
      });
      this.mirrorControls = [];
      document.removeEventListener('keydown', this.handleKeydown);
      document.removeEventListener('pointerdown', this.handleGesture, { capture: true });
      document.removeEventListener('visibilitychange', this.handleVisibility);
      if (this.context && this.context.state !== 'closed') {
        this.context.close().catch(() => {});
      }
    }
  }

  window.LivingSoundscape = LivingSoundscape;
})();
