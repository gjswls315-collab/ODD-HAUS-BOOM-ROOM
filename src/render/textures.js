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
export function floorTexture(theme, W, H, style = 'wood') {
  return cached(`floor-${theme.a}-${W}-${H}-${style}`, () => {
    const S = 64;
    const c = canvas(W * S, H * S);
    const g = c.getContext('2d');
    const r = rand(1234);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = (x + y) % 2 === 0 ? theme.a : theme.b;
        g.fillStyle = base;
        g.fillRect(x * S, y * S, S, S);
        if (style === 'wood') {
          // 셀당 판자 2장
          for (let k = 0; k < 2; k++) {
            const py = y * S + k * (S / 2);
            g.fillStyle = shade(base, (r() - 0.5) * 0.05);
            g.fillRect(x * S, py, S, S / 2);
            g.strokeStyle = 'rgba(0,0,0,0.08)';
            for (let i = 0; i < 4; i++) {
              g.beginPath();
              const gy = py + 4 + r() * (S / 2 - 8);
              g.moveTo(x * S, gy);
              g.bezierCurveTo(x * S + S * 0.3, gy + (r() - 0.5) * 4, x * S + S * 0.7, gy + (r() - 0.5) * 4, x * S + S, gy);
              g.stroke();
            }
            g.fillStyle = theme.line;
            g.globalAlpha = 0.55;
            g.fillRect(x * S, py, S, 1.5);
            g.globalAlpha = 1;
          }
        } else if (style === 'tile') {
          g.fillStyle = shade(base, (r() - 0.5) * 0.04);
          g.fillRect(x * S + 2, y * S + 2, S - 4, S - 4);
        } else if (style === 'deck') {
          for (let k = 0; k < 4; k++) {
            g.fillStyle = shade(base, (r() - 0.5) * 0.07);
            g.fillRect(x * S + k * (S / 4), y * S, S / 4 - 2, S);
          }
        }
        g.strokeStyle = theme.line;
        g.globalAlpha = 0.45;
        g.lineWidth = 2;
        g.strokeRect(x * S + 1, y * S + 1, S - 2, S - 2);
        g.globalAlpha = 1;
      }
    }
    const t = toTexture(c);
    t.magFilter = THREE.LinearFilter;
    return t;
  });
}

// ── 러그 ─────────────────────────────────────────
export function rugTexture(color, trim) {
  return cached(`rug-${color}-${trim}`, () => {
    const c = canvas(512, 512);
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = trim;
    g.lineWidth = 14;
    g.strokeRect(18, 18, 476, 476);
    g.lineWidth = 4;
    g.strokeRect(46, 46, 420, 420);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(256, 256, 40 + i * 30, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 0.18;
    g.fillStyle = trim;
    for (let i = 0; i < 400; i++) g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
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
    case 'throw': {
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
    case 'speedShoes': {
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
