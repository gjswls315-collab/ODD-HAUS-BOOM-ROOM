import * as THREE from 'three';

// 캔버스로 생성하는 절차적 텍스처 (외부 이미지 에셋 없이 동작)

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.needsUpdate = true;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── 바닥: 셀 정렬 원목 / 타일 + 은은한 체커 (그리드 가독성) ─────────
// v4: 바닥에 격자선을 그리지 않는다. 대신 판자 이음새 / 파케이 방향 / 타일 결 / 데크 틈이
// 칸 경계에 맞춰 있어 "보드게임판이 된 방"처럼 자연스럽게 칸이 읽힌다.
//   planks  : 반 칸 폭 판자, 이음매는 칸 경계에서 엇갈림 (Lounge / Locked Room)
//   parquet : 칸마다 결 방향이 바뀌는 바스켓 위브 (LP Library)
//   tiles   : 칸 크기 고무/비닐 타일, 아주 옅은 경계 음영 (Studio / DJ Booth)
//   deck    : 세로 데크 보드, 칸 경계에서 이음 (Terrace)
export function floorTexture(theme, W, H, style = 'planks') {
  return cached(`floor-${theme.a}-${W}-${H}-${style}`, () => {
    const S = 64;
    const c = canvas(W * S, H * S);
    const g = c.getContext('2d');
    const r = rand(1234);
    g.fillStyle = theme.a;
    g.fillRect(0, 0, W * S, H * S);
    const grain = (x0, y0, w, h, vertical, n = 4) => {
      g.strokeStyle = 'rgba(0,0,0,0.07)';
      g.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        g.beginPath();
        if (vertical) {
          const gx = x0 + 3 + r() * (w - 6);
          g.moveTo(gx, y0);
          g.bezierCurveTo(gx + (r() - 0.5) * 4, y0 + h * 0.3, gx + (r() - 0.5) * 4, y0 + h * 0.7, gx, y0 + h);
        } else {
          const gy = y0 + 3 + r() * (h - 6);
          g.moveTo(x0, gy);
          g.bezierCurveTo(x0 + w * 0.3, gy + (r() - 0.5) * 4, x0 + w * 0.7, gy + (r() - 0.5) * 4, x0 + w, gy);
        }
        g.stroke();
      }
    };
    const seam = (x, y, w, h, a = 0.35) => {
      g.fillStyle = theme.line;
      g.globalAlpha = a;
      g.fillRect(x, y, w, h);
      g.globalAlpha = 1;
    };

    if (style === 'parquet' || style === 'herringbone') {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const vertical = (x + y) % 2 === 0;
          for (let k = 0; k < 4; k++) {
            const tone = shade((k + x + y) % 2 ? theme.a : theme.b, (r() - 0.5) * 0.08);
            g.fillStyle = tone;
            if (vertical) {
              g.fillRect(x * S + k * (S / 4), y * S, S / 4, S);
              grain(x * S + k * (S / 4), y * S, S / 4, S, true, 2);
              seam(x * S + k * (S / 4), y * S, 1, S, 0.18);
            } else {
              g.fillRect(x * S, y * S + k * (S / 4), S, S / 4);
              grain(x * S, y * S + k * (S / 4), S, S / 4, false, 2);
              seam(x * S, y * S + k * (S / 4), S, 1, 0.18);
            }
          }
        }
      }
    } else if (style === 'tiles' || style === 'tile') {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const base = shade(theme.a, (r() - 0.5) * 0.06 + ((x * 7 + y * 3) % 5 === 0 ? 0.03 : 0));
          g.fillStyle = base;
          g.fillRect(x * S, y * S, S, S);
          // 아주 옅은 베벨 음영 (선이 아니라 면의 밝기 차이)
          const gr = g.createLinearGradient(x * S, y * S, x * S + S, y * S + S);
          gr.addColorStop(0, 'rgba(255,255,255,0.045)');
          gr.addColorStop(1, 'rgba(0,0,0,0.06)');
          g.fillStyle = gr;
          g.fillRect(x * S, y * S, S, S);
          for (let i = 0; i < 10; i++) {
            g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
            g.fillRect(x * S + r() * S, y * S + r() * S, 1.5, 1.5);
          }
        }
      }
    } else if (style === 'deck') {
      for (let x = 0; x < W * 4; x++) {
        let y = -Math.floor(r() * 2);
        while (y < H) {
          const len = 2 + Math.floor(r() * 2);
          const tone = shade(x % 2 ? theme.a : theme.b, (r() - 0.5) * 0.1);
          g.fillStyle = tone;
          g.fillRect(x * (S / 4), y * S, S / 4, len * S);
          grain(x * (S / 4), y * S, S / 4, len * S, true, 3);
          seam(x * (S / 4) + S / 4 - 1.5, y * S, 1.5, len * S, 0.45);
          seam(x * (S / 4), y * S, S / 4, 1.5, 0.4);
          y += len;
        }
      }
    } else {
      // planks: 칸마다 판자 2줄, 판자 길이 2~3칸 — 이음매가 칸 경계에서 엇갈린다
      for (let row = 0; row < H * 2; row++) {
        let x = -Math.floor(r() * 3);
        while (x < W) {
          const len = 2 + Math.floor(r() * 2);
          const tone = shade(row % 2 ? theme.a : theme.b, (r() - 0.5) * 0.09);
          g.fillStyle = tone;
          g.fillRect(x * S, row * (S / 2), len * S, S / 2);
          grain(x * S, row * (S / 2), len * S, S / 2, false, 5);
          seam(x * S, row * (S / 2), len * S, 1.5, 0.4);
          seam(x * S, row * (S / 2), 1.5, S / 2, 0.45);
          y0Nail(g, x * S + 5, row * (S / 2) + S / 4, theme.line);
          x += len;
        }
      }
    }

    // 빛 웅덩이 — 램프 아래처럼 따뜻한 원 (칸 위치를 읽는 단서)
    const pools = [
      [W / 2, H / 2, 3.2],
      [W * 0.22, H * 0.25, 2.2],
      [W * 0.78, H * 0.25, 2.2],
      [W * 0.22, H * 0.75, 2.2],
      [W * 0.78, H * 0.75, 2.2],
    ];
    g.globalCompositeOperation = 'lighter';
    for (const [px, py, pr] of pools) {
      const gr = g.createRadialGradient(px * S, py * S, 0, px * S, py * S, pr * S);
      gr.addColorStop(0, 'rgba(255,190,120,0.1)');
      gr.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W * S, H * S);
    }
    g.globalCompositeOperation = 'source-over';
    // 가장자리 비네트 (방 구석은 조금 어둡게)
    const v = g.createRadialGradient((W * S) / 2, (H * S) / 2, Math.min(W, H) * S * 0.3, (W * S) / 2, (H * S) / 2, Math.max(W, H) * S * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = v;
    g.fillRect(0, 0, W * S, H * S);
    const t = toTexture(c);
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4;
    return t;
  });
}

