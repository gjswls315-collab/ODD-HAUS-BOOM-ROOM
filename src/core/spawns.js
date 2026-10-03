import { CELL } from '../config/stageConfig.js';

// ─────────────────────────────────────────────────────────────
// 랜덤 시작 위치 — 매 경기 다른 곳에서 시작 (같은 시드 = 같은 배치)
//
// 규칙
//   - 빈 칸(EMPTY)만, 기믹 칸 / DJ 턴테이블 링 위는 제외
//   - 시작 칸에서 수직인 두 방향으로 2칸씩(L자) 벽이 없어야 한다 → 그 칸의 상자는 치운다
//     (시작하자마자 자기 폭탄에 갇히지 않도록 — 고정 맵의 모서리 시작과 같은 여유)
//   - 플레이어끼리는 가능한 한 멀리 (맵 크기에 비례한 최소 거리, 안 되면 가장 먼 곳)
//   - avoid(x, y) 가 true 인 칸(중앙 전투 구역)은 시작 위치로 쓰지 않는다
// ─────────────────────────────────────────────────────────────

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function pickRandomSpawns(grid, rng, count, { minDist, avoid } = {}) {
  const W = grid.width;
  const H = grid.height;
  const key = (x, y) => y * W + x;

  // 턴테이블 링(회전하는 칸)은 시작 위치 / 여유 칸으로 쓰지 않는다
  const banned = new Set();
  for (const c of grid.cells) {
    if (!c.turntable) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) banned.add(key(c.x + dx, c.y + dy));
  }
  const open = (x, y) => {
    const c = grid.get(x, y);
    return !!c && !c.border && !c.gimmick && !banned.has(key(x, y)) && (c.type === CELL.EMPTY || c.type === CELL.BREAKABLE);
  };

  // 상자를 부수면 서로 닿을 수 있는 영역만 사용 (가구로 완전히 막힌 칸 제외)
  const seed = grid.spawns.find(Boolean) || grid.cells.find((c) => c.type === CELL.EMPTY && !c.border);
  const region = new Set([key(seed.x, seed.y)]);
  const queue = [seed];
  while (queue.length) {
    const c = queue.pop();
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx;
      const y = c.y + dy;
      const k = key(x, y);
      if (region.has(k) || !open(x, y)) continue;
      region.add(k);
      queue.push({ x, y });
    }
  }

  const candidates = [];
  for (const c of grid.cells) {
    if (c.type !== CELL.EMPTY || !region.has(key(c.x, c.y)) || !open(c.x, c.y)) continue;
    if (avoid && avoid(c.x, c.y)) continue; // 중앙 전투 구역에서는 시작하지 않는다
    const ls = [];
    for (const [ax, ay] of DIRS) {
      for (const [bx, by] of DIRS) {
        if (ax * bx + ay * by !== 0 || (ax === bx && ay === by)) continue;
        if (ax === 0 && bx !== 0) continue; // 같은 L 을 두 번 세지 않도록 (가로축 먼저)
        const cells = [
          [c.x + ax, c.y + ay],
          [c.x + 2 * ax, c.y + 2 * ay],
          [c.x + bx, c.y + by],
          [c.x + 2 * bx, c.y + 2 * by],
        ];
        if (cells.every(([x, y]) => open(x, y))) ls.push(cells);
      }
    }
    if (ls.length) candidates.push({ x: c.x, y: c.y, ls });
  }
  if (candidates.length < count) return null;

  const target = minDist ?? Math.round((W + H) / 3.2);
  const chosen = [];
  for (let n = 0; n < count; n++) {
    let best = null;
    let bestScore = -Infinity;
    for (const c of candidates) {
      if (chosen.some((s) => s.x === c.x && s.y === c.y)) continue;
      const d = chosen.length ? Math.min(...chosen.map((s) => Math.abs(s.x - c.x) + Math.abs(s.y - c.y))) : W + H;
      // 최소 거리를 만족하는 칸들 중에서는 무작위, 아니면 먼 칸 우선
      const score = (d >= target ? 1000 : d * 20) + rng.next() * 100;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    chosen.push(best);
  }

  // 각 시작 위치의 L자 여유 칸에 있는 상자를 치운다 (드랍 없음)
  //   clear = 이 시작 위치에서 비워 둔 칸 (아래 fillBreakables 가 다시 채우지 않음)
  return chosen.map((s) => {
    const cells = s.ls[Math.floor(rng.next() * s.ls.length)];
    for (const [x, y] of cells) if (grid.get(x, y).type === CELL.BREAKABLE) grid.destroyBreakable(x, y);
    return { x: s.x, y: s.y, clear: cells.map(([x, y]) => ({ x, y })) };
  });
}

