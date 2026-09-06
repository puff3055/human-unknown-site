(() => {
  'use strict';

  const root = document.getElementById('worldOne');
  const canvas = document.getElementById('greenBodyLivingCanvas');
  if (!root || !canvas) return;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const VERTEX = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * .5 + .5;
      gl_Position = vec4(aPosition, 0., 1.);
    }
  `;

  const FRAGMENT = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform vec2 uImageSize;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uPresence;
    uniform vec4 uWaves[3];
    uniform vec4 uResponses[8];

    float lightness(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }

    float segmentMask(vec2 point, vec2 start, vec2 end, float width) {
      vec2 line = end - start;
      float amount = clamp(dot(point - start, line) / dot(line, line), 0., 1.);
      return 1. - smoothstep(width * .42, width, length(point - (start + line * amount)));
    }

    float ellipseMask(vec2 point, vec2 center, vec2 radius) {
      float distanceToEdge = length((point - center) / radius);
      return 1. - smoothstep(.72, 1., distanceToEdge);
    }

    vec2 coverUv(vec2 uv) {
      float screenAspect = uResolution.x / max(1., uResolution.y);
      float imageAspect = uImageSize.x / max(1., uImageSize.y);
      vec2 visible = vec2(1.);
      if (screenAspect > imageAspect) visible.y = imageAspect / screenAspect;
      else visible.x = screenAspect / imageAspect;
      return vec2(.5) + (uv - vec2(.5)) * visible;
    }

    void main() {
      vec2 imageUv = coverUv(vUv);
      vec2 metric = (vUv - .5) * vec2(uResolution.x / uResolution.y, 1.);
      vec2 pointerMetric = (uPointer - .5) * vec2(uResolution.x / uResolution.y, 1.);
      float slowBreath = sin(uTime * .31) * .5 + .5;
      float rootPulse = sin(uTime * .73 + metric.x * 7.4 - metric.y * 4.1);
      float canopyPulse = sin(uTime * .41 + metric.x * 3.2 + metric.y * 5.6);
      float localDistance = length(metric - pointerMetric);
      float localField = (1. - smoothstep(.03, .27, localDistance)) * uPresence;

      // Spatial organs traced from the visual master. Each one keeps its own clock.
      float canopyLeft = ellipseMask(imageUv, vec2(.43, .82), vec2(.31, .17));
      float canopyHeart = ellipseMask(imageUv, vec2(.70, .76), vec2(.31, .25));
      float canopyRight = ellipseMask(imageUv, vec2(.91, .72), vec2(.17, .22));
      float canopyMask = clamp(canopyLeft + canopyHeart + canopyRight, 0., 1.);
      float mushroomLeft = ellipseMask(imageUv, vec2(.24, .25), vec2(.28, .18));
      float mushroomBridge = ellipseMask(imageUv, vec2(.55, .31), vec2(.23, .13));
      float mushroomRight = ellipseMask(imageUv, vec2(.91, .18), vec2(.16, .18));
      float mushroomMask = clamp(mushroomLeft + mushroomBridge + mushroomRight, 0., 1.);
      float leftTrunk = segmentMask(imageUv, vec2(.20, .98), vec2(.38, .18), .13);
      float heartTrunk = segmentMask(imageUv, vec2(.89, .94), vec2(.72, .18), .12);
      float bridgeRoot = segmentMask(imageUv, vec2(.10, .43), vec2(.88, .13), .085);
      float trunkMask = clamp(leftTrunk + heartTrunk + bridgeRoot, 0., 1.);
      float sporeMask = clamp(
        ellipseMask(imageUv, vec2(.25, .88), vec2(.038, .054)) +
        ellipseMask(imageUv, vec2(.37, .65), vec2(.034, .050)) +
        ellipseMask(imageUv, vec2(.58, .50), vec2(.031, .045)) +
        ellipseMask(imageUv, vec2(.78, .39), vec2(.036, .052)) +
        ellipseMask(imageUv, vec2(.94, .25), vec2(.052, .071)), 0., 1.);
      float canopyClock = (
        canopyLeft * sin(uTime * .27 + .4) +
        canopyHeart * sin(uTime * .35 + 2.1) +
        canopyRight * sin(uTime * .23 + 4.6)
      ) / max(.75, canopyLeft + canopyHeart + canopyRight);
      float trunkClock = (
        leftTrunk * sin(uTime * .46 + 1.3) +
        heartTrunk * sin(uTime * .59 + 3.8) +
        bridgeRoot * sin(uTime * .38 + 5.2)
      ) / max(.72, leftTrunk + heartTrunk + bridgeRoot);
      float mushroomClock = (
        mushroomLeft * sin(uTime * .91 + .7) +
        mushroomBridge * sin(uTime * 1.13 + 2.8) +
        mushroomRight * sin(uTime * .79 + 5.1)
      ) / max(.68, mushroomLeft + mushroomBridge + mushroomRight);
      float canopyBreath = canopyClock * .5 + .5;
      float trunkBreath = trunkClock;
      float responseGlow = 0.;
      float mushroomResponse = 0.;
      float canopyResponse = 0.;
      float trunkResponse = 0.;
      float sporeResponse = 0.;
      for (int i = 0; i < 8; i++) {
        vec4 response = uResponses[i];
        float responseAge = uTime - response.z;
        float responseAlive = step(.5, response.w) * step(0., responseAge) * (1. - smoothstep(2.8, 5.4, responseAge));
        vec2 responseDelta = vUv - response.xy;
        responseDelta.x *= uResolution.x / uResolution.y;
        float responseField = (1. - smoothstep(.025, .19 + responseAge * .018, length(responseDelta))) * responseAlive;
        float responseBeat = .58 + .42 * sin(responseAge * 4.2 - length(responseDelta) * 31.);
        responseField *= responseBeat;
        responseGlow += responseField;
        mushroomResponse += responseField * (1. - step(1.5, response.w));
        canopyResponse += responseField * step(1.5, response.w) * (1. - step(2.5, response.w));
        trunkResponse += responseField * step(2.5, response.w) * (1. - step(3.5, response.w));
        sporeResponse += responseField * step(3.5, response.w);
      }

      // The source plate stays fixed. Only traced organs displace, so the world
      // reads as layered living tissue rather than one photograph drifting as a block.
      vec2 drift = normalize(pointerMetric - metric + vec2(.0001)) * localField * .0085;

      vec2 canopyDrift = vec2(
        canopyClock * .0048 + sin(uTime * .17 + imageUv.y * 4.2) * .0012 + canopyResponse * .0072,
        canopyPulse * .0032 + canopyResponse * .0038
      );
      vec2 trunkDrift = vec2(
        trunkBreath * .0036 + trunkResponse * .0046,
        sin(uTime * .31 + imageUv.x * 4.) * .0015 - trunkResponse * .0027
      );
      vec2 mushroomDrift = vec2(
        mushroomClock * .0018 + mushroomResponse * .0026,
        mushroomClock * .0052 + mushroomResponse * .0110
      );
      vec2 sporeDrift = vec2(
        sin(uTime * .43 + imageUv.y * 8.) * .0058 + sporeResponse * .0062,
        cos(uTime * .31 + imageUv.x * 9.) * .0074 + sporeResponse * .0085
      );
      vec2 rootDrift = vec2(rootPulse * .0024, cos(uTime * .39 + imageUv.x * 7.) * .0009);

      float waveGlow = 0.;
      for (int i = 0; i < 3; i++) {
        vec4 wave = uWaves[i];
        float age = max(0., uTime - wave.z);
        float alive = step(.001, wave.w) * (1. - smoothstep(.72, 1.65, age));
        vec2 origin = (wave.xy - .5) * vec2(uResolution.x / uResolution.y, 1.);
        vec2 delta = metric - origin;
        float radius = age * .095;
        float ring = 1. - smoothstep(.014, .045, abs(length(delta) - radius));
        float branch = .52 + .48 * sin(atan(delta.y, delta.x) * 9. + length(delta) * 57. - uTime * 1.9);
        ring *= smoothstep(.34, .82, branch) * alive;
        drift -= normalize(delta + vec2(.0001)) * ring * .0012;
        waveGlow += ring;
      }

      vec2 sourceUv = clamp(coverUv(vUv - drift), vec2(.001), vec2(.999));
      vec3 sourceBase = texture2D(uTexture, sourceUv).rgb;
      vec2 texel = 1. / uImageSize;
      vec3 soft = (
        texture2D(uTexture, sourceUv + vec2(texel.x * 2., 0.)).rgb +
        texture2D(uTexture, sourceUv - vec2(texel.x * 2., 0.)).rgb +
        texture2D(uTexture, sourceUv + vec2(0., texel.y * 2.)).rgb +
        texture2D(uTexture, sourceUv - vec2(0., texel.y * 2.)).rgb
      ) * .25;
      float baseRidge = max(lightness(sourceBase) - lightness(soft), 0.);
      float brightStructure = smoothstep(.018, .22, lightness(soft) + baseRidge * 3.2);
      float canopyCut = canopyMask * smoothstep(.02, .30, lightness(soft) + baseRidge * 3.8);
      float trunkCut = trunkMask * smoothstep(.012, .25, lightness(soft) + baseRidge * 2.5);
      float mushroomCut = mushroomMask * smoothstep(.055, .36, lightness(sourceBase) + baseRidge * 4.2);
      float sporeCut = sporeMask * smoothstep(.05, .28, lightness(sourceBase) + baseRidge * 5.);
      vec3 source = sourceBase;
      source = mix(source, texture2D(uTexture, clamp(sourceUv - canopyDrift, vec2(.001), vec2(.999))).rgb, canopyCut);
      source = mix(source, texture2D(uTexture, clamp(sourceUv - trunkDrift - rootDrift * bridgeRoot, vec2(.001), vec2(.999))).rgb, trunkCut);
      source = mix(source, texture2D(uTexture, clamp(sourceUv - mushroomDrift, vec2(.001), vec2(.999))).rgb, mushroomCut);
      source = mix(source, texture2D(uTexture, clamp(sourceUv - sporeDrift, vec2(.001), vec2(.999))).rgb, sporeCut);
      float ridge = max(lightness(source) - lightness(soft), 0.);
      float tissue = smoothstep(.035, .48, lightness(soft) + ridge * 2.8);
      float luminousMushroom = mushroomCut * smoothstep(.10, .52, lightness(source) + ridge * 3.2);
      float membraneVein = canopyMask * smoothstep(.035, .38, lightness(soft) + ridge * 4.);
      float livingWood = trunkMask * smoothstep(.025, .30, lightness(soft) + ridge * 2.4);

      vec3 color = source;
      color += vec3(.22, .29, .11) * tissue * (slowBreath * .025 + localField * .22);
      color += vec3(.58, .68, .31) * ridge * (localField * .48 + waveGlow * .92);
      color += vec3(.38, .42, .18) * membraneVein * canopyBreath * .055;
      color += vec3(.54, .58, .24) * luminousMushroom * (.055 + mushroomClock * .035);
      color += vec3(.72, .78, .36) * luminousMushroom * mushroomResponse * .32;
      color += vec3(.50, .59, .25) * membraneVein * canopyResponse * .22;
      color += vec3(.57, .63, .25) * livingWood * trunkResponse * .24;
      color += vec3(.72, .76, .41) * ridge * sporeResponse * .38;
      color += vec3(.32, .40, .14) * tissue * responseGlow * .08;
      color += vec3(.24, .29, .10) * livingWood * (trunkBreath * .018 + .02);
      color += vec3(.38, .45, .20) * brightStructure * sporeCut * (.06 + sporeResponse * .22);
      color *= 1. + tissue * rootPulse * .008;

      vec2 moteGrid = vec2(170., 96.);
      vec2 cell = floor((sourceUv + vec2(0., uTime * .00022)) * moteGrid);
      vec2 local = fract((sourceUv + vec2(0., uTime * .00022)) * moteGrid) - .5;
      float hash = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      float mote = step(.986, hash) * (1. - smoothstep(.015, .09, length(local)));
      color += vec3(.76, .79, .48) * mote * (.25 + slowBreath * .4);

      gl_FragColor = vec4(max(color, vec3(0.)), 1.);
    }
  `;

  function shader(gl, type, source) {
    const value = gl.createShader(type);
    gl.shaderSource(value, source);
    gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
    return value;
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  async function start() {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL is unavailable for THE GREEN BODY');
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    const locations = {
      texture: gl.getUniformLocation(program, 'uTexture'), resolution: gl.getUniformLocation(program, 'uResolution'),
      imageSize: gl.getUniformLocation(program, 'uImageSize'), pointer: gl.getUniformLocation(program, 'uPointer'),
      time: gl.getUniformLocation(program, 'uTime'), presence: gl.getUniformLocation(program, 'uPresence'),
      waves: gl.getUniformLocation(program, 'uWaves[0]'), responses: gl.getUniformLocation(program, 'uResponses[0]'),
    };
    const image = await loadImage('assets/world1-update-2-background@2x.png');
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    const responseTypes = { mushroom: 1, canopy: 2, trunk: 3, spore: 4 };
    const state = {
      x: .5,
      y: .5,
      presence: 0,
      waves: [],
      responses: [],
      nextWave: 0,
      nextResponse: 0,
      responseCount: 0,
      lastResponse: '',
    };
    addEventListener('pointermove', (event) => {
      state.x = event.clientX / innerWidth;
      state.y = 1 - event.clientY / innerHeight;
      state.presence = 1;
    }, { passive: true });
    addEventListener('pointerleave', () => { state.presence = 0; });
    addEventListener('pointerdown', (event) => {
      if (root.dataset.active !== 'true') return;
      state.waves[state.nextWave] = [event.clientX / innerWidth, 1 - event.clientY / innerHeight, performance.now() / 1000, 1];
      state.nextWave = (state.nextWave + 1) % 3;
    }, { passive: true });
    root.addEventListener('greenbody:arrival', (event) => {
      const detail = event.detail || {};
      const type = responseTypes[detail.organ];
      if (!type) return;
      const responseX = Number(detail.x);
      const responseY = Number(detail.y);
      state.responses[state.nextResponse] = [
        clamp(Number.isFinite(responseX) ? responseX : .5, 0, 1),
        1 - clamp(Number.isFinite(responseY) ? responseY : .5, 0, 1),
        performance.now() / 1000,
        type,
      ];
      state.nextResponse = (state.nextResponse + 1) % 8;
      state.responseCount += 1;
      state.lastResponse = detail.organ;
    });
    root.addEventListener('greenbody:reset', () => {
      state.responses.length = 0;
      state.nextResponse = 0;
      state.responseCount = 0;
      state.lastResponse = '';
    });

    function draw(now) {
      if (root.dataset.active !== 'true') {
        canvas.dataset.paused = 'true';
        requestAnimationFrame(draw);
        return;
      }
      canvas.dataset.paused = 'false';
      const compact = Math.min(innerWidth, innerHeight) < 760;
      const dpr = Math.min(compact ? 1.1 : 1.35, devicePixelRatio || 1);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(locations.texture, 0);
      gl.uniform2f(locations.resolution, width, height);
      gl.uniform2f(locations.imageSize, image.naturalWidth, image.naturalHeight);
      gl.uniform2f(locations.pointer, state.x, state.y);
      gl.uniform1f(locations.time, now / 1000);
      gl.uniform1f(locations.presence, root.dataset.active === 'true' ? state.presence : 0);
      const waves = new Float32Array(12);
      state.waves.forEach((wave, index) => waves.set(wave, index * 4));
      gl.uniform4fv(locations.waves, waves);
      const responses = new Float32Array(32);
      state.responses.forEach((response, index) => responses.set(response, index * 4));
      gl.uniform4fv(locations.responses, responses);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      canvas.dataset.responses = String(state.responseCount);
      canvas.dataset.lastResponse = state.lastResponse;
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  start().catch((error) => {
    console.error(error);
    root.dataset.rendering = 'unavailable';
  });
})();
