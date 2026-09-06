(() => {
  "use strict";

  class PlanetNeuronSound {
    constructor() {
      this.context = null;
      this.master = null;
      this.enabled = false;
      this.pointerEnergy = 0;
    }

    async enable() {
      if (!this.context) this.build();
      await this.context.resume();
      this.enabled = true;
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(0.16, this.context.currentTime, 0.8);
    }

    disable() {
      if (!this.context) return;
      this.enabled = false;
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.28);
    }

    build() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      const now = this.context.currentTime;

      this.master = this.context.createGain();
      this.master.gain.setValueAtTime(0.0001, now);
      this.master.connect(this.context.destination);

      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.03;
      this.compressor.release.value = 0.5;
      this.compressor.connect(this.master);

      this.ambientGain = this.context.createGain();
      this.ambientGain.gain.value = 0.23;
      this.ambientGain.connect(this.compressor);

      [34.2, 51.7].forEach((frequency, index) => {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = index === 0 ? "sine" : "triangle";
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index ? -11 : 7;
        gain.gain.value = index ? 0.022 : 0.05;
        oscillator.connect(gain).connect(this.ambientGain);
        oscillator.start();
      });

      const bufferSize = this.context.sampleRate * 3;
      const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      let drift = 0;
      for (let i = 0; i < data.length; i += 1) {
        drift = drift * 0.996 + (Math.random() * 2 - 1) * 0.004;
        data[i] = (Math.random() * 2 - 1) * 0.13 + drift;
      }
      const noise = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      this.contactGain = this.context.createGain();
      noise.buffer = buffer;
      noise.loop = true;
      filter.type = "bandpass";
      filter.frequency.value = 170;
      filter.Q.value = 0.7;
      this.contactFilter = filter;
      this.contactGain.gain.value = 0.015;
      noise.connect(filter).connect(this.contactGain).connect(this.compressor);
      noise.start();
    }

    setPointerEnergy(value) {
      this.pointerEnergy = value;
      if (!this.context || !this.enabled) return;
      const now = this.context.currentTime;
      this.contactGain.gain.setTargetAtTime(0.012 + value * 0.075, now, 0.12);
      this.contactFilter.frequency.setTargetAtTime(150 + value * 780, now, 0.15);
      this.contactFilter.Q.setTargetAtTime(0.7 + value * 2.8, now, 0.18);
    }

    triggerSignal() {
      if (!this.context || !this.enabled) return;
      const now = this.context.currentTime;
      this.createImpact(now);

      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const panner = this.context.createStereoPanner();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(142, now + 0.15);
      oscillator.frequency.exponentialRampToValueAtTime(42, now + 4.55);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.65);
      panner.pan.setValueAtTime(-0.15, now);
      panner.pan.linearRampToValueAtTime(0.82, now + 4.55);
      oscillator.connect(gain).connect(panner).connect(this.compressor);
      oscillator.start(now);
      oscillator.stop(now + 4.75);
    }

    createImpact(now) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(62, now);
      oscillator.frequency.exponentialRampToValueAtTime(29, now + 0.62);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.19, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      oscillator.connect(gain).connect(this.compressor);
      oscillator.start(now);
      oscillator.stop(now + 0.74);
    }

    reveal() {
      if (!this.context || !this.enabled) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 27.5;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(68, now);
      filter.frequency.exponentialRampToValueAtTime(190, now + 3.8);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 2.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0);
      oscillator.connect(filter).connect(gain).connect(this.compressor);
      oscillator.start(now);
      oscillator.stop(now + 5.1);
    }

    remoteResponse(kind, pan) {
      if (!this.context || !this.enabled) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const overtone = this.context.createOscillator();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      const overtoneGain = this.context.createGain();
      const panner = this.context.createStereoPanner();

      const isBurst = kind === "burst";
      oscillator.type = isBurst ? "triangle" : "sine";
      overtone.type = "sine";
      oscillator.frequency.setValueAtTime(isBurst ? 118 : 54, now);
      oscillator.frequency.exponentialRampToValueAtTime(isBurst ? 39 : 27, now + 1.45);
      overtone.frequency.setValueAtTime(isBurst ? 236 : 81, now);
      overtone.frequency.exponentialRampToValueAtTime(isBurst ? 63 : 34, now + 1.1);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(isBurst ? 420 : 150, now);
      filter.frequency.exponentialRampToValueAtTime(74, now + 1.5);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(isBurst ? 0.075 : 0.04, now + 0.055);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
      overtoneGain.gain.setValueAtTime(0.0001, now);
      overtoneGain.gain.exponentialRampToValueAtTime(isBurst ? 0.018 : 0.009, now + 0.04);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
      panner.pan.value = Math.max(-0.9, Math.min(0.9, pan));
      oscillator.connect(filter);
      overtone.connect(overtoneGain).connect(filter);
      filter.connect(gain).connect(panner).connect(this.compressor);
      oscillator.start(now);
      overtone.start(now);
      oscillator.stop(now + 1.6);
      overtone.stop(now + 1.1);
    }

    ambientEvent(kind, x) {
      if (!this.context || !this.enabled) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const panner = this.context.createStereoPanner();
      oscillator.type = kind === "burst" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(kind === "burst" ? 176 : 92, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "burst" ? 44 : 31, now + 0.9);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === "burst" ? 0.05 : 0.025, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
      panner.pan.value = Math.max(-0.8, Math.min(0.8, x * 2 - 1));
      oscillator.connect(gain).connect(panner).connect(this.compressor);
      oscillator.start(now);
      oscillator.stop(now + 1.1);
    }

    setScaleMotion(energy, direction = 1) {
      if (!this.context || !this.enabled) return;
      const now = this.context.currentTime;
      const amount = Math.max(0, Math.min(1, energy));
      this.contactGain.gain.setTargetAtTime(0.014 + amount * 0.052, now, 0.18);
      this.contactFilter.frequency.setTargetAtTime(
        direction >= 0 ? 180 + amount * 520 : 520 - amount * 330,
        now,
        0.22
      );
    }

    scaleCrossing(direction = 1) {
      if (!this.context || !this.enabled) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(direction >= 0 ? 82 : 51, now);
      oscillator.frequency.exponentialRampToValueAtTime(direction >= 0 ? 31 : 96, now + 1.15);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(240, now);
      filter.frequency.exponentialRampToValueAtTime(68, now + 1.2);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
      oscillator.connect(filter).connect(gain).connect(this.compressor);
      oscillator.start(now);
      oscillator.stop(now + 1.3);
    }

    async setVisible(visible) {
      if (!this.context || !this.enabled) return;
      if (visible) await this.context.resume();
      else await this.context.suspend();
    }
  }

  window.PlanetNeuronSound = PlanetNeuronSound;
})();
