(() => {
  'use strict';

  class WorldOneSoundscape {
    constructor() {
      this.enabled = false;
      this.active = false;
      this.paused = false;
      this.scene = 1;
      this.engine = null;
      this.toggle = document.getElementById('worldSoundToggle');
      this.status = document.getElementById('worldSoundStatus');
      this.soundReady = () => this.bindEngine();
      window.addEventListener('humanunknown:soundready', this.soundReady);
      this.bindEngine();
    }

    bindEngine() {
      const engine = window.__humanUnknownSound;
      if (!engine || this.engine === engine) return;
      this.engine = engine;
      this.engine.registerMirror(this.toggle, this.status);
      if (this.active) {
        this.engine.setProfile('plant');
        this.engine.setSceneActive(!this.paused);
      }
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      this.bindEngine();
      if (!this.engine) return Promise.resolve(false);
      if (this.engine.enabled === this.enabled) return Promise.resolve(this.engine.activated);
      return this.engine.setEnabled(this.enabled);
    }

    setActive(active) {
      this.active = Boolean(active);
      this.bindEngine();
      if (!this.engine) return;
      if (this.active) this.engine.setProfile('plant');
      this.engine.setSceneActive(this.active && !this.paused);
    }

    setPaused(paused) {
      this.paused = Boolean(paused);
      this.bindEngine();
      if (this.engine) this.engine.setSceneActive(this.active && !this.paused);
    }

    setScene(scene) {
      this.scene = Math.min(6, Math.max(1, Number(scene) || 1));
    }

    update(state = {}) {
      this.bindEngine();
      if (!this.engine || !this.active || this.paused) return;
      this.engine.updatePlant(state);
    }

    pulse(kind = 'signal', strength = 0.7, pan = 0) {
      this.bindEngine();
      if (!this.engine || !this.active || this.paused) return;
      this.engine.triggerPlantPulse(kind, strength, pan);
    }

    getState() {
      const shared = this.engine ? this.engine.getState() : null;
      return {
        supported: Boolean(shared?.supported),
        enabled: Boolean(shared?.enabled),
        active: this.active,
        paused: this.paused,
        scene: this.scene,
        contextState: shared?.contextState || 'uninitialized',
        architecture: 'interaction-led-shared-bus',
        profile: shared?.profile || 'plant',
        telemetry: shared?.telemetry || null,
      };
    }

    destroy() {
      window.removeEventListener('humanunknown:soundready', this.soundReady);
      this.engine = null;
    }
  }

  window.WorldOneSoundscape = WorldOneSoundscape;
})();
