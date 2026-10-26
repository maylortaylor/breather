import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import { browserEnv } from "./loop";
import { createLoop } from "./loop";
import { createAuroraClock, renderRatio } from "./logic";
import type { BackgroundRenderer, RendererOptions } from "./renderer";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Original work for Breather, MIT licensed: written from scratch from the published description
// of an aurora (layered noise curtains, a sharp lower edge fading upward, faint stars). It uses
// no Shadertoy code and no third-party shader or noise code.
const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;
uniform float uBright;
uniform float uHeight;
uniform float uLift;
uniform float uAmp;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = p * 2.03 + 17.1;
    amp *= 0.5;
  }
  return sum;
}

// One curtain: a wavering lower edge, a sharp rise above it that fades slowly upward, and
// vertical rays that drift sideways.
vec3 curtain(vec2 uv, float seed, float speed, float base, vec3 tint) {
  float t = uTime * speed;
  float sway = fbm(vec2(uv.x * 1.4 + seed * 7.0, t * 0.3 + seed)) - 0.5;
  float edge = base + uLift * 0.2 + sway * 0.5 * uAmp;
  float d = uv.y - edge;
  float fade = mix(5.5, 2.2, uHeight);
  float body = smoothstep(-0.015, 0.05, d) * exp(-max(d, 0.0) * fade);
  float rays = 0.5 + 0.5 * fbm(vec2(uv.x * 13.0 + seed * 3.0 + t * 0.7, d * 1.2 - t * 0.12));
  return tint * body * rays;
}

void main() {
  vec2 uv = vec2(vUv.x * uAspect, vUv.y);

  // Night sky: near-black navy, a touch lighter toward the horizon.
  vec3 sky = mix(vec3(0.030, 0.045, 0.100), vec3(0.016, 0.024, 0.060), vUv.y);

  vec3 aurora = vec3(0.0);
  aurora += curtain(uv, 1.0, 0.8, 0.34, vec3(0.10, 0.80, 0.50));
  aurora += curtain(uv, 2.3, 0.6, 0.42, vec3(0.08, 0.60, 0.72));
  aurora += curtain(uv, 3.7, 0.5, 0.50, vec3(0.50, 0.30, 0.85)) * 0.8;
  aurora *= uBright * 1.15;

  // Faint stars on a cell grid, hidden where the aurora is bright.
  vec2 cell = uv * 70.0;
  vec2 id = floor(cell);
  float h = hash(id);
  vec2 centre = vec2(hash(id + 3.1), hash(id + 7.7));
  float star = step(0.985, h) * smoothstep(0.22, 0.0, length(fract(cell) - centre));
  float twinkle = 0.7 + 0.3 * sin(uTime * 0.8 + h * 60.0);
  float lum = max(aurora.r, max(aurora.g, aurora.b));
  sky += vec3(0.8, 0.85, 1.0) * star * twinkle * 0.5 * uBright * (1.0 - smoothstep(0.0, 0.35, lum));

  vec3 col = sky * (0.55 + 0.45 * uBright) + aurora;
  // A little noise hides banding in the dark gradient.
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Draws the aurora with WebGL, or returns null when a context cannot be made. */
export function createAurora(
  canvas: HTMLCanvasElement,
  opts: RendererOptions
): BackgroundRenderer | null {
  let gl: WebGLRenderer;
  try {
    gl = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }

  const clock = createAuroraClock();
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
  );
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uBright: { value: 0.5 },
      uHeight: { value: 0.5 },
      uLift: { value: 0.5 },
      uAmp: { value: 1 },
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const ratio =
    opts.pixelRatio ??
    renderRatio({
      dpr: window.devicePixelRatio || 1,
      cores: navigator.hardwareConcurrency,
      memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    });
  gl.setPixelRatio(ratio);

  const loop = createLoop(
    (dt) => {
      const f = clock.step(dt, opts.reducedMotion());
      const u = material.uniforms;
      u.uTime!.value = f.time;
      u.uBright!.value = f.brightness;
      u.uHeight!.value = f.height;
      u.uLift!.value = f.lift;
      u.uAmp!.value = f.amplitude;
      gl.render(scene, camera);
    },
    opts.env ?? browserEnv,
    30
  );

  let stopped = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    if (stopped) return;
    loop.stop();
    opts.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    start: () => loop.start(),
    setBreath: (v) => clock.setBreath(v),
    setDim: (on) => clock.setDim(on),
    resize(w, h) {
      gl.setSize(Math.max(1, w), Math.max(1, h), false);
      material.uniforms.uAspect!.value = w / Math.max(1, h);
    },
    stop() {
      stopped = true;
      loop.stop();
      canvas.removeEventListener("webglcontextlost", onLost);
      geometry.dispose();
      material.dispose();
      gl.dispose();
      // Frees the GPU context now (WEBGL_lose_context) instead of waiting for garbage collection.
      gl.forceContextLoss();
    },
  };
}
