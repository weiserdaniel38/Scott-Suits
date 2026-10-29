// Draped fabric view for the fabric pop-up (Daniel, 2026-10-28: make picking
// fabric feel physical). The fabric photo is laid on a piece of cloth that
// hangs from the top edge in soft folds, slowly turns all the way round
// (Daniel, 2026-10-29: full 360), and spins freely when dragged sideways. Plain WebGL, no library: one subdivided sheet whose folds
// are computed in the vertex shader, lit by a soft key light with a gentle
// sheen. FabricDrape.create(container) returns { setImage(img), start(),
// stop() }, or null when the browser has no WebGL (the pop-up then keeps
// only the close-up view).
(function () {
  const VERT = `
attribute vec2 aPos;
uniform float uTime, uYaw, uAspect;
// Up to four touch ripples: x, y on the sheet, start time, strength.
uniform vec4 uRip[4];
varying vec2 vUv;
varying vec3 vNormal, vPos, vBase;
// Depth of the cloth at (x, y): the top quarter hangs flat from where it is
// held, then a few broad, soft folds open up toward the hem, drifting slowly.
float fold(vec2 p) {
  float hang = clamp((1.0 - p.y) * 0.5, 0.0, 1.0);
  float open = smoothstep(0.18, 1.0, hang);
  float a = 0.15 * pow(open, 1.3);
  float t = uTime;
  float z = sin(p.x * 4.6 + 0.6 + sin(t * 0.5) * 0.25 * open) * 0.6
          + sin(p.x * 2.3 + 2.0 + sin(t * 0.35) * 0.3 * open) * 0.4;
  // A touch gives the cloth a faint push under the finger and a slight
  // ripple of straight, upright waves that runs sideways across the folds
  // and dies out quickly, the way linen moves rather than water. The held
  // top stays still.
  float r = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 rp = uRip[i];
    float age = t - rp.z;
    if (rp.w <= 0.0 || age < 0.0 || age > 2.0) continue;
    vec2 dv = p - rp.xy;
    float spread = 0.18 + age * 0.12;
    float bump = exp(-dot(dv, dv) / spread);
    r -= rp.w * 0.022 * bump * exp(-age * 2.2) * cos(age * 4.0);
    float front = (abs(dv.x) - age * 0.7) / 0.2;
    float reach = exp(-dv.y * dv.y / 0.6);
    r += rp.w * 0.045 * sin(front * 2.8) * exp(-front * front) * reach * exp(-age * 1.7);
  }
  return z * a + r * smoothstep(0.05, 0.35, hang);
}
vec3 place(vec2 p) {
  float hang = clamp((1.0 - p.y) * 0.5, 0.0, 1.0);
  // Folds pull the width in a little, and the hem dips where the cloth bulges.
  float x = p.x * (1.0 - 0.07 * hang);
  float z = fold(p);
  float y = p.y - z * z * 0.6 * hang;
  return vec3(x, y, z);
}
void main() {
  vec2 p = aPos;
  vec3 pos = place(p);
  float e = 0.01;
  vec3 dx = place(p + vec2(e, 0.0)) - place(p - vec2(e, 0.0));
  vec3 dy = place(p + vec2(0.0, e)) - place(p - vec2(0.0, e));
  vec3 n = normalize(cross(dx, dy));
  float c = cos(uYaw), s = sin(uYaw);
  pos = vec3(c * pos.x + s * pos.z, pos.y, -s * pos.x + c * pos.z);
  n = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
  vPos = pos;
  vNormal = n;
  vBase = vec3(s, 0.0, c);
  vUv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  // Simple perspective: the camera sits in front, a little above center.
  float d = 3.1;
  vec3 cam = pos - vec3(0.0, 0.05, d);
  float f = 1.95;
  gl_Position = vec4(cam.x * f / uAspect, cam.y * f, (-cam.z - 1.0) / 6.0, -cam.z);
}`;
  const FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform vec4 uCrop;
uniform float uRepeat;
varying vec2 vUv;
varying vec3 vNormal, vPos, vBase;
void main() {
  vec2 uv = vUv * uRepeat;
  uv = abs(mod(uv + 1.0, 2.0) - 1.0);
  uv = uCrop.xy + uv * uCrop.zw;
  vec3 col = texture2D(uTex, uv).rgb;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) { n = -n; col *= 0.78; }
  vec3 L = normalize(vec3(-0.75, 0.55, 0.65));
  vec3 V = normalize(vec3(0.0, 0.05, 3.1) - vPos);
  float diff = max(dot(n, L), 0.0);
  float wrap = max((dot(n, L) + 0.35) / 1.35, 0.0);
  vec3 H = normalize(L + V);
  float sheen = pow(max(dot(n, H), 0.0), 18.0) * 0.18 + pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.12;
  // Shading is relative to the unfolded panel at its current turn, so a flat panel shows
  // the photo's true color. Light fabrics get gentler shading and almost no
  // sheen, and a soft shoulder stops whites from blowing out.
  // Seen from behind, the back of the panel faces the camera.
  float bl = dot(normalize(gl_FrontFacing ? vBase : -vBase), L);
  float flatShade = 0.24 + 0.78 * max((bl + 0.35) / 1.35, 0.0) + 0.16 * max(bl, 0.0);
  float shade = 0.24 + 0.78 * wrap + 0.16 * diff - flatShade;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float bright = smoothstep(0.45, 0.85, lum);
  float light = 1.0 + shade * mix(1.1, 0.75, bright);
  sheen *= 1.0 - 0.85 * bright;
  vec3 c = col * light + vec3(sheen);
  vec3 over = max(c - 0.9, 0.0);
  c = c - over + 0.1 * (1.0 - exp(-over / 0.1));
  gl_FragColor = vec4(c, 1.0);
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  function create(container) {
    const canvas = document.createElement("canvas");
    canvas.className = "fabric-drape-canvas";
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) return null;
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      console.warn("Fabric drape unavailable:", e);
      return null;
    }
    container.appendChild(canvas);
    gl.useProgram(prog);

    // The sheet: a grid over x in [-1, 1], y in [-1.25, 1.25].
    const NX = 90, NY = 110;
    const verts = new Float32Array((NX + 1) * (NY + 1) * 2);
    let k = 0;
    for (let j = 0; j <= NY; j++) {
      for (let i = 0; i <= NX; i++) {
        verts[k++] = -1 + (2 * i) / NX;
        verts[k++] = 1.25 - (2.5 * j) / NY;
      }
    }
    const idx = new Uint16Array(NX * NY * 6);
    k = 0;
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
        idx.set([a, c, b, b, c, d], k);
        k += 6;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    const u = {};
    ["uTime", "uYaw", "uAspect", "uTex", "uCrop", "uRepeat", "uRip"].forEach((n) => (u[n] = gl.getUniformLocation(prog, n)));

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([60, 60, 60, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(u.uTex, 0);
    gl.uniform4f(u.uCrop, 0, 0, 1, 1);
    gl.uniform1f(u.uRepeat, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // Both photos have pinked (zigzag) edges, so only their inside is used:
    // the middle of a small thumbnail, or nearly all of the sharp close-up.
    // The cloth is a little taller than the photo, so the hem mirrors it.
    function setImage(img) {
      if (!img || !img.naturalWidth) return;
      const size = Math.min(1024, Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = c.height = size;
      try {
        c.getContext("2d").drawImage(img, 0, 0, size, size);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      } catch (e) {
        return;
      }
      const small = img.naturalWidth < 400;
      if (small) gl.uniform4f(u.uCrop, 0.22, 0.22, 0.56, 0.56);
      else gl.uniform4f(u.uCrop, 0.06, 0.06, 0.88, 0.88);
      gl.uniform1f(u.uRepeat, 1.0);
      draw();
    }

    // The cloth turns slowly all the way round. Dragging sideways spins it
    // freely, a flick keeps it going for a moment, and it then eases back
    // into the slow turn in whichever direction it was last pushed.
    const AUTO = (Math.PI * 2) / 30; // one full turn every 30 seconds
    let yaw = 0.18, vel = AUTO, dir = 1, dragging = null, raf = 0, t0 = performance.now(), last = 0;
    const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Touching the cloth gives it a faint push under the finger; dragging
    // keeps giving softer ones along the way (not with reduced motion).
    const rips = new Float32Array(16);
    let ripNext = 0, lastRip = 0;
    function ripple(e, strength) {
      if (still) return;
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = 1 - ((e.clientY - r.top) / r.height) * 2;
      const k = 3.1 / 1.95;
      const c = Math.cos(yaw);
      const x = (nx * (r.width / r.height) * k) / ((c < 0 ? -1 : 1) * Math.max(0.4, Math.abs(c)));
      const y = ny * k + 0.05;
      rips.set([x, y, (performance.now() - t0) / 1000, strength], ripNext * 4);
      ripNext = (ripNext + 1) % 4;
      lastRip = performance.now();
    }
    canvas.addEventListener("pointerdown", (e) => {
      dragging = { x: e.clientX, yaw, px: e.clientX, pt: performance.now() };
      vel = 0;
      canvas.setPointerCapture(e.pointerId);
      ripple(e, 1);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      yaw = dragging.yaw + (e.clientX - dragging.x) / 160;
      const now = performance.now(), dt = Math.max(1, now - dragging.pt) / 1000;
      vel = vel * 0.6 + (((e.clientX - dragging.px) / 160) / dt) * 0.4;
      dragging.px = e.clientX;
      dragging.pt = now;
      if (performance.now() - lastRip > 220) ripple(e, 0.45);
      if (still) draw();
    });
    const release = () => {
      if (!dragging) return;
      // A finger held still before lifting leaves no flick.
      if (performance.now() - dragging.pt > 120) vel = 0;
      vel = Math.max(-8, Math.min(8, vel));
      if (Math.abs(vel) > 0.05) dir = vel < 0 ? -1 : 1;
      dragging = null;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const now = performance.now();
      const t = still ? 0 : (now - t0) / 1000;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (!dragging && !still) {
        vel += (AUTO * dir - vel) * (1 - Math.exp(-dt * 1.4));
        yaw += vel * dt;
      }
      yaw %= Math.PI * 2;
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uYaw, yaw);
      gl.uniform1f(u.uAspect, w / h);
      gl.uniform4fv(u.uRip, rips);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }
    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }
    return {
      setImage,
      start() {
        // Opening the pop-up starts facing front; switching fabric keeps turning.
        if (!raf) {
          yaw = 0.18;
          vel = AUTO;
          dir = 1;
        }
        last = 0;
        cancelAnimationFrame(raf);
        if (still) draw();
        else loop();
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
      },
    };
  }

  window.FabricDrape = { create };
})();
