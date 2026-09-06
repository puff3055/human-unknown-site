(() => {
  "use strict";

  const SOURCE_WIDTH = 1672;
  const SOURCE_HEIGHT = 941;
  const HERO = { x: 0.466, y: 0.505 };
  const CHILD = { x: 0.642, y: 0.276 };
  const RECURSION_RATIO = 0.418;
  const INITIAL_ZOOM = 1.16;
  const MAX_EVENTS = 7;

  const VERTEX_SHADER = `#version 300 es
    precision highp float;
    out vec2 vUv;
    void main() {
      vec2 points[3] = vec2[](vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
      vec2 point = points[gl_VertexID];
      vUv = point * .5 + .5;
      gl_Position = vec4(point, 0., 1.);
    }
  `;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 fragColor;

    uniform sampler2D uMaster;
    uniform sampler2D uActivity;
    uniform sampler2D uDepth;
    uniform float uTime;
    uniform float uCycle;
    uniform float uLevelTone;
    uniform float uPointerEnergy;
    uniform float uClickAge;
    uniform float uSignal;
    uniform float uSeam;
    uniform float uSourceAspect;
    uniform vec2 uCenter;
    uniform vec2 uSpan;
    uniform vec2 uPointer;
    uniform vec2 uParallax;
    uniform vec2 uClickOrigin;
    uniform vec2 uEventPositions[7];
    uniform float uEventAges[7];
    uniform float uEventKinds[7];

    const vec2 HERO = vec2(.466, .505);
    const vec2 CHILD = vec2(.642, .276);
    const float RATIO = .418;

    float pulseBand(float phase, float width) {
      float delta = abs(fract(phase + .5) - .5);
      return 1. - smoothstep(0., width, delta);
    }

    vec4 recursiveSample(sampler2D image, vec2 uv) {
      vec4 base = texture(image, clamp(uv, 0., 1.));
      vec2 mappedUv = HERO + (uv - CHILD) / RATIO;
      vec4 detail = texture(image, clamp(mappedUv, 0., 1.));
      float valid = step(0., mappedUv.x) * step(mappedUv.x, 1.)
        * step(0., mappedUv.y) * step(mappedUv.y, 1.);
      float detailMix = smoothstep(.70, .975, uCycle) * valid;
      return mix(base, detail, detailMix);
    }

    float sdSegment(vec2 p, vec2 a, vec2 b, out float along) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      along = clamp(dot(pa, ba) / max(dot(ba, ba), .000001), 0., 1.);
      return length(pa - ba * along);
    }

    vec2 pathMetric(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
      float h0; float h1; float h2;
      float d0 = sdSegment(p, a, b, h0);
      float d1 = sdSegment(p, b, c, h1);
      float d2 = sdSegment(p, c, d, h2);
      float distanceToPath = d0;
      float position = h0 * .31;
      if (d1 < distanceToPath) { distanceToPath = d1; position = .31 + h1 * .36; }
      if (d2 < distanceToPath) { distanceToPath = d2; position = .67 + h2 * .33; }
      return vec2(distanceToPath, position);
    }

    void main() {
      vec2 rawUv = uCenter + (vUv - .5) * uSpan;
      if (rawUv.x < -.08 || rawUv.x > 1.08 || rawUv.y < -.08 || rawUv.y > 1.08) {
        fragColor = vec4(.002, .003, .004, 1.);
        return;
      }

      float rawDepth = recursiveSample(uDepth, rawUv).r;
      vec2 depthShift = uParallax * mix(vec2(.0007, .0005), vec2(.0048, .0031), rawDepth);
      vec2 sourceUv = rawUv + depthShift;

      vec2 pointerDelta = sourceUv - uPointer;
      pointerDelta.x *= uSourceAspect;
      float pointerDistance = length(pointerDelta);
      float pointerField = exp(-pointerDistance * pointerDistance * 250.) * uPointerEnergy;

      vec2 eventWarp = vec2(0.);
      for (int i = 0; i < 7; i++) {
        float age = uEventAges[i];
        float kind = uEventKinds[i];
        if (age >= 0. && age <= 1. && kind > 0.) {
          vec2 delta = sourceUv - uEventPositions[i];
          delta.x *= uSourceAspect;
          float envelope = sin(age * 3.14159265) * exp(-dot(delta, delta) * 105.);
          float direction = kind < 1.5 ? -1. : 1.;
          eventWarp += normalize(delta + vec2(.00001)) * envelope * direction * .0038;
        }
      }

      float clickEnvelope = uClickAge >= 0. ? (1. - smoothstep(.0, .72, uClickAge)) : 0.;
      vec2 clickDelta = sourceUv - uClickOrigin;
      clickDelta.x *= uSourceAspect;
      float clickField = exp(-dot(clickDelta, clickDelta) * 330.) * clickEnvelope;
      vec2 localWarp = -normalize(pointerDelta + vec2(.00001)) * pointerField * .0042;
      localWarp += -normalize(clickDelta + vec2(.00001)) * clickField * .0105;
      localWarp.x /= uSourceAspect;
      sourceUv = clamp(sourceUv + localWarp + eventWarp, 0., 1.);

      vec3 color = recursiveSample(uMaster, sourceUv).rgb;
      float activity = recursiveSample(uActivity, sourceUv).r;
      float depth = recursiveSample(uDepth, sourceUv).r;

      float flowA = pulseBand(sourceUv.x * 1.73 + sourceUv.y * .51 - uTime * .020, .021);
      float flowB = pulseBand(sourceUv.y * 1.31 - sourceUv.x * .42 - uTime * .013, .018);
      float flowC = pulseBand((sourceUv.x + sourceUv.y) * .91 - uTime * .0085, .014);
      float conduction = max(flowA * .76, max(flowB * .48, flowC * .31)) * activity;
      vec3 warm = mix(vec3(.82, .46, .18), vec3(.48, .27, .76), uLevelTone);
      color += warm * conduction * (.16 + depth * .34);

      float gather = pointerField * activity;
      color += vec3(.98, .65, .28) * gather * .50;
      color += vec3(.58, .31, .96) * gather * .29;
      float hoverRing = 1. - smoothstep(.004, .018, abs(pointerDistance - .065));
      color += vec3(.70, .43, .95) * hoverRing * activity * uPointerEnergy * .28;

      float compressionRing = 1. - smoothstep(.005, .019, abs(length(clickDelta) - mix(.10, .012, min(uClickAge * 1.45, 1.))));
      color += vec3(.93, .62, 1.) * compressionRing * activity * clickEnvelope * .78;
      color *= 1. - clickField * .31;

      vec2 aspectScale = vec2(uSourceAspect, 1.);
      vec2 signalPath = pathMetric(
        sourceUv * aspectScale,
        uClickOrigin * aspectScale,
        vec2(.535, .435) * aspectScale,
        vec2(.596, .356) * aspectScale,
        CHILD * aspectScale
      );
      if (uSignal >= 0.) {
        float head = 1. - smoothstep(.0, .025, abs(signalPath.y - uSignal));
        float tail = smoothstep(uSignal - .42, uSignal - .09, signalPath.y)
          * (1. - smoothstep(uSignal - .02, uSignal + .035, signalPath.y));
        float corridor = 1. - smoothstep(.006, .058, signalPath.x);
        float signalLight = (head + tail * .54) * corridor * (.22 + activity * 1.78);
        color += vec3(.82, .53, 1.) * signalLight * 1.18;
        vec2 arrivalDelta = (sourceUv - CHILD) * aspectScale;
        float arrival = smoothstep(.77, .94, uSignal) * exp(-dot(arrivalDelta, arrivalDelta) * 150.);
        color += vec3(.98, .63, .30) * arrival * 1.25;
      }

      float eventLight = 0.;
      float eventDark = 0.;
      for (int i = 0; i < 7; i++) {
        float age = uEventAges[i];
        float kind = uEventKinds[i];
        if (age >= 0. && age <= 1. && kind > 0.) {
          vec2 delta = sourceUv - uEventPositions[i];
          delta.x *= uSourceAspect;
          float distanceToEvent = length(delta);
          if (kind < 1.5) {
            float bloom = sin(age * 3.14159265) * exp(-distanceToEvent * distanceToEvent * 130.);
            float ring = (1. - smoothstep(.005, .021, abs(distanceToEvent - age * .11))) * (1. - age);
            eventLight += bloom * .74 + ring * .35;
          } else {
            float collapse = (1. - smoothstep(.005, .019, abs(distanceToEvent - (1. - age) * .09))) * (1. - age);
            float scar = exp(-distanceToEvent * distanceToEvent * 160.)
              * smoothstep(.14, .38, age) * (1. - smoothstep(.72, 1., age));
            eventLight += collapse * .16;
            eventDark += scar * .72;
          }
        }
      }
      color += vec3(1., .66, .28) * eventLight * (.28 + activity * .72);
      color *= 1. - eventDark * (.40 + activity * .60);

      vec2 seamDelta = (sourceUv - CHILD) * aspectScale;
      float seamHalo = exp(-dot(seamDelta, seamDelta) * 74.) * uSeam;
      color += vec3(.66, .38, 1.) * seamHalo * (.26 + activity * .74);

      float vignette = smoothstep(1.02, .22, length((vUv - .5) * vec2(1.04, .93)));
      color *= mix(.69, 1., vignette);
      color = pow(max(color, 0.), vec3(.89));
      fragColor = vec4(color, 1.);
    }
  `;

  class PlanetNeuronRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "high-performance" });
      this.ready = false;
      this.depth = 0;
      this.cycle = 0;
      this.level = 0;
      this.pointer = { x: HERO.x, y: HERO.y, energy: 0 };
      this.click = { age: -1, origin: { x: HERO.x, y: HERO.y } };
      this.signal = -1;
      this.seam = 0;
      this.parallax = { x: 0, y: 0 };
      this.events = [];
      this.viewport = { width: 1, height: 1, dpr: 1 };
      this.center = { ...HERO };
      this.span = { x: 1, y: 1 };
    }

    async initialize(assetRoot) {
      if (!this.gl) throw new Error("WebGL2 is unavailable");
      this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
      this.uniforms = this.collectUniforms([
        "uMaster", "uActivity", "uDepth", "uTime", "uCycle", "uLevelTone",
        "uPointerEnergy", "uClickAge", "uSignal", "uSeam", "uSourceAspect",
        "uCenter", "uSpan", "uPointer", "uParallax", "uClickOrigin",
        "uEventPositions[0]", "uEventAges[0]", "uEventKinds[0]",
      ]);
      const files = ["recursive-master-v1.png", "recursive-activity-v1.png", "recursive-depth-v1.png"];
      const images = await Promise.all(files.map((file) => this.loadImage(assetRoot + "/" + file)));
      this.textures = images.map((image) => this.createTexture(image));
      this.resize();
      this.ready = true;
    }

    createShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error("Shader compilation failed: " + message);
      }
      return shader;
    }

    createProgram(vertexSource, fragmentSource) {
      const gl = this.gl;
      const program = gl.createProgram();
      gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("Program link failed: " + gl.getProgramInfoLog(program));
      }
      return program;
    }

    collectUniforms(names) {
      return Object.fromEntries(names.map((name) => [name, this.gl.getUniformLocation(this.program, name)]));
    }

    loadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load " + url));
        image.src = url;
      });
    }

    createTexture(image) {
      const gl = this.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      return texture;
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.viewport = { width: this.canvas.clientWidth, height: this.canvas.clientHeight, dpr };
      if (this.gl) this.gl.viewport(0, 0, width, height);
      this.updateView();
    }

    setDepth(depth) {
      this.depth = depth;
      this.level = Math.floor(depth);
      this.cycle = depth - this.level;
      this.updateView();
    }

    updateView() {
      const cover = Math.max(this.viewport.width / SOURCE_WIDTH, this.viewport.height / SOURCE_HEIGHT);
      const baseSpanX = this.viewport.width / (cover * INITIAL_ZOOM * SOURCE_WIDTH);
      const baseSpanY = this.viewport.height / (cover * INITIAL_ZOOM * SOURCE_HEIGHT);
      const scale = Math.pow(RECURSION_RATIO, this.cycle);
      const travel = (1 - scale) / (1 - RECURSION_RATIO);
      this.center.x = HERO.x + (CHILD.x - HERO.x) * travel;
      this.center.y = HERO.y + (CHILD.y - HERO.y) * travel;
      this.span.x = baseSpanX * scale;
      this.span.y = baseSpanY * scale;
    }

    screenToSource(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = 1 - (clientY - rect.top) / rect.height;
      return { x: this.center.x + (x - .5) * this.span.x, y: this.center.y + (y - .5) * this.span.y };
    }

    isOverLivingNode(point) {
      const heroDistance = Math.hypot((point.x - HERO.x) / .20, (point.y - HERO.y) / .30);
      const childDistance = Math.hypot((point.x - CHILD.x) / .09, (point.y - CHILD.y) / .145);
      return Math.min(heroDistance, childDistance) < 1.04;
    }

    setPointer(point, energy) { this.pointer = { ...point, energy }; }
    setClick(age, origin) { this.click.age = age; if (origin) this.click.origin = { ...origin }; }
    setSignal(value) { this.signal = value; }
    setSeam(value) { this.seam = value; }
    setParallax(value) { this.parallax = { ...value }; }

    addEvent(kind, position, duration = 1800) {
      this.events.push({ kind: kind === "burst" ? 1 : 2, position: { ...position }, startedAt: performance.now(), duration });
      if (this.events.length > MAX_EVENTS) this.events.shift();
    }

    render(now) {
      if (!this.ready) return;
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.textures[0]); gl.uniform1i(this.uniforms.uMaster, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.textures[1]); gl.uniform1i(this.uniforms.uActivity, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.textures[2]); gl.uniform1i(this.uniforms.uDepth, 2);
      gl.uniform1f(this.uniforms.uTime, now / 1000);
      gl.uniform1f(this.uniforms.uCycle, this.cycle);
      gl.uniform1f(this.uniforms.uLevelTone, Math.abs(this.level % 2));
      gl.uniform1f(this.uniforms.uPointerEnergy, this.pointer.energy);
      gl.uniform1f(this.uniforms.uClickAge, this.click.age);
      gl.uniform1f(this.uniforms.uSignal, this.signal);
      gl.uniform1f(this.uniforms.uSeam, this.seam);
      gl.uniform1f(this.uniforms.uSourceAspect, SOURCE_WIDTH / SOURCE_HEIGHT);
      gl.uniform2f(this.uniforms.uCenter, this.center.x, this.center.y);
      gl.uniform2f(this.uniforms.uSpan, this.span.x, this.span.y);
      gl.uniform2f(this.uniforms.uPointer, this.pointer.x, this.pointer.y);
      gl.uniform2f(this.uniforms.uParallax, this.parallax.x, this.parallax.y);
      gl.uniform2f(this.uniforms.uClickOrigin, this.click.origin.x, this.click.origin.y);

      const positions = new Float32Array(MAX_EVENTS * 2);
      const ages = new Float32Array(MAX_EVENTS).fill(-1);
      const kinds = new Float32Array(MAX_EVENTS);
      this.events = this.events.filter((event) => now - event.startedAt <= event.duration);
      this.events.forEach((event, index) => {
        positions[index * 2] = event.position.x;
        positions[index * 2 + 1] = event.position.y;
        ages[index] = (now - event.startedAt) / event.duration;
        kinds[index] = event.kind;
      });
      gl.uniform2fv(this.uniforms["uEventPositions[0]"], positions);
      gl.uniform1fv(this.uniforms["uEventAges[0]"], ages);
      gl.uniform1fv(this.uniforms["uEventKinds[0]"], kinds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  window.PlanetNeuronRenderer = PlanetNeuronRenderer;
})();