// ─────────────────────────────────────────────────────────────
// 시작 상태 BREAKABLE 보충 — 구역별 배치 (총 수량은 유지, 위치만 나눈다)
//
//   SPAWN FARM ZONE      : 각 시작 위치에서 2~3칸 거리 → 상자 farm[0]~farm[1] 개 (기본 5~7)
//                          시작하자마자 부술 상자가 있고, 너무 많아 갇히지도 않는다
//   SIDE LOOT ZONE       : 맵 가장자리 띠(zones.side 칸) → 촘촘 (아이템 파밍 구역)
//   CENTRAL COMBAT ZONE  : 맵 중앙 (zones.center = [가로 반경, 세로 반경]) → 드문드문 (전투 공간)
//   그 외 (MID)          : 보통
//
//   startFill = { zones: { center: [rx, ry], side: n }, density: { center, side, mid }, farm: [min, max] }
//   (예전 형식 { density: 0.35, nearSpawn: 6 } 도 그대로 동작 — 구역 없이 균일)
//   판정은 모두 공통 BREAKABLE, 비주얼만 stage.breakables 에서 고른다
// ─────────────────────────────────────────────────────────────
export const FILL_ZONE = { CENTER: 'center', SIDE: 'side', MID: 'mid' };

export function fillZoneOf(grid, x, y, zones) {
  if (!zones) return FILL_ZONE.MID;
  const cx = (grid.width - 1) / 2;
  const cy = (grid.height - 1) / 2;
  const [rx, ry] = zones.center || [0, 0];
  if (Math.abs(x - cx) <= rx && Math.abs(y - cy) <= ry) return FILL_ZONE.CENTER;
  const band = zones.side ?? 0;
  const edge = Math.min(x, y, grid.width - 1 - x, grid.height - 1 - y); // 테두리 = 0
  if (edge <= band) return FILL_ZONE.SIDE;
  return FILL_ZONE.MID;
}

export function fillBreakables(grid, rng, spawns, cfg = {}, props = ['box']) {
  const W = grid.width;
  const key = (x, y) => y * W + x;
  const zones = cfg.zones || null;
  const dens = typeof cfg.density === 'object' ? cfg.density : { center: cfg.density ?? 0.35, side: cfg.density ?? 0.35, mid: cfg.density ?? 0.35 };
  const [farmMin, farmMax] = cfg.farm || [cfg.nearSpawn ?? 6, Infinity];
  const farmBand = cfg.farm ? [2, 3] : [2, 4];

  const keep = new Set();
  for (const s of spawns) {
    keep.add(key(s.x, s.y));
    for (const c of s.clear || []) keep.add(key(c.x, c.y));
  }
  const fillable = (c) => c.type === CELL.EMPTY && !c.border && !c.gimmick && !keep.has(key(c.x, c.y));
  const put = (c) => grid.setBreakable(c.x, c.y, props[Math.floor(rng.next() * props.length)], true);
  let added = 0;
  for (const c of grid.cells) {
    if (fillable(c) && rng.next() < dens[fillZoneOf(grid, c.x, c.y, zones)]) {
      put(c);
      added++;
    }
  }

  // SPAWN FARM ZONE — 시작 위치마다 farmMin~farmMax 개
  for (const s of spawns) {
    const dist = (c) => Math.abs(c.x - s.x) + Math.abs(c.y - s.y);
    const band = grid.cells.filter((c) => dist(c) >= farmBand[0] && dist(c) <= farmBand[1]);
    const boxes = band.filter((c) => c.type === CELL.BREAKABLE);
    let have = boxes.length;
    const want = farmMin + Math.floor(rng.next() * (Math.min(farmMax, farmMin + 2) - farmMin + 1));
    if (have < farmMin) {
      // 2~3칸 안이 가구로 막혀 자리가 없으면 4칸 거리까지 넓혀 채운다
      const outer = grid.cells.filter((c) => dist(c) === farmBand[1] + 1 && fillable(c));
      const free = [...rng.shuffle(outer), ...rng.shuffle(band.filter(fillable))];
      while (have < want && free.length) {
        put(free.pop());
        have++;
        added++;
      }
    } else if (have > farmMax) {
      // 너무 빽빽하면 가까운 칸(2칸 거리)부터 덜어낸다 — 시작 직후 움직일 공간 (맵에 그려 둔 B 는 유지)
      const extra = rng.shuffle(boxes.filter((c) => c.char !== 'B')).sort((a, b) => dist(a) - dist(b));
      while (have > farmMax && extra.length) {
        const c = extra.shift();
        grid.destroyBreakable(c.x, c.y);
        have--;
        added--;
      }
    }
  }
  grid.version = 0;
  return added;
}
