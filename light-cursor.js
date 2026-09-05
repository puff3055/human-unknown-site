(() => {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function smoothstep(edge0, edge1, value) {
    const progress = clamp(
      (value - edge0) / Math.max(0.0001, edge1 - edge0),
      0,
      1
    );
    return progress * progress * (3 - 2 * progress);
  }

  function damp(current, target, rate, deltaSeconds) {
    return current + (target - current) * (1 - Math.exp(-rate * deltaSeconds));
  }

  class LightCursor {
    constructor(element, options = {}) {
      this.element = element;
      this.reducedMotion = Boolean(options.reducedMotion);
      this.hoverTarget = 'none';
      this.pressed = false;
      this.focus = 0;
      this.press = 0;
      this.trailX = 0;
      this.trailY = 0;
      this.rotation = -8;
      this.orbitRotation = 14;
      this.mode = 'cloud';
      this.target = 'none';
      this.absorption = 0;
      this.speed = 0;

      this.element.dataset.mode = this.mode;
      this.element.dataset.target = this.target;
      this.element.dataset.moving = 'false';
      this.element.dataset.pressed = 'false';
    }

    moveTo(x, y) {
      this.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    setHoverTarget(target) {
      this.hoverTarget = target === 'sound' ? 'sound' : 'none';
    }

    setPressed(pressed) {
      this.pressed = Boolean(pressed);
      this.element.dataset.pressed = String(this.pressed);
    }

    update(deltaSeconds, input = {}) {
      const delta = clamp(deltaSeconds, 0.001, 0.05);
      const pointer = input.pointer || {};
      const phase = input.phase || 'opening';
      const entering = phase === 'entering' || phase === 'handoff';
      const centralTarget = Boolean(input.centralTarget);

      this.target = entering || centralTarget
        ? 'pupil'
        : this.hoverTarget;

      const focusTarget = this.target === 'none' ? 0 : 1;
      this.focus = this.reducedMotion
        ? focusTarget
        : damp(this.focus, focusTarget, focusTarget ? 15 : 5.4, delta);
      this.press = this.reducedMotion
        ? Number(this.pressed)
        : damp(this.press, Number(this.pressed), this.pressed ? 28 : 10, delta);

      const velocityX = Number(pointer.velocityX) || 0;
      const velocityY = Number(pointer.velocityY) || 0;
      const velocityMagnitude = Math.hypot(velocityX, velocityY);
      this.speed = this.reducedMotion
        ? 0
        : clamp(velocityMagnitude / 1050, 0, 1);
      this.absorption = entering ? clamp(Number(input.entry) || 0, 0, 1) : 0;

      const focusBlend = smoothstep(0.08, 0.88, this.focus);
      const lagWeight = (1 - focusBlend * 0.76) * (1 - this.absorption * 0.82);
      const targetTrailX = clamp(-velocityX * 0.0065, -8.5, 8.5) * lagWeight;
      const targetTrailY = clamp(-velocityY * 0.0065, -8.5, 8.5) * lagWeight;
      const trailRate = velocityMagnitude > 36 ? 15 : 5.8;
      this.trailX = this.reducedMotion
        ? 0
        : damp(this.trailX, targetTrailX, trailRate, delta);
      this.trailY = this.reducedMotion
        ? 0
        : damp(this.trailY, targetTrailY, trailRate, delta);

      if (!this.reducedMotion) {
        this.rotation = (this.rotation + delta * (4.2 + this.speed * 29)) % 360;
        this.orbitRotation = (
          this.orbitRotation - delta * (10.5 + this.speed * 42)
        ) % 360;
      }

      const pointerX = Number(pointer.x) || 0;
      const pointerY = Number(pointer.y) || 0;
      const pupilX = Number.isFinite(input.pupilX) ? input.pupilX : pointerX;
      const pupilY = Number.isFinite(input.pupilY) ? input.pupilY : pointerY;
      const pullDeltaX = pupilX - pointerX;
      const pullDeltaY = pupilY - pointerY;
      const pullDistance = Math.hypot(pullDeltaX, pullDeltaY);
      const pullProgress = entering
        ? smoothstep(0.08, 0.82, this.absorption)
        : 0;
      const pullX = pullDeltaX * pullProgress;
      const pullY = pullDeltaY * pullProgress;
      const pullAngle = entering && pullDistance > 0.5
        ? Math.atan2(pullDeltaY, pullDeltaX) * 180 / Math.PI
        : 0;
      const stretch = 1 + Math.min(0.44, pullDistance / 170) * pullProgress;
      const collapse = 1 - smoothstep(0.22, 0.94, this.absorption) * 0.78;
      const absorptionOpacity = entering
        ? 1 - smoothstep(0.18, 0.88, this.absorption)
        : 1;
      const cloudOpacity = (
        1 - smoothstep(0.10, 0.72, this.focus)
      ) * absorptionOpacity;
      const pointOpacity = (
        0.14 + smoothstep(0.18, 0.80, this.focus) * 0.86
      ) * absorptionOpacity;
      const cloudScale = (
        1 - focusBlend * 0.50
      ) * (1 + this.speed * 0.08) * (1 - this.absorption * 0.30);
      const pointScale = (
        0.68 + focusBlend * 0.32
      ) * (1 - this.press * 0.16) * (1 - this.absorption * 0.56);

      this.mode = entering
        ? 'absorbing'
        : this.focus >= 0.72
          ? 'point'
          : this.focus <= 0.18
            ? 'cloud'
            : 'condensing';

      this.element.dataset.mode = this.mode;
      this.element.dataset.target = this.target;
      this.element.dataset.moving = String(this.speed > 0.055);
      this.element.style.setProperty(
        '--cursor-opacity',
        absorptionOpacity.toFixed(4)
      );
      this.element.style.setProperty(
        '--cursor-cloud-opacity',
        cloudOpacity.toFixed(4)
      );
      this.element.style.setProperty(
        '--cursor-cloud-veil-opacity',
        (cloudOpacity * 0.34).toFixed(4)
      );
      this.element.style.setProperty(
        '--cursor-point-opacity',
        pointOpacity.toFixed(4)
      );
      this.element.style.setProperty(
        '--cursor-point-halo-opacity',
        (pointOpacity * (0.24 + focusBlend * 0.10 + this.press * 0.20)).toFixed(4)
      );
      this.element.style.setProperty('--cursor-trail-x', `${this.trailX.toFixed(2)}px`);
      this.element.style.setProperty('--cursor-trail-y', `${this.trailY.toFixed(2)}px`);
      this.element.style.setProperty(
        '--cursor-trail-wide-x',
        `${(this.trailX * 1.42).toFixed(2)}px`
      );
      this.element.style.setProperty(
        '--cursor-trail-wide-y',
        `${(this.trailY * 1.42).toFixed(2)}px`
      );
      this.element.style.setProperty(
        '--cursor-cloud-rotation',
        `${this.rotation.toFixed(2)}deg`
      );
      this.element.style.setProperty(
        '--cursor-cloud-veil-rotation',
        `${(-this.rotation * 0.58 - 17).toFixed(2)}deg`
      );
      this.element.style.setProperty(
        '--cursor-orbit-rotation',
        `${this.orbitRotation.toFixed(2)}deg`
      );
      this.element.style.setProperty(
        '--cursor-orbit-halo-rotation',
        `${(-this.orbitRotation * 0.62).toFixed(2)}deg`
      );
      this.element.style.setProperty('--cursor-cloud-scale', cloudScale.toFixed(4));
      this.element.style.setProperty('--cursor-point-scale', pointScale.toFixed(4));
      this.element.style.setProperty('--cursor-pull-x', `${pullX.toFixed(2)}px`);
      this.element.style.setProperty('--cursor-pull-y', `${pullY.toFixed(2)}px`);
      this.element.style.setProperty('--cursor-pull-angle', `${pullAngle.toFixed(2)}deg`);
      this.element.style.setProperty('--cursor-stretch', stretch.toFixed(4));
      this.element.style.setProperty('--cursor-collapse', collapse.toFixed(4));
    }

    getState() {
      return {
        mode: this.mode,
        target: this.target,
        focus: this.focus,
        pressed: this.pressed,
        speed: this.speed,
        absorption: this.absorption,
        reducedMotion: this.reducedMotion,
      };
    }

    destroy() {
      this.setPressed(false);
      this.setHoverTarget('none');
    }
  }

  window.HumanUnknownLightCursor = LightCursor;
})();
