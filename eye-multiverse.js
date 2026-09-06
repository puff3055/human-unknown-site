(() => {
  'use strict';

  const MAX_EYES = 18;
  const MAX_FOLDS = 3;
  const FOCAL_LENGTH = 960;
  const TIMING = Object.freeze({ acknowledge: 90, locate: 210, echo: 520, commit: 960, settled: 1250, launchGap: 240 });

  const root = document.getElementById('multiverse');
  const canvas = document.getElementById('multiverseCanvas');
  const phenomenaCanvas = document.getElementById('phenomenaCanvas');
  const phenomena = phenomenaCanvas.getContext('2d');
  const waveCanvas = document.getElementById('voiceWave');
  const waveContext = waveCanvas.getContext('2d');
  const listenButton = document.getElementById('listenButton');
  const microphoneIcon = document.getElementById('microphoneIcon');
  const soundButton = document.getElementById('soundButton');
  const soundIcon = document.getElementById('soundIcon');
  const voiceStateNode = document.getElementById('voiceState');
  const transcriptNode = document.getElementById('transcript');
  const signalToken = document.getElementById('signalToken');
  const countNode = document.getElementById('count');
  const status = document.getElementById('status');
  const chapterIntro = document.getElementById('chapterIntro');
  const enterChapter = document.getElementById('enterChapter');
  const chapterIdentity = document.getElementById('chapterIdentity');
  const worldNarrative = document.getElementById('worldNarrative');
  const narrativeEyebrow = document.getElementById('narrativeEyebrow');
  const narrativeLine = document.getElementById('narrativeLine');
  const narrativeSource = document.getElementById('narrativeSource');
  const tracesTrigger = document.getElementById('tracesTrigger');
  const tracesDrawer = document.getElementById('tracesDrawer');
  const tracesBackdrop = document.getElementById('tracesBackdrop');
  const closeTraces = document.getElementById('closeTraces');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SOUND_STORAGE_KEY = 'human-unknown:sound-enabled';

  const NARRATIVES = Object.freeze([
    {
      count: 1,
      eyebrow: 'THE FIRST BRANCH',
      line: '在你们的世界，一件事发生以后，其他可能就只剩下“如果”。在这里，它们没有消失。',
      title: '《小径分岔的花园》The Garden of Forking Paths',
      url: 'https://www.penguinrandomhouse.com/books/224704/ficciones--fictions-by-jorge-luis-borges/9780307950925/'
    },
    {
      count: 2,
      eyebrow: 'A SHARED PAST',
      line: '这不是复制。它们共享同一段过去，从此拥有不同的未来。',
      title: '《焦虑是自由引起的眩晕》Anxiety Is the Dizziness of Freedom',
      url: 'https://www.penguinrandomhouse.com/books/538034/exhalation-by-ted-chiang/9781101947906'
    },
    {
      count: 3,
      eyebrow: 'BEYOND YOUR VIEW',
      line: '从你所在的维度，它们彼此分开。从更高处看，它们也许从未分离。',
      title: '《平面国》Flatland',
      url: 'https://www.gutenberg.org/files/97/97-h/97-h.htm'
    },
    {
      count: 5,
      eyebrow: 'THE LIFE NOT TAKEN',
      line: '你把它们叫作“可能”，是因为你只能身处其中一种。对它们而言，每一种都正在发生。',
      title: '《暗物质》Dark Matter',
      url: 'https://www.penguinrandomhouse.com/books/253400/dark-matter-by-blake-crouch/9781101904244/readers-guide/'
    },
    {
      count: 8,
      eyebrow: 'WHAT REMAINS YOURS',
      line: '如果每一种可能中的你都真实存在——此刻的你，准备怎样继续？',
      title: '《瞬息全宇宙》Everything Everywhere All at Once',
      url: 'https://a24films.com/films/everything-everywhere-all-at-once/'
    }
  ]);
  let narrativeTimer = 0;

  const VERTEX_SHADER = `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}
  `;

  const FRAGMENT_SHADER = `
    precision highp float;
    #define MAX_EYES ${MAX_EYES}
    #define MAX_FOLDS ${MAX_FOLDS}
    varying vec2 vUv;
    uniform sampler2D uEye;
    uniform sampler2D uEnvironment;
    uniform vec2 uResolution;
    uniform vec2 uEnvironmentResolution;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uArchiveWeight;
    uniform int uEyeCount;
    uniform int uFoldCount;
    uniform vec4 uEyeA[MAX_EYES];
    uniform vec4 uEyeB[MAX_EYES];
    uniform vec4 uEyeC[MAX_EYES];
    uniform vec4 uEyeD[MAX_EYES];
    uniform vec4 uFoldA[MAX_FOLDS];
    uniform vec4 uFoldB[MAX_FOLDS];
    uniform vec4 uFoldC[MAX_FOLDS];

    float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+1.),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.52;mat2 m=mat2(1.62,1.18,-1.18,1.62);for(int i=0;i<4;i++){v+=a*noise(p);p=m*p+3.17;a*=.48;}return v;}

    vec2 environmentUv(vec2 uv){
      float viewAspect=uResolution.x/max(1.,uResolution.y);
      float imageAspect=uEnvironmentResolution.x/max(1.,uEnvironmentResolution.y);
      if(viewAspect>imageAspect){float ratio=imageAspect/viewAspect;uv.y=(uv.y-.5)*ratio+.5;}
      else{float ratio=viewAspect/imageAspect;uv.x=(uv.x-.5)*ratio+.5;}
      return clamp(uv,vec2(.001),vec2(.999));
    }

    vec3 environment(vec2 uv,float time){
      vec2 pointerShift=(uPointer-.5)*vec2(.010,.006);
      vec2 current=vec2(time*.000006,-time*.0000025);
      vec2 sourceUv=environmentUv(uv+pointerShift+current);
      vec3 base=texture2D(uEnvironment,sourceUv).rgb;
      float depthDust=fbm((uv-.5)*vec2(3.2,2.1)+vec2(time*.002,-time*.001));
      base*=.91+depthDust*.11;
      float horizon=smoothstep(.04,.76,uArchiveWeight)*pow(max(0.,1.-length((uv-vec2(.88,.47))*vec2(2.8,5.2))),3.);
      base+=horizon*vec3(.095,.078,.19);
      return pow(max(base,vec3(0.)),vec3(.94));
    }

    void main(){
      float aspect=uResolution.x/max(1.,uResolution.y);
      vec3 color=environment(vUv,uTime);
      for(int i=0;i<MAX_FOLDS;i++){
        if(i>=uFoldCount)break;
        vec4 a=uFoldA[i];vec4 b=uFoldB[i];vec4 c=uFoldC[i];
        vec2 q=(vUv-a.xy)*vec2(aspect,1.);
        vec2 axis=normalize(b.xy+vec2(.0001,0.));
        vec2 normal=vec2(-axis.y,axis.x);
        float along=dot(q,axis),across=dot(q,normal);
        float curve=sin(along*8.6+c.w*6.283)*c.z*.18;
        float lengthMask=1.-smoothstep(a.z*.70,a.z,abs(along));
        float band=exp(-pow(abs(across-curve)/max(.008,c.z),2.))*lengthMask;
        float split=sin(clamp(b.z,0.,1.)*3.14159);
        vec2 offset=axis*(.014+.060*b.z)*a.w*band+normal*(across-curve)*.29*split*band;
        vec3 shifted=environment(vUv+offset,uTime+b.w);
        vec3 shiftedWarm=environment(vUv+offset*1.15+normal*.0024*a.w,uTime+b.w+4.7);
        color=mix(color,shifted,band*a.w*.72);
        color+=max(vec3(0.),shiftedWarm-shifted)*band*a.w*vec3(.62,.49,.95);
        float ridge=(1.-smoothstep(.0025,.014,abs(across-curve)))*lengthMask*a.w;
        float foldedEdge=exp(-pow((abs(across-curve)-c.z*.62)/max(.006,c.z*.23),2.))*lengthMask*a.w;
        color+=ridge*vec3(.22,.19,.42)*(.22+.42*split);
        color+=foldedEdge*vec3(.15,.12,.31)*(.11+.21*split);
      }

      for(int i=0;i<MAX_EYES;i++){
        if(i>=uEyeCount)break;
        vec4 a=uEyeA[i],b=uEyeB[i],c=uEyeC[i],d=uEyeD[i];
        vec2 q=(vUv-a.xy)*vec2(aspect,1.)/max(.0001,a.z);
        float cs=cos(c.x),sn=sin(c.x);q=mat2(cs,-sn,sn,cs)*q;
        q.x/=1.+abs(c.w)*.52+b.w*.075;q.x+=c.w*.045;q.y/=1.+b.w*.035;
        float r=length(q);
        if(r<1.18){
          float edgeNoise=noise(q*4.3+vec2(c.y*7.1,c.y*3.9));
          float sphere=1.-smoothstep(.94+edgeNoise*.018,1.065+edgeNoise*.012,r);
          float z=sqrt(max(0.,1.-min(1.,r*r)));
          vec2 refractUv=vUv+q*.013*(.25+z)*(1.-c.z*.32);
          vec3 refracted=environment(refractUv,uTime+d.w)*vec3(.91,.90,1.10);
          color=mix(color,refracted,sphere*(.72-c.z*.20)*a.w);
          float inner=1.-smoothstep(.24,.69,r);
          vec2 gaze=b.xy;
          vec2 textureUv=q*.455+.5-gaze*inner*.115;
          vec2 blurStep=vec2(.0017+.0031*c.z);
          vec4 sharp=texture2D(uEye,textureUv);
          vec4 soft=(texture2D(uEye,textureUv+vec2(blurStep.x,0.))+texture2D(uEye,textureUv-vec2(blurStep.x,0.))+texture2D(uEye,textureUv+vec2(0.,blurStep.y))+texture2D(uEye,textureUv-vec2(0.,blurStep.y)))*.25;
          vec4 tex=mix(sharp,soft,clamp(c.z*.78,0.,.82));
          float lum=max(tex.r,max(tex.g,tex.b));
          float detail=smoothstep(.012+.025*c.z,.105+.09*c.z,lum)*tex.a*sphere;
          vec3 eyeLight=pow(max(tex.rgb,vec3(0.)),vec3(.81))*vec3(.98,.92,1.19);
          color+=eyeLight*detail*(1.52-c.z*.57)*a.w*d.y;
          vec2 organ=q-gaze*.205;
          float organR=length(organ),angle=atan(organ.y,organ.x);
          float irisBand=smoothstep(.67,.45,organR)*smoothstep(.13,.22,organR);
          float raySeed=noise(vec2(angle*18.+c.y*5.,organR*17.));
          float rays=pow(.5+.5*sin(angle*96.+raySeed*9.+c.y*30.),7.)*irisBand;
          color+=rays*vec3(.22,.18,.48)*(.18+.20*d.y)*sphere*a.w;
          float pupilRadius=.205*d.x;
          float pupil=1.-smoothstep(pupilRadius*.83,pupilRadius,length(organ));
          color=mix(color,vec3(.00025,.00035,.0022),pupil*sphere*.96*a.w);
          float blink=b.z,lidX=organ.x+blink*.052;
          float membraneGate=1.-smoothstep(.89,1.035,r);
          float arch=.14*(1.-clamp(lidX*lidX*1.65,0.,1.));
          float upperEdge=mix(.79,-.54,blink)+arch+lidX*.052;
          float lowerEdge=mix(-.82,-.53,blink)-arch*.10-lidX*.014;
          float upperCover=smoothstep(upperEdge-.025,upperEdge+.025,organ.y);
          float lowerCover=1.-smoothstep(lowerEdge-.030,lowerEdge+.030,organ.y);
          float membrane=max(upperCover,lowerCover)*membraneGate*smoothstep(.018,.095,blink);
          float membraneNoise=fbm(organ*7.2+vec2(c.y*4.1,uTime*.025*d.z));
          vec3 membraneColor=vec3(.006,.005,.023)+vec3(.065,.046,.14)*membraneNoise;
          color=mix(color,membraneColor,membrane*.86*a.w);
          float seam=(1.-smoothstep(.005,.022,abs(organ.y-upperEdge)))*membraneGate*blink;
          color+=seam*vec3(.22,.17,.44)*.40*a.w;
          vec2 fixedUv=q*.455+.5;
          vec4 shell=texture2D(uEye,fixedUv);
          float shellLum=max(shell.r,max(shell.g,shell.b));
          float shellDetail=smoothstep(.14+.06*c.z,.51+.09*c.z,shellLum)*shell.a*sphere;
          color+=pow(shell.rgb,vec3(.75))*shellDetail*(.63-c.z*.20)*a.w;
          float fresnel=pow(1.-z,3.)*sphere;
          color+=fresnel*vec3(.14,.105,.34)*(.54-c.z*.17)*a.w;
          float rim=(1.-smoothstep(.012,.052,abs(r-.91)))*sphere;
          color+=rim*vec3(.23,.18,.50)*(.27-c.z*.08)*a.w;
          vec2 glintCenter=vec2(-.29+c.w*.06,.34);
          float glint=pow(max(0.,1.-length(q-glintCenter)/.24),3.)*sphere;
          color+=glint*vec3(.56,.50,.94)*(.24+.16*d.y-c.z*.11)*a.w;
          vec3 foreground=environment(vUv-q*.0028,uTime+d.w+9.);
          float fogLum=max(foreground.r,max(foreground.g,foreground.b));
          float occlusion=smoothstep(.19,.58,fogLum)*sphere*(.05+.27*c.z);
          color=mix(color,foreground*1.05,occlusion);
        }
      }
      float vignette=smoothstep(.38,1.07,length((vUv-.5)*vec2(aspect*.70,1.)));
      color*=1.-vignette*.47;color=pow(max(color,vec3(0.)),vec3(.88));
      gl_FragColor=vec4(color,1.);
    }
  `;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = value => 1 - Math.pow(1 - clamp(value, 0, 1), 3);
  const fract = value => value - Math.floor(value);
  const seededValue = (seed, index = 0) => fract(Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453);
  const query = new URLSearchParams(location.search);
  const requestedSeed = Number(query.get('seed'));
  const sessionSeed = Number.isFinite(requestedSeed) && requestedSeed > 0 ? requestedSeed : Math.floor(Math.random() * 900000) + 10000;

  function makeRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let result = value;
      result = Math.imul(result ^ result >>> 15, result | 1);
      result ^= result + Math.imul(result ^ result >>> 7, result | 61);
      return ((result ^ result >>> 14) >>> 0) / 4294967296;
    };
  }

  const pointer = { x: innerWidth * .5, y: innerHeight * .42 };
  const camera = { x: 0, y: 0, z: 0, scale: 1, targetX: 0, targetY: 0, targetZ: 0, targetScale: 1 };
  const realities = [], queue = [], rituals = [];
  let width = innerWidth, height = innerHeight, dpr = 1, lastTime = performance.now(), worldCount = 0, archiveWeight = 0;
  let lastLaunchAt = -Infinity, queueTimer = 0, attentionEye = null, lastTarget = null, lastDepthBand = '', nextEyeId = 1;
  let recognition = null, listeningWanted = false, restarting = false, manualFallback = false, recognizedByIndex = new Map(), voiceResetTimer = 0, voicePulseAt = -Infinity;
  let mediaStream = null, analyser = null, audio = null, soundOn = (() => {
    try { return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'; }
    catch (_) { return true; }
  })(), voiceLevel = 0;
  let gl = null, program = null, eyeTexture = null, environmentTexture = null, positionBuffer = null, ready = false, visualEyeImage = null;
  let environmentResolution = { width: 1672, height: 941 };
  const eyeA = new Float32Array(MAX_EYES * 4), eyeB = new Float32Array(MAX_EYES * 4), eyeC = new Float32Array(MAX_EYES * 4), eyeD = new Float32Array(MAX_EYES * 4);
  const foldA = new Float32Array(MAX_FOLDS * 4), foldB = new Float32Array(MAX_FOLDS * 4), foldC = new Float32Array(MAX_FOLDS * 4);

  function projectWorld(x, y, z, radius = 1) {
    const relativeZ = z - camera.z;
    const perspective = clamp(FOCAL_LENGTH / (FOCAL_LENGTH + relativeZ), .30, 1.72);
    const scale = perspective * camera.scale;
    const depth = clamp((relativeZ + 180) / 1380, 0, 1);
    const parallax = (1 - depth) * .032 - depth * .006;
    return { x: width * .5 + (x - width * .5 - camera.x) * scale + (pointer.x - width * .5) * parallax, y: height * .5 + (y - height * .5 - camera.y) * scale + (pointer.y - height * .5) * parallax * .64, r: radius * scale, scale, depth, relativeZ };
  }

  function unprojectScreen(x, y, z) {
    const projected = projectWorld(width * .5, height * .5, z, 1);
    const parallax = (1 - projected.depth) * .032 - projected.depth * .006;
    return { x: width * .5 + camera.x + (x - width * .5 - (pointer.x - width * .5) * parallax) / projected.scale, y: height * .5 + camera.y + (y - height * .5 - (pointer.y - height * .5) * parallax * .64) / projected.scale };
  }

  function screenEye(eye) { return projectWorld(eye.x, eye.y, eye.z, eye.radius); }

  class Reality {
    constructor(x, y, radius, options = {}) {
      this.id = nextEyeId++;this.parentId = options.parentId ?? null;this.generation = options.generation ?? 0;this.seed = options.seed ?? sessionSeed + this.id * 997;this.createdAt = performance.now();
      this.x = x;this.y = y;this.z = options.z ?? 0;this.radius = radius;this.opacity = options.opacity ?? .92;this.focus = options.focus ?? 1;
      this.rotation = options.rotation ?? (seededValue(this.seed, 2) - .5) * .28;this.yaw = options.yaw ?? (seededValue(this.seed, 3) - .5) * .34;this.targetYaw = this.yaw;
      this.timeRate = options.timeRate ?? (.78 + seededValue(this.seed, 4) * .54);this.timeOffset = options.timeOffset ?? seededValue(this.seed, 5) * 36;this.flowDirection = options.flowDirection ?? (seededValue(this.seed, 6) - .5) * Math.PI * 1.4;
      this.depthBand = options.depthBand ?? 'mid';this.state = options.state ?? 'active';this.phase = options.phase ?? 0;this.busyUntil = 0;
      this.lookX = 0;this.lookY = 0;this.lookTarget = { x, y };this.nextThought = performance.now() + 2200 + seededValue(this.seed, 7) * 4800;this.forced = null;this.directAttention = 0;
      this.pupilScale = options.pupilScale ?? .98 + seededValue(this.seed, 8) * .08;this.targetPupilScale = this.pupilScale;this.blinkStart = 0;this.blinkAt = performance.now() + 2600 + seededValue(this.seed, 9) * 6500;this.blinkAmount = 1;
    }
    lookAt(target, now, delay = 0, duration = 1500, direct = false) { this.forced = { target, start: now + delay, end: now + delay + duration, direct }; }
    lookAtCamera(now, delay = 0, duration = 1180) { this.lookAt(() => { const self = screenEye(this); return { x: self.x, y: self.y }; }, now, delay, duration, true); }
    chooseThought(now) {
      const random = makeRandom(this.seed + Math.floor(now / 1300)), self = screenEye(this), others = displayedEyes().filter(eye => eye !== this && eye.state !== 'forming' && eye.opacity > .45);
      if (others.length && random() < .46) { const other = others[Math.floor(random() * others.length)];this.lookTarget = () => { const target = screenEye(other);return { x: target.x, y: target.y }; }; }
      else { const reach = Math.min(width, height) * (.10 + random() * .17);const target = { x: clamp(self.x + (random() - .5) * reach * 2, 54, width - 54), y: clamp(self.y + (random() - .5) * reach * 1.45, 52, height - 72) };this.lookTarget = () => target; }
      this.targetYaw = (random() - .5) * .43;this.nextThought = now + 2400 + random() * 4800;
    }
    closure(now) {
      if (!this.blinkStart) return 0;const elapsed = (now - this.blinkStart) * this.timeRate;
      if (elapsed < 76) return easeOut(elapsed / 76) * this.blinkAmount;if (elapsed < 110) return this.blinkAmount;if (elapsed < 274) return (1 - smooth((elapsed - 110) / 164)) * this.blinkAmount;
      this.blinkStart = 0;this.blinkAt = now + 2800 + seededValue(this.seed, Math.floor(now / 1000)) * 6700;return 0;
    }
    update(now, dt) {
      if (this.state === 'archived') return;if (now > this.nextThought && (!this.forced || now > this.forced.end)) this.chooseThought(now);if (this.forced && now > this.forced.end) this.forced = null;
      let target = typeof this.lookTarget === 'function' ? this.lookTarget() : this.lookTarget;let direct = false;
      if (this.forced && now >= this.forced.start) { target = typeof this.forced.target === 'function' ? this.forced.target() : this.forced.target;direct = this.forced.direct; }
      const self = screenEye(this), dx = target.x - self.x, dy = target.y - self.y, distance = Math.max(1, Math.hypot(dx, dy)), reach = Math.min(self.r * .24, distance * .092), response = 1 - Math.pow(direct ? .70 : .84, dt / 16.67);
      this.lookX += (dx / distance * reach - this.lookX) * response;this.lookY += (dy / distance * reach - this.lookY) * response;this.directAttention += ((direct ? 1 : 0) - this.directAttention) * (1 - Math.pow(.79, dt / 16.67));
      this.targetPupilScale = direct ? 1.18 : .98 + seededValue(this.seed, 8) * .08;this.pupilScale += (this.targetPupilScale - this.pupilScale) * (1 - Math.pow(.86, dt / 16.67));this.yaw += (this.targetYaw - this.yaw) * (1 - Math.pow(.973, dt / 16.67));
      if (this.state === 'active' && !this.blinkStart && now >= this.blinkAt && !isActiveParent(this)) { this.blinkAmount = seededValue(this.seed, Math.floor(now / 800)) < .18 ? .64 + seededValue(this.seed, 13) * .15 : 1;this.blinkStart = now; }
    }
  }

  function isActiveParent(eye) { return rituals.some(ritual => ritual.parent === eye && !ritual.done); }
  function compile(type, source) { const shader = gl.createShader(type);gl.shaderSource(shader, source);gl.compileShader(shader);if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message); }return shader; }
  function makeTexture(image) { const texture = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D, texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);return texture; }

  function initializeWebGL(eyeImage, environmentImage) {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });if (!gl) throw new Error('WebGL unavailable');
    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);program = gl.createProgram();gl.attachShader(program, vertex);gl.attachShader(program, fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    positionBuffer = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    eyeTexture = makeTexture(eyeImage);environmentTexture = makeTexture(environmentImage);environmentResolution = { width: environmentImage.naturalWidth, height: environmentImage.naturalHeight };ready = true;seedWorld();
  }

  function seedWorld() {
    if (realities.length) return;const base = Math.min(width, height);
    const hero = new Reality(width * .30, height * .44, base * .34, { z: -82, opacity: 1, focus: 1.08, depthBand: 'near', seed: sessionSeed + 11, rotation: -.028, yaw: -.045 });
    const middle = new Reality(width * .59, height * .24, base * .115, { z: 265, opacity: .78, focus: .87, depthBand: 'mid', parentId: hero.id, generation: 1, seed: sessionSeed + 29, rotation: .09, yaw: .68 });
    const distant = new Reality(width * .84, height * .48, base * .073, { z: 690, opacity: .62, focus: .68, depthBand: 'far', parentId: hero.id, generation: 1, seed: sessionSeed + 47, rotation: -.12, yaw: -.36 });
    realities.push(hero, middle, distant);attentionEye = hero;
  }

  function displayedEyes() {
    const visible = realities.filter(eye => { if (eye.state === 'archived' || eye.opacity <= .004) return false;const screen = screenEye(eye);return screen.x + screen.r * 1.35 > 0 && screen.x - screen.r * 1.35 < width && screen.y + screen.r * 1.35 > 0 && screen.y - screen.r * 1.35 < height; });
    const priority = [...visible].sort((a, b) => { const aScore = (a.id === 1 ? 10000 : 0) + (a === attentionEye ? 5000 : 0) + a.createdAt * .0001;const bScore = (b.id === 1 ? 10000 : 0) + (b === attentionEye ? 5000 : 0) + b.createdAt * .0001;return bScore - aScore; }).slice(0, MAX_EYES);
    return priority.sort((a, b) => b.z - a.z);
  }

  function resize() {
    const oldWidth = width, oldHeight = height;width = innerWidth;height = innerHeight;const pixelBudgetRatio = Math.sqrt(3600000 / Math.max(1, width * height));dpr = Math.min(2, devicePixelRatio || 1, pixelBudgetRatio);
    if (realities.length && oldWidth > 0 && oldHeight > 0 && (oldWidth !== width || oldHeight !== height)) { const sx = width / oldWidth, sy = height / oldHeight, scale = Math.min(sx, sy);realities.forEach(eye => { eye.x *= sx;eye.y *= sy;eye.radius *= scale; });rituals.forEach(ritual => { ritual.origin.x *= sx;ritual.origin.y *= sy;ritual.origin.radius *= scale;ritual.target.x *= sx;ritual.target.y *= sy;ritual.target.radius *= scale; });camera.x *= sx;camera.y *= sy;camera.targetX *= sx;camera.targetY *= sy; }
    for (const target of [canvas, phenomenaCanvas]) { target.width = Math.round(width * dpr);target.height = Math.round(height * dpr);target.style.width = `${width}px`;target.style.height = `${height}px`; }
    phenomena.setTransform(dpr, 0, 0, dpr, 0, 0);const rect = waveCanvas.getBoundingClientRect();waveCanvas.width = Math.max(1, Math.round(rect.width * dpr));waveCanvas.height = Math.max(1, Math.round(rect.height * dpr));waveContext.setTransform(dpr, 0, 0, dpr, 0, 0);if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function fillEyeUniforms(now) {
    eyeA.fill(0);eyeB.fill(0);eyeC.fill(0);eyeD.fill(0);const visible = displayedEyes();
    visible.forEach((eye, index) => { const offset = index * 4, screen = screenEye(eye), depthOpacity = 1 - screen.depth * .29;eyeA.set([screen.x / width, 1 - screen.y / height, screen.r / height, eye.opacity * depthOpacity], offset);eyeB.set([eye.lookX / Math.max(1, screen.r), -eye.lookY / Math.max(1, screen.r), eye.closure(now), eye.phase], offset);eyeC.set([eye.rotation, eye.seed * .00017, screen.depth, eye.yaw], offset);eyeD.set([eye.pupilScale, eye.focus + eye.directAttention * .15, eye.timeRate, eye.timeOffset], offset); });return visible.length;
  }

  function fillFoldUniforms(now) {
    foldA.fill(0);foldB.fill(0);foldC.fill(0);const active = rituals.filter(ritual => !ritual.done).slice(0, MAX_FOLDS);
    active.forEach((ritual, index) => { const offset = index * 4, elapsed = now - ritual.startedAt, progress = clamp(elapsed / TIMING.commit, 0, 1), after = clamp((TIMING.settled - elapsed) / Math.max(1, TIMING.settled - TIMING.commit), 0, 1), strength = elapsed < TIMING.commit ? smooth(progress) : smooth(after);const origin = projectWorld(ritual.origin.x, ritual.origin.y, ritual.origin.z, ritual.origin.radius), target = projectWorld(ritual.target.x, ritual.target.y, ritual.target.z, ritual.target.radius), dx = target.x - origin.x, dy = target.y - origin.y, distance = Math.max(1, Math.hypot(dx, dy)), radius = clamp(distance / Math.max(1, height) * 1.18 + origin.r / height * .35, .18, .74);foldA.set([origin.x / width, 1 - origin.y / height, radius, strength], offset);foldB.set([dx / distance, -dy / distance, progress, ritual.timeOffset], offset);foldC.set([target.x / width, 1 - target.y / height, clamp(.032 + origin.r / height * .035, .036, .072), ritual.seed * .00013], offset); });return active.length;
  }

  function renderScene(now) {
    if (!ready) return;gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);const location = gl.getAttribLocation(program, 'aPosition');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D, eyeTexture);gl.uniform1i(gl.getUniformLocation(program, 'uEye'), 0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D, environmentTexture);gl.uniform1i(gl.getUniformLocation(program, 'uEnvironment'), 1);
    gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), canvas.width, canvas.height);gl.uniform2f(gl.getUniformLocation(program, 'uEnvironmentResolution'), environmentResolution.width, environmentResolution.height);gl.uniform2f(gl.getUniformLocation(program, 'uPointer'), pointer.x / width, 1 - pointer.y / height);gl.uniform1f(gl.getUniformLocation(program, 'uTime'), now * .001);gl.uniform1f(gl.getUniformLocation(program, 'uArchiveWeight'), archiveWeight);
    gl.uniform1i(gl.getUniformLocation(program, 'uEyeCount'), fillEyeUniforms(now));gl.uniform1i(gl.getUniformLocation(program, 'uFoldCount'), fillFoldUniforms(now));gl.uniform4fv(gl.getUniformLocation(program, 'uEyeA[0]'), eyeA);gl.uniform4fv(gl.getUniformLocation(program, 'uEyeB[0]'), eyeB);gl.uniform4fv(gl.getUniformLocation(program, 'uEyeC[0]'), eyeC);gl.uniform4fv(gl.getUniformLocation(program, 'uEyeD[0]'), eyeD);gl.uniform4fv(gl.getUniformLocation(program, 'uFoldA[0]'), foldA);gl.uniform4fv(gl.getUniformLocation(program, 'uFoldB[0]'), foldB);gl.uniform4fv(gl.getUniformLocation(program, 'uFoldC[0]'), foldC);gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function quadraticPoint(a, control, b, t) { const inverse = 1 - t;return { x: inverse * inverse * a.x + 2 * inverse * t * control.x + t * t * b.x, y: inverse * inverse * a.y + 2 * inverse * t * control.y + t * t * b.y }; }

  function drawTemporalPhenomena(now) {
    phenomena.clearRect(0, 0, width, height);if (!visualEyeImage || !rituals.length) return;phenomena.save();phenomena.globalCompositeOperation = 'screen';
    for (const ritual of rituals) {
      phenomena.globalAlpha = 1;
      const elapsed = now - ritual.startedAt;if (elapsed < 0 || elapsed > TIMING.settled) continue;const progress = clamp((elapsed - TIMING.locate) / Math.max(1, TIMING.commit - TIMING.locate), 0, 1), fade = elapsed < TIMING.commit ? 1 : clamp((TIMING.settled - elapsed) / (TIMING.settled - TIMING.commit), 0, 1), origin = projectWorld(ritual.origin.x, ritual.origin.y, ritual.origin.z, ritual.origin.radius), target = projectWorld(ritual.target.x, ritual.target.y, ritual.target.z, ritual.target.radius), dx = target.x - origin.x, dy = target.y - origin.y, distance = Math.max(1, Math.hypot(dx, dy)), normal = { x: -dy / distance, y: dx / distance }, control = { x: (origin.x + target.x) * .5 + normal.x * Math.min(90, distance * .20) * ritual.curveSign, y: (origin.y + target.y) * .5 + normal.y * Math.min(90, distance * .20) * ritual.curveSign };
      if (elapsed >= TIMING.acknowledge) { const strandAlpha = Math.sin(Math.PI * clamp(elapsed / TIMING.commit, 0, 1)) * fade;for (let strand = 0; strand < 7; strand++) { const offset = (strand - 3) * (3.5 + ritual.target.radius * .008), jitter = (seededValue(ritual.seed, strand) - .5) * 18;phenomena.strokeStyle = `rgba(${strand % 3 === 0 ? '222,216,255' : '137,119,228'},${(.025 + Math.abs(strand - 3) * .006) * strandAlpha})`;phenomena.lineWidth = strand === 3 ? .8 : .45;phenomena.beginPath();phenomena.moveTo(origin.x + normal.x * offset, origin.y + normal.y * offset);phenomena.quadraticCurveTo(control.x + normal.x * (offset + jitter), control.y + normal.y * (offset + jitter), target.x + normal.x * offset * .35, target.y + normal.y * offset * .35);phenomena.stroke(); } }
      if (elapsed >= TIMING.locate && elapsed < TIMING.commit) { for (let echo = 0; echo < 3; echo++) { const lag = echo * .075, t = smooth(clamp(progress - lag, 0, 1)), point = quadraticPoint(origin, control, target, t), radius = lerp(origin.r, target.r, t), alpha = (1 - progress) * (.105 - echo * .022) * (1 - t * .25);if (alpha <= .002) continue;phenomena.globalAlpha = alpha;phenomena.filter = `blur(${.35 + echo * .45}px)`;phenomena.drawImage(visualEyeImage, point.x - radius, point.y - radius, radius * 2, radius * 2); }phenomena.filter = 'none';phenomena.globalAlpha = 1; }
      const streakProgress = clamp((elapsed - TIMING.acknowledge) / (TIMING.commit - TIMING.acknowledge), 0, 1);for (let particle = 0; particle < 22; particle++) { const start = seededValue(ritual.seed, particle + 20), t = fract(start + streakProgress * (.42 + seededValue(ritual.seed, particle + 60) * .48)), point = quadraticPoint(origin, control, target, t), previous = quadraticPoint(origin, control, target, Math.max(0, t - .014)), scatter = (seededValue(ritual.seed, particle + 90) - .5) * Math.min(42, distance * .09) * Math.sin(Math.PI * t), alpha = Math.sin(Math.PI * t) * fade * (.08 + seededValue(ritual.seed, particle + 110) * .20);phenomena.strokeStyle = `rgba(212,204,255,${alpha})`;phenomena.lineWidth = .35 + seededValue(ritual.seed, particle + 130) * .65;phenomena.beginPath();phenomena.moveTo(previous.x + normal.x * scatter, previous.y + normal.y * scatter);phenomena.lineTo(point.x + normal.x * scatter, point.y + normal.y * scatter);phenomena.stroke(); }
    }
    phenomena.restore();
  }

  function drawWaveform(now) {
    const cssWidth = waveCanvas.width / dpr, cssHeight = waveCanvas.height / dpr;waveContext.clearRect(0, 0, cssWidth, cssHeight);const gradient = waveContext.createLinearGradient(0, 0, cssWidth, 0);gradient.addColorStop(0, 'rgba(116,96,224,0)');gradient.addColorStop(.14, 'rgba(158,139,255,.48)');gradient.addColorStop(.5, 'rgba(224,216,255,.9)');gradient.addColorStop(.86, 'rgba(158,139,255,.48)');gradient.addColorStop(1, 'rgba(116,96,224,0)');waveContext.strokeStyle = gradient;waveContext.lineWidth = 1.1;waveContext.beginPath();let level = 0;
    if (analyser) { const data = new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(data);for (let index = 0; index < data.length; index++) { const normalized = (data[index] - 128) / 128;level += normalized * normalized;const x = index / (data.length - 1) * cssWidth, y = cssHeight * .5 + normalized * cssHeight * .42;if (index === 0) waveContext.moveTo(x, y);else waveContext.lineTo(x, y); }voiceLevel = Math.sqrt(level / data.length); }
    else { const pulse = clamp(1 - (now - voicePulseAt) / 440, 0, 1);for (let index = 0; index <= 180; index++) { const t = index / 180, envelope = Math.exp(-Math.pow((t - .53) * 7, 2)), wave = Math.sin(t * 90) * envelope * pulse, x = t * cssWidth, y = cssHeight * .5 + wave * cssHeight * .34;if (index === 0) waveContext.moveTo(x, y);else waveContext.lineTo(x, y); }voiceLevel *= .9; }
    waveContext.stroke();if (analyser && voiceLevel > .028 && root.dataset.state === 'listening') { engageCameraGaze(performance.now());setVoiceState('hearing', '正在听你', '正在识别…'); }
  }

  function setVoiceState(state, label, hint = '', token = '') { root.dataset.state = state;voiceStateNode.textContent = label;transcriptNode.textContent = hint;signalToken.textContent = token;microphoneIcon.src = state === 'denied' ? 'assets/tabler-microphone-off.svg' : 'assets/tabler-microphone.svg';let ariaLabel = '开启麦克风';if (manualFallback || state === 'fallback') ariaLabel = '点击发出 hey';else if (listeningWanted) ariaLabel = '停止聆听';listenButton.setAttribute('aria-label', ariaLabel); }
  function resetVoiceSoon(delay = 700) { clearTimeout(voiceResetTimer);voiceResetTimer = setTimeout(() => { if (rituals.length || queue.length) return;if (listeningWanted) setVoiceState('listening', '正在听…', '说出 hey');else if (!manualFallback) setVoiceState('idle', '让它们听见你', '麦克风未开启'); }, delay); }

  function nearestEyeToPointer(candidates = displayedEyes()) { let winner = null, best = Infinity;for (const eye of candidates) { if (eye.state !== 'active') continue;const screen = screenEye(eye), distance = Math.hypot(pointer.x - screen.x, pointer.y - screen.y) / Math.max(44, screen.r);if (distance < best) { best = distance;winner = eye; } }return winner; }
  function engageCameraGaze(now) { const active = displayedEyes().filter(eye => eye.state === 'active'), hero = realities[0];if (hero) hero.lookAtCamera(now, 0, 1200);if (attentionEye && attentionEye !== hero) attentionEye.lookAtCamera(now, 36, 1140);active.forEach(eye => { if (eye === hero || eye === attentionEye) return;const shouldTurn = seededValue(eye.seed, Math.floor(now / 400)) > .25;if (shouldTurn) eye.lookAtCamera(now, 80 + seededValue(eye.seed, 17) * 240, 880 + seededValue(eye.seed, 18) * 480); }); }
  function chooseDepthBand(random) { const roll = random();let band = roll < .14 ? 'near' : roll < .50 ? 'mid' : 'far';if (band === lastDepthBand) { if (band === 'near') band = random() < .72 ? 'far' : 'mid';else if (band === 'mid') band = random() < .66 ? 'far' : 'near';else band = random() < .72 ? 'mid' : 'near'; }return band; }

  function spawnTarget(parent) {
    const base = Math.min(width, height), random = makeRandom(sessionSeed + (worldCount + queue.length + rituals.length + 1) * 7919), band = chooseDepthBand(random), settings = { near: { minR: .19, maxR: .31, minZ: -210, maxZ: 80 }, mid: { minR: .09, maxR: .16, minZ: 170, maxZ: 520 }, far: { minR: .035, maxR: .08, minZ: 560, maxZ: 1260 } }[band];let best = null, bestScore = -Infinity;const visible = displayedEyes();
    for (let index = 0; index < 64; index++) { const z = camera.z + settings.minZ + random() * (settings.maxZ - settings.minZ), desiredScreenRadius = base * (settings.minR + random() * (settings.maxR - settings.minR));let screenX = width * (-.07 + random() * 1.14), screenY = height * (.11 + random() * .70);if (band === 'far') screenX = width * (.48 + random() * .53);if (band === 'near' && random() < .62) screenX = width * (random() < .5 ? -.02 + random() * .24 : .78 + random() * .24);const worldPoint = unprojectScreen(screenX, screenY, z), scale = projectWorld(worldPoint.x, worldPoint.y, z, 1).scale, radius = desiredScreenRadius / Math.max(.25, scale), projected = projectWorld(worldPoint.x, worldPoint.y, z, radius), gap = visible.reduce((value, eye) => { const other = screenEye(eye);return Math.min(value, Math.hypot(projected.x - other.x, projected.y - other.y) - (projected.r + other.r) * .58); }, Infinity), uiPenalty = projected.y + projected.r > height * .78 && projected.x > width * .24 && projected.x < width * .76 ? 320 : 0, headerPenalty = projected.y - projected.r < 88 ? 190 : 0, edgeAllowance = Math.min(projected.x + projected.r * .60, width - projected.x + projected.r * .60, projected.y + projected.r * .60, height - projected.y + projected.r * .60), lastDistance = lastTarget ? Math.hypot(projected.x - lastTarget.screenX, projected.y - lastTarget.screenY) : base, sizeDifference = lastTarget ? Math.abs(projected.r - lastTarget.screenR) / Math.max(1, lastTarget.screenR) : 1, direction = Math.sign(projected.x - screenEye(parent).x) || 1, directionPenalty = lastTarget && direction === lastTarget.direction ? 42 : 0, similarityPenalty = lastTarget && sizeDifference < .24 ? (1 - sizeDifference / .24) * 260 : 0, corridorAffinity = band === 'far' ? projected.x / width * 100 : band === 'near' ? Math.abs(projected.x / width - .5) * 78 : 28, score = gap * 1.7 + Math.min(96, edgeAllowance) + Math.min(160, lastDistance) * .72 + sizeDifference * 92 + corridorAffinity - uiPenalty - headerPenalty - directionPenalty - similarityPenalty + (random() - .5) * 18;if (score > bestScore) { bestScore = score;best = { x: worldPoint.x, y: worldPoint.y, z, radius, depthBand: band, screenX: projected.x, screenY: projected.y, screenR: projected.r, direction }; } }
    return best;
  }

  function receiveHey(source = 'voice', spoken = 'hey') { queue.push({ source, spoken, at: performance.now() });voicePulseAt = performance.now();engageCameraGaze(performance.now());const waiting = queue.length + rituals.filter(item => !item.committed).length;setVoiceState('recognized', '已听见 hey', waiting > 1 ? `等待分岔 ×${waiting}` : '现实正在分岔', `HEY · +${waiting}`);status.textContent = `已接收 ${waiting} 声 hey。`;ensureAudio();playCue('heard', attentionEye || realities[0]);scheduleRitualPump(); }
  function scheduleRitualPump() { if (!queue.length || queueTimer) return;if (rituals.filter(item => !item.done).length >= MAX_FOLDS) { queueTimer = setTimeout(() => { queueTimer = 0;scheduleRitualPump(); }, 72);return; }const delay = Math.max(0, TIMING.launchGap - (performance.now() - lastLaunchAt));queueTimer = setTimeout(() => { queueTimer = 0;startRitual();if (queue.length) scheduleRitualPump(); }, delay); }

  function startRitual() {
    if (!queue.length || !realities.length) return;const now = performance.now(), signal = queue.shift(), parent = attentionEye && attentionEye.state === 'active' ? attentionEye : realities.find(item => item.state === 'active'), target = spawnTarget(parent), ritual = { startedAt: now, signal, parent, target, origin: { x: parent.x, y: parent.y, z: parent.z, radius: parent.radius }, child: null, committed: false, done: false, seed: sessionSeed + (worldCount + rituals.length + 1) * 1237, curveSign: seededValue(sessionSeed + worldCount, 31) > .5 ? 1 : -1, timeOffset: (seededValue(sessionSeed + worldCount, 32) - .5) * 18 };
    rituals.push(ritual);lastLaunchAt = now;parent.busyUntil = now + TIMING.settled;parent.lookAtCamera(now, 0, 1180);root.dataset.process = 'branch';setVoiceState('bifurcating', '已听见 hey', queue.length ? `现实正在分岔 · 等待 ×${queue.length}` : '现实正在分岔', 'HEY · +1');const origin = screenEye(parent), midpointX = (origin.x + target.screenX) * .5, midpointY = (origin.y + target.screenY) * .5;camera.targetX = lerp(camera.targetX, (midpointX - width * .5) * .12, .55);camera.targetY = lerp(camera.targetY, (midpointY - height * .5) * .10, .55);camera.targetZ = clamp(camera.targetZ + (target.z > parent.z ? 18 : -6), -40, 380);playCue('focus', parent);
  }

  function createChild(ritual, now) {
    if (ritual.child) return;const parent = ritual.parent, child = new Reality(ritual.origin.x, ritual.origin.y, ritual.origin.radius, { parentId: parent.id, generation: parent.generation + 1, seed: ritual.seed, z: ritual.origin.z, opacity: .08, focus: ritual.target.depthBand === 'near' ? 1.04 : ritual.target.depthBand === 'mid' ? .86 : .67, depthBand: ritual.target.depthBand, state: 'forming', rotation: parent.rotation + (seededValue(ritual.seed, 2) - .5) * .42, yaw: clamp(parent.yaw + (seededValue(ritual.seed, 3) - .5) * 1.04, -.88, .88), timeRate: .68 + seededValue(ritual.seed, 4) * .72, timeOffset: parent.timeOffset + (seededValue(ritual.seed, 5) - .5) * 42, flowDirection: parent.flowDirection + (seededValue(ritual.seed, 6) - .5) * 1.6 });child.lookX = parent.lookX;child.lookY = parent.lookY;child.lookAtCamera(now, 0, 1080);realities.push(child);ritual.child = child;playCue('birth', parent);
  }

  function compactRealities() { const active = realities.filter(item => item.state === 'active' && item.id !== 1);if (active.length <= 15) return;const protectedIds = new Set([attentionEye?.id, ...realities.slice(-6).map(item => item.id), ...rituals.flatMap(item => [item.parent?.id, item.child?.id])]);const archive = active.sort((a, b) => a.createdAt - b.createdAt).find(item => !protectedIds.has(item.id));if (archive) { archive.state = 'archived';archive.opacity = 0;archiveWeight = Math.min(1, archiveWeight + .085); } }
  function showNarrative(count) {
    const narrative = [...NARRATIVES].reverse().find(item => count >= item.count);
    if (!narrative || !root.dataset.entered) return;
    clearTimeout(narrativeTimer);
    worldNarrative.hidden = false;
    worldNarrative.classList.remove('is-refreshing');
    void worldNarrative.offsetWidth;
    narrativeEyebrow.textContent = narrative.eyebrow;
    narrativeLine.textContent = narrative.line;
    narrativeSource.innerHTML = `<span>灵感来源 · 相似观点，非作品原句</span><a href="${narrative.url}" target="_blank" rel="noopener noreferrer">${narrative.title}</a>`;
    worldNarrative.querySelector('.world-narrative__copy').style.animation = 'none';
    void worldNarrative.offsetWidth;
    worldNarrative.querySelector('.world-narrative__copy').style.animation = '';
    if (count >= 5) tracesTrigger.hidden = false;
  }

  function commitRitual(ritual, now) { if (ritual.committed) return;ritual.committed = true;worldCount++;countNode.textContent = String(worldCount).padStart(2, '0');const child = ritual.child;child.state = 'active';child.phase = 0;child.opacity = ritual.target.depthBand === 'near' ? .96 : ritual.target.depthBand === 'mid' ? .82 : .66;child.lookAtCamera(now, 0, 760);attentionEye = child;lastDepthBand = ritual.target.depthBand;lastTarget = ritual.target;status.textContent = `第 ${worldCount} 个新现实已经从页面内部形成。`;setVoiceState('settling', '现实分岔 +1', `现实 ${String(worldCount).padStart(2, '0')} 已回应`, 'HEY · +1');playCue('open', child);compactRealities();showNarrative(worldCount);resetVoiceSoon(620); }
  function updateRituals(now) { const hadRituals = rituals.length > 0, timeScale = reducedMotion ? 3.4 : 1;for (const ritual of rituals) { const elapsed = (now - ritual.startedAt) * timeScale;ritual.parent.phase = elapsed < TIMING.commit ? Math.sin(Math.PI * clamp(elapsed / TIMING.commit, 0, 1)) * .52 : 0;if (elapsed >= TIMING.locate) createChild(ritual, now);if (ritual.child) { const progress = smooth(clamp((elapsed - TIMING.locate) / (TIMING.commit - TIMING.locate), 0, 1)), child = ritual.child;child.x = lerp(ritual.origin.x, ritual.target.x, progress);child.y = lerp(ritual.origin.y, ritual.target.y, progress);child.z = lerp(ritual.origin.z, ritual.target.z, progress);child.radius = lerp(ritual.origin.radius, ritual.target.radius, progress);child.opacity = lerp(.08, ritual.target.depthBand === 'near' ? .96 : ritual.target.depthBand === 'mid' ? .82 : .66, smooth(clamp((progress - .05) / .78, 0, 1)));child.phase = Math.sin(Math.PI * progress) * .72; }if (elapsed >= TIMING.commit) commitRitual(ritual, now);if (elapsed >= TIMING.settled) { ritual.parent.phase = 0;ritual.done = true; } }for (let index = rituals.length - 1; index >= 0; index--) if (rituals[index].done) rituals.splice(index, 1);root.dataset.process = rituals.length ? 'branch' : 'idle';if (hadRituals && !rituals.length) resetVoiceSoon(160);if (queue.length) scheduleRitualPump(); }

  function analyzeHey(text) { const value = text.toLowerCase().replace(/[.,!?;:。，！？]/g, ' '), hard = value.match(/\b(?:h+e+y+|hei+|hai+|hay+)\b/g) || [], chinese = value.match(/[嗨嘿]/g) || [], soft = value.match(/\bhi+\b/g) || [];return { hard: hard.length + chinese.length, soft: soft.length }; }
  function bestAlternative(result) { let best = result[0], bestAnalysis = analyzeHey(best?.transcript || ''), bestScore = bestAnalysis.hard * 100 + bestAnalysis.soft * 10 + (best?.confidence || 0);for (let index = 1; index < result.length; index++) { const candidate = result[index], analysis = analyzeHey(candidate.transcript || ''), score = analysis.hard * 100 + analysis.soft * 10 + (candidate.confidence || 0);if (score > bestScore) { best = candidate;bestAnalysis = analysis;bestScore = score; } }const count = bestAnalysis.hard || (result.isFinal ? bestAnalysis.soft : 0);return { alternative: best, count }; }

  function setupRecognition() {
    if (!SpeechRecognition) return false;recognition = new SpeechRecognition();recognition.continuous = true;recognition.interimResults = true;recognition.maxAlternatives = 10;recognition.lang = 'en-US';
    recognition.onstart = () => { restarting = false;recognizedByIndex = new Map();setVoiceState('listening', '正在听…', '说出 hey'); };
    recognition.onsoundstart = () => { engageCameraGaze(performance.now());setVoiceState('hearing', '正在听你', '正在识别…'); };recognition.onspeechstart = recognition.onsoundstart;
    recognition.onspeechend = () => { if (root.dataset.state === 'hearing') setVoiceState('hearing', '正在识别', transcriptNode.textContent || '…'); };
    recognition.onresult = event => { for (let index = event.resultIndex; index < event.results.length; index++) { const result = event.results[index], { alternative, count } = bestAlternative(result), spoken = (alternative?.transcript || '').trim(), accepted = recognizedByIndex.get(index) || 0;if (!result.isFinal) setVoiceState('hearing', count ? '识别到 hey' : '正在识别', spoken || '…');if (count > accepted) { recognizedByIndex.set(index, count);for (let item = accepted; item < count; item++) receiveHey('voice', spoken || 'hey'); }if (result.isFinal && count === 0 && accepted === 0) { setVoiceState('listening', '没有听清 hey', spoken || '请再说一次');resetVoiceSoon(1050); } } };
    recognition.onnomatch = () => { setVoiceState('listening', '没有听清 hey', '请再说一次');resetVoiceSoon(1050); };
    recognition.onerror = event => { if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { listeningWanted = false;manualFallback = false;setVoiceState('denied', '无法使用麦克风', '点击重试');listenButton.disabled = false; }else if (event.error !== 'no-speech' && event.error !== 'aborted') { listeningWanted = false;manualFallback = true;setVoiceState('fallback', '语音识别不可用', '点击麦克风继续体验');listenButton.disabled = false; } };
    recognition.onend = () => { if (!listeningWanted || restarting) return;restarting = true;setTimeout(() => { try { recognition.start(); }catch (_) { restarting = false; } }, 180); };return true;
  }

  async function startMicrophone() { listenButton.disabled = true;manualFallback = false;setVoiceState('requesting', '正在等待麦克风权限', '');ensureAudio();try { if (!navigator.mediaDevices?.getUserMedia) throw new Error('mediaDevices unavailable');mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });const source = audio.ctx.createMediaStreamSource(mediaStream);analyser = audio.ctx.createAnalyser();analyser.fftSize = 1024;analyser.smoothingTimeConstant = .40;source.connect(analyser);listeningWanted = true;listenButton.disabled = false;if (!recognition && !setupRecognition()) { listeningWanted = false;manualFallback = true;setVoiceState('fallback', '语音识别不可用', '点击麦克风继续体验');return; }try { recognition.start(); }catch (_) { setVoiceState('listening', '正在听…', '说出 hey'); } }catch (_) { listeningWanted = false;manualFallback = false;listenButton.disabled = false;setVoiceState('denied', '无法使用麦克风', '点击重试'); } }
  function stopMicrophone() { listeningWanted = false;manualFallback = false;if (recognition) { try { recognition.stop(); }catch (_) {} }if (mediaStream) { mediaStream.getTracks().forEach(track => track.stop());mediaStream = null; }analyser = null;setVoiceState('idle', '让它们听见你', '麦克风未开启'); }
  function ensureAudio() { if (audio) { if (audio.ctx.state === 'suspended') audio.ctx.resume();return; }const AudioContext = window.AudioContext || window.webkitAudioContext;if (!AudioContext) return;const context = new AudioContext(), master = context.createGain();master.gain.value = soundOn ? .14 : 0;master.connect(context.destination);audio = { ctx: context, master }; }
  function syncSoundControl() { soundButton.setAttribute('aria-pressed', String(soundOn));soundButton.setAttribute('aria-label', soundOn ? '关闭声音' : '开启声音');soundIcon.src = soundOn ? 'assets/tabler-volume.svg' : 'assets/tabler-volume-off.svg'; }
  function playCue(kind, eye) { if (!soundOn || !audio || !eye) return;const context = audio.ctx, now = context.currentTime, oscillator = context.createOscillator(), gain = context.createGain(), panner = context.createStereoPanner ? context.createStereoPanner() : null, frequency = { heard: [330, 244], focus: [126, 172], birth: [74, 162], open: [166, 438] }[kind] || [110, 230];oscillator.type = kind === 'heard' ? 'sine' : 'triangle';oscillator.frequency.setValueAtTime(frequency[0], now);oscillator.frequency.exponentialRampToValueAtTime(frequency[1], now + .48);gain.gain.setValueAtTime(.0001, now);gain.gain.exponentialRampToValueAtTime(.040, now + .035);gain.gain.exponentialRampToValueAtTime(.0001, now + .60);oscillator.connect(gain);if (panner) { gain.connect(panner);panner.pan.value = clamp((screenEye(eye).x / width - .5) * 1.6, -1, 1);panner.connect(audio.master); }else gain.connect(audio.master);oscillator.start(now);oscillator.stop(now + .62); }
  function updateAttention() { if (rituals.length) return;const next = nearestEyeToPointer();if (next) attentionEye = next; }
  function updateCamera(dt) { const response = 1 - Math.pow(.945, dt / 16.67);camera.x += (camera.targetX - camera.x) * response;camera.y += (camera.targetY - camera.y) * response;camera.z += (camera.targetZ - camera.z) * response;camera.scale += (camera.targetScale - camera.scale) * response; }
  function frame(now) { const dt = Math.min(40, now - lastTime);lastTime = now;updateRituals(now);updateCamera(dt);realities.forEach(eye => eye.update(now, dt));renderScene(now);drawTemporalPhenomena(now);drawWaveform(now);requestAnimationFrame(frame); }
  function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image();image.decoding = 'async';image.onload = () => resolve(image);image.onerror = reject;image.src = src; }); }

  listenButton.addEventListener('click', () => { if (manualFallback) { receiveHey('manual', 'hey');return; }if (listeningWanted) stopMicrophone();else startMicrophone(); });
  function openChapter(focusVoice = true) {
    root.dataset.entered = 'true';
    chapterIdentity.setAttribute('aria-hidden', 'false');
    chapterIntro.classList.add('is-leaving');
    setTimeout(() => { chapterIntro.hidden = true;if (focusVoice) listenButton.focus({ preventScroll: true }); }, 920);
  }
  enterChapter.addEventListener('click', () => openChapter());
  function setTraces(open) {
    root.dataset.traces = open ? 'open' : 'closed';
    tracesTrigger.setAttribute('aria-expanded', String(open));
    tracesDrawer.setAttribute('aria-hidden', String(!open));
    if (open) closeTraces.focus({ preventScroll: true });
    else tracesTrigger.focus({ preventScroll: true });
  }
  tracesTrigger.addEventListener('click', () => setTraces(true));
  closeTraces.addEventListener('click', () => setTraces(false));
  tracesBackdrop.addEventListener('click', () => setTraces(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && root.dataset.traces === 'open') setTraces(false); });
  soundButton.addEventListener('click', () => { ensureAudio();soundOn = !soundOn;try { localStorage.setItem(SOUND_STORAGE_KEY, soundOn ? 'on' : 'off'); }catch (_) {}syncSoundControl();if (audio) audio.master.gain.setTargetAtTime(soundOn ? .14 : 0, audio.ctx.currentTime, .08); });
  root.addEventListener('pointermove', event => { pointer.x = event.clientX;pointer.y = event.clientY;root.dataset.input = event.pointerType === 'touch' ? 'touch' : 'pointer';updateAttention(); });
  addEventListener('resize', resize);document.addEventListener('visibilitychange', () => { if (document.hidden) stopMicrophone(); });root.dataset.density = 'folded';syncSoundControl();resize();

  Promise.all([loadImage('assets/eye-orb-source-cutout.png'), loadImage('assets/eye-multiverse-corridor-v1.png')]).then(([eyeImage, environmentImage]) => { visualEyeImage = eyeImage;try { initializeWebGL(eyeImage, environmentImage);resize(); }catch (error) { console.error(error);setVoiceState('fallback', '视觉渲染暂时不可用', '请更新浏览器'); } }).catch(error => { console.error(error);setVoiceState('fallback', '视觉素材加载失败', '请刷新页面'); });
  requestAnimationFrame(frame);
  const qaDemo = query.get('demo'), qaDelay = Math.max(0, Number(query.get('demoDelay')) || 620);
  if (query.get('demoEnter') === '1') openChapter(false);
  if (qaDemo === 'hey') setTimeout(() => receiveHey('test', 'hey'), qaDelay);
  if (qaDemo === 'triple') setTimeout(() => { for (let index = 0; index < 3; index++) setTimeout(() => receiveHey('test', 'hey'), index * 90); }, qaDelay);
  if (qaDemo === 'density') setTimeout(() => { for (let index = 0; index < 12; index++) setTimeout(() => receiveHey('test', 'hey'), index * 52); }, qaDelay);
  if (query.has('demoCopy')) setTimeout(() => { const count = Math.max(1, Number(query.get('demoCopy')) || 1);worldCount = count;countNode.textContent = String(worldCount).padStart(2, '0');showNarrative(worldCount); }, qaDelay);
  if (query.get('demoTraces') === '1') setTimeout(() => { tracesTrigger.hidden = false;setTraces(true); }, qaDelay + 1800);

  window.eyeMultiverse = Object.freeze({
    sayHey: (count = 1) => { for (let index = 0; index < count; index++) setTimeout(() => receiveHey('test', 'hey'), index * 70); },
    aimAt: id => { const eye = realities.find(item => item.id === Number(id));if (eye) { const screen = screenEye(eye);pointer.x = screen.x;pointer.y = screen.y;updateAttention(); } },
    get count() { return worldCount; },get process() { return rituals.length ? 'branch' : 'idle'; },get active() { return rituals.length; },get eyes() { return realities.filter(item => item.state !== 'archived').length; },get archived() { return realities.filter(item => item.state === 'archived').length; },get folds() { return rituals.length; },get bands() { return realities.filter(item => item.state !== 'archived').map(item => item.depthBand); },get projectedSizes() { return realities.filter(item => item.state === 'active').map(item => Math.round(screenEye(item).r * 2)); },get selectedReality() { return attentionEye?.id || null; },get hasVoiceProjectile() { return false; },get seed() { return sessionSeed; },timing: TIMING
  });
})();