function y0Nail(g, x, y, col) {
  g.fillStyle = col;
  g.globalAlpha = 0.35;
  g.beginPath();
  g.arc(x, y, 1.2, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

// ── 러그 ─────────────────────────────────────────
// 러그 — 칸 수에 맞춘 비율. 칸마다 작은 마름모 문양이 있어 격자선 없이도 칸이 읽힌다
export function rugTexture(color, trim, cw = 4, ch = 4, kind = 'rug') {
  return cached(`rug-${color}-${trim}-${cw}-${ch}-${kind}`, () => {
    const S = 96;
    const Wp = Math.max(1, cw) * S;
    const Hp = Math.max(1, ch) * S;
    const c = canvas(Wp, Hp);
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.fillRect(0, 0, Wp, Hp);
    g.strokeStyle = trim;
    g.lineWidth = 10;
    g.strokeRect(10, 10, Wp - 20, Hp - 20);
    g.lineWidth = 3;
    g.strokeRect(26, 26, Wp - 52, Hp - 52);
    // 칸마다 마름모 문양
    g.globalAlpha = 0.32;
    g.fillStyle = trim;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const cx = x * S + S / 2;
        const cy = y * S + S / 2;
        g.beginPath();
        g.moveTo(cx, cy - 13);
        g.lineTo(cx + 13, cy);
        g.lineTo(cx, cy + 13);
        g.lineTo(cx - 13, cy);
        g.closePath();
        g.fill();
      }
    }
    if (kind !== 'runner') {
      g.globalAlpha = 0.3;
      g.lineWidth = 4;
      const R = Math.min(Wp, Hp) / 2 - 40;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(Wp / 2, Hp / 2, R * (0.3 + i * 0.175), 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.globalAlpha = 0.16;
    for (let i = 0; i < cw * ch * 40; i++) g.fillRect(Math.random() * Wp, Math.random() * Hp, 2, 2);
    g.globalAlpha = 1;
    return toTexture(c);
  });
}

// ── LP 홈(groove) ────────────────────────────────
export function grooveTexture(label = '#ff5a4f', size = 256) {
  return cached(`groove-${label}-${size}`, () => {
    const c = canvas(size, size);
    const g = c.getContext('2d');
    const m = size / 2;
    g.fillStyle = '#0b0b0e';
    g.beginPath();
    g.arc(m, m, m, 0, Math.PI * 2);
    g.fill();
    for (let r = m * 0.36; r < m * 0.97; r += 2.2) {
      g.strokeStyle = `rgba(255,255,255,${0.03 + ((r * 7) % 5) * 0.012})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(m, m, r, 0, Math.PI * 2);
      g.stroke();
    }
    // 반사광
    const grad = g.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0.35, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(m, m, m * 0.97, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = label;
    g.beginPath();
    g.arc(m, m, m * 0.33, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.arc(m, m, m * 0.25, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0b0b0e';
    g.beginPath();
    g.arc(m, m, m * 0.05, 0, Math.PI * 2);
    g.fill();
    return toTexture(c);
  });
}

// ── 체크무늬 셔츠 (Mr. ODD) ───────────────────────
export function plaidTexture(base = '#b3122a', line = '#2a0a10') {
  return cached(`plaid-${base}`, () => {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.55;
    g.fillStyle = line;
    for (let i = 0; i < 256; i += 64) {
      g.fillRect(i, 0, 18, 256);
      g.fillRect(0, i, 256, 18);
    }
    g.globalAlpha = 0.25;
    g.fillStyle = '#ffffff';
    for (let i = 32; i < 256; i += 64) {
      g.fillRect(i, 0, 3, 256);
      g.fillRect(0, i, 256, 3);
    }
    g.globalAlpha = 1;
    const t = toTexture(c, { repeat: true });
    t.repeat.set(2, 2);
    return t;
  });
}

// ── 범용 원형 글로우 ─────────────────────────────
export function glowTexture() {
  return cached('glow', () => {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return toTexture(c);
  });
}

// ── Sound Wave 링 ───────────────────────────────
export function ringTexture() {
  return cached('ring', () => {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 4; i++) {
      g.lineWidth = 6 - i;
      g.beginPath();
      g.arc(128, 128, 36 + i * 24, 0, Math.PI * 2);
      g.stroke();
    }
    return toTexture(c);
  });
}

// ── 이퀄라이저 스트립 (Wave 팔) ─────────────────
export function eqTexture() {
  return cached('eq', () => {
    const c = canvas(64, 256);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 64, 10);
    const t = toTexture(c, { repeat: true });
    return t;
  });
}

// ── 음표 (Beat Bomb 라벨) ───────────────────────
export function noteTexture(color = '#ffb347') {
  return cached(`note-${color}`, () => {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, color);
    grad.addColorStop(1, '#3a1400');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff6e0';
    g.beginPath();
    g.ellipse(50, 86, 15, 11, -0.4, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(84, 78, 15, 11, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(60, 30, 7, 56);
    g.fillRect(94, 22, 7, 56);
    g.beginPath();
    g.moveTo(60, 30);
    g.lineTo(101, 22);
    g.lineTo(101, 34);
    g.lineTo(60, 42);
    g.fill();
    return toTexture(c);
  });
}

// ── Sound Wave 파형 (바닥에 깔리는 얇은 waveform 라인) ─────────
export function waveformTexture() {
  return cached('waveform', () => {
    const c = canvas(512, 64);
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 64);
    const line = (amp, freq, width, alpha, phase) => {
      g.strokeStyle = `rgba(255,255,255,${alpha})`;
      g.lineWidth = width;
      g.beginPath();
      for (let x = 0; x <= 512; x += 2) {
        const env = 0.55 + 0.45 * Math.sin((x / 512) * Math.PI * 4);
        const y = 32 + Math.sin((x / 512) * Math.PI * 2 * freq + phase) * amp * env + Math.sin((x / 512) * Math.PI * 2 * freq * 3.1) * amp * 0.25;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    };
    line(17, 6, 7, 0.22, 0);
    line(17, 6, 2.6, 1, 0);
    line(9, 12, 1.4, 0.55, 1.3);
    // 아주 얇은 EQ 눈금
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 4; x < 512; x += 16) {
      const h = 4 + Math.abs(Math.sin(x * 0.13)) * 14;
      g.fillRect(x, 32 - h / 2, 2, h);
    }
    return toTexture(c, { repeat: true });
  });
}

// ── 음표 글리프 (♪ ♫ 스프라이트) ───────────────────
export function glyphTexture(ch = '♫', color = '#ffffff') {
  return cached(`glyph-${ch}-${color}`, () => {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    g.font = 'bold 96px "DejaVu Sans", "Segoe UI Symbol", "Apple Symbols", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(ch, 64, 70);
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.fillText(ch, 64, 70);
    return toTexture(c);
  });
}

// ── LP 홈 링 (Wave 바닥 타일: 레코드 홈 동심원) ──────────
export function grooveRingTexture() {
  return cached('groove-ring', () => {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 6, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = `rgba(255,255,255,${i % 3 === 0 ? 0.9 : 0.35})`;
      g.lineWidth = i % 3 === 0 ? 3 : 1.2;
      g.beginPath();
      g.arc(128, 128, 22 + i * 11, 0, Math.PI * 2);
      g.stroke();
    }
    return toTexture(c);
  });
}

// ── 벽지 ─────────────────────────────────────────
export function wallpaperTexture(color, accent, style = 'damask') {
  return cached(`wall-${color}-${accent}-${style}`, () => {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.12;
    g.fillStyle = accent;
    if (style === 'damask') {
      for (let y = 0; y < 256; y += 64) {
        for (let x = (y / 64) % 2 ? 32 : 0; x < 256; x += 64) {
          g.beginPath();
          g.ellipse(x + 16, y + 32, 10, 20, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    } else if (style === 'stripe') {
      for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 10, 256);
    } else if (style === 'foam') {
      g.globalAlpha = 0.3;
      for (let y = 0; y < 256; y += 32) {
        for (let x = 0; x < 256; x += 32) {
          g.fillStyle = (x + y) % 64 ? '#000' : accent;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + 32, y + 16);
          g.lineTo(x, y + 32);
          g.fill();
        }
      }
    } else if (style === 'brick') {
      g.globalAlpha = 0.18;
      g.fillStyle = '#000';
      for (let y = 0; y < 256; y += 32) {
        g.fillRect(0, y, 256, 3);
        for (let x = (y / 32) % 2 ? 0 : 32; x < 256; x += 64) g.fillRect(x, y, 3, 32);
      }
    }
    g.globalAlpha = 1;
    const t = toTexture(c, { repeat: true });
    return t;
  });
}

// ── LP 책등 (선반) ──────────────────────────────
export function spinesTexture(seed = 1) {
  return cached(`spines-${seed}`, () => {
    const c = canvas(256, 128);
    const g = c.getContext('2d');
    const r = rand(seed * 99 + 7);
    const pal = ['#d94b3d', '#f2c14e', '#3d8bd9', '#2fa37c', '#ececec', '#9a66ff', '#f28c38', '#1c1c22', '#c94f7c'];
    g.fillStyle = '#1a0f0a';
    g.fillRect(0, 0, 256, 128);
    let x = 0;
    while (x < 256) {
      const w = 4 + Math.floor(r() * 7);
      g.fillStyle = pal[Math.floor(r() * pal.length)];
      g.fillRect(x, 6 + r() * 10, w - 1, 128);
      x += w;
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, 256, 10);
    return toTexture(c);
  });
}

// ── 텍스트 라벨 / 네온 사인 ─────────────────────
export function labelTexture(text, { color = '#fff', bg = null, font = 'bold 64px sans-serif', w = 512, h = 128, glow = null } = {}) {
  return cached(`label-${text}-${color}-${bg}-${font}-${w}-${h}-${glow}`, () => {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (glow) {
      g.shadowColor = glow;
      g.shadowBlur = 24;
    }
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 4);
    return toTexture(c);
  });
}

// ── 화살표 (바람 / Rolling LP 경고) ─────────────
export function arrowTexture() {
  return cached('arrow', () => {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(20, 40);
    g.lineTo(70, 40);
    g.lineTo(70, 18);
    g.lineTo(112, 64);
    g.lineTo(70, 110);
    g.lineTo(70, 88);
    g.lineTo(20, 88);
    g.closePath();
    g.fill();
    return toTexture(c);
  });
}

// ── 경고 타일 (빗금) ────────────────────────────
export function hazardTexture() {
  return cached('hazard', () => {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = -128; i < 256; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 16, 0);
      g.lineTo(i + 16 + 128, 128);
      g.lineTo(i + 128, 128);
      g.fill();
    }
    g.strokeStyle = '#fff';
    g.lineWidth = 8;
    g.strokeRect(4, 4, 120, 120);
    return toTexture(c);
  });
}

// ── 아이템 아이콘 ───────────────────────────────
export function itemIconTexture(type, color) {
  return cached(`icon-${type}`, () => {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 110, 10, 128, 128, 128);
    grad.addColorStop(0, shade(color, 0.15));
    grad.addColorStop(1, shade(color, -0.25));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(128, 128, 124, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.arc(128, 128, 114, 0, Math.PI * 2);
    g.stroke();
    g.save();
    g.translate(128, 128);
    drawIcon(g, type);
    g.restore();
    return toTexture(c);
  });
}

export function drawIcon(g, type) {
  const W = '#fffaf0';
  const D = '#1b1b22';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  switch (type) {
    case 'speedUp': {
      // 운동화 + 속도선
      g.fillStyle = W;
      g.beginPath();
      g.moveTo(-60, 30);
      g.lineTo(-50, -20);
      g.lineTo(-10, -20);
      g.quadraticCurveTo(20, 10, 70, 14);
      g.quadraticCurveTo(80, 30, 66, 40);
      g.lineTo(-60, 40);
      g.closePath();
      g.fill();
      g.fillStyle = D;
      g.fillRect(-62, 34, 132, 10);
      g.strokeStyle = W;
      g.lineWidth = 8;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-92, -30 + i * 22);
        g.lineTo(-70, -30 + i * 22);
        g.stroke();
      }
      break;
    }
    case 'bombUp': {
      g.fillStyle = D;
      g.beginPath();
      g.arc(-6, 14, 48, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffb347';
      g.beginPath();
      g.arc(-6, 14, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = W;
      g.font = 'bold 72px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('+', 58, -48);
      break;
    }
    case 'waveUp': {
      g.strokeStyle = W;
      for (let i = 0; i < 3; i++) {
        g.lineWidth = 12 - i * 2;
        g.beginPath();
        g.arc(0, 0, 24 + i * 26, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = W;
      g.beginPath();
      g.arc(0, 0, 12, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'kick': {
      g.fillStyle = W;
      g.beginPath();
      g.moveTo(-40, -70);
      g.lineTo(-6, -70);
      g.lineTo(-6, 10);
      g.quadraticCurveTo(40, 14, 62, 30);
      g.quadraticCurveTo(70, 54, 44, 58);
      g.lineTo(-44, 58);
      g.closePath();
      g.fill();
      g.fillStyle = D;
      g.beginPath();
      g.arc(80, -20, 22, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'glove': {
      g.fillStyle = W;
      g.beginPath();
      g.ellipse(-20, 20, 44, 52, -0.3, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.ellipse(-50 + i * 20, -42, 9, 22, -0.2, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = W;
      g.lineWidth = 8;
      g.setLineDash([12, 12]);
      g.beginPath();
      g.arc(40, 0, 60, -2.4, -0.6);
      g.stroke();
      g.setLineDash([]);
      break;
    }
    case 'shield': {
      g.fillStyle = W;
      g.beginPath();
      g.moveTo(0, -78);
      g.lineTo(62, -54);
      g.quadraticCurveTo(60, 40, 0, 80);
      g.quadraticCurveTo(-60, 40, -62, -54);
      g.closePath();
      g.fill();
      g.fillStyle = '#7f9bff';
      g.beginPath();
      g.moveTo(0, -56);
      g.lineTo(40, -40);
      g.quadraticCurveTo(38, 26, 0, 56);
      g.closePath();
      g.fill();
      break;
    }
    case 'remote': {
      g.fillStyle = D;
      g.beginPath();
      g.roundRect(-34, -70, 68, 140, 16);
      g.fill();
      g.fillStyle = '#ff5a8a';
      g.beginPath();
      g.arc(0, -36, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = W;
      for (let i = 0; i < 3; i++) g.fillRect(-18, 0 + i * 20, 36, 10);
      g.strokeStyle = W;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(0, -70, 30, -2.5, -0.64);
      g.stroke();
      break;
    }
    case 'rollerSkates': {
      g.fillStyle = W;
      g.beginPath();
      g.moveTo(-60, 10);
      g.lineTo(-50, -50);
      g.lineTo(-10, -50);
      g.quadraticCurveTo(10, -10, 60, -4);
      g.quadraticCurveTo(74, 14, 58, 24);
      g.lineTo(-60, 24);
      g.closePath();
      g.fill();
      g.fillStyle = D;
      for (const x of [-40, 0, 40]) {
        g.beginPath();
        g.arc(x, 44, 16, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'needle': {
      // 캡슐을 터뜨리는 바늘 + 버블
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(-22, 22, 46, 0, Math.PI * 2);
      g.stroke();
      g.save();
      g.rotate(-Math.PI / 4);
      g.fillStyle = W;
      g.fillRect(-8, -80, 16, 110);
      g.beginPath();
      g.moveTo(-8, 30);
      g.lineTo(8, 30);
      g.lineTo(0, 78);
      g.closePath();
      g.fill();
      g.fillStyle = '#c8102e';
      g.beginPath();
      g.arc(0, -86, 16, 0, Math.PI * 2);
      g.fill();
      g.restore();
      break;
    }
    case 'randomBox': {
      g.fillStyle = W;
      g.font = 'bold 150px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', 0, 10);
      break;
    }
    default:
      break;
  }
}

// HUD 용 dataURL 아이콘
export function itemIconDataURL(type, color) {
  const tex = itemIconTexture(type, color);
  return tex.image.toDataURL();
}
