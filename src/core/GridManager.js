import { CELL, legendFor } from '../config/stageConfig.js';

// 논리 그리드 — 3D 그래픽과 완전히 분리된다.
// cell = { x, y, type, prop, group, gimmick, ring, routeCrate, amp, light, movable }
//   gimmick = { kind, solid, open?, ... } (GIMMICK 셀만)
// group  = 여러 칸짜리 가구(소파, 선반 등)를 하나의 오브젝트로 묶는 id (렌더 / House Event 이동용)

const MERGE_EXCLUDE = new Set(['wall']);

export class GridManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height);
    this.spawns = [];
    this.groups = new Map();
    this.nextGroupId = 1;
    this.version = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.cells[y * width + x] = makeCell(x, y, { type: CELL.EMPTY });
      }
    }
  }

  // stage config 의 map 문자열 → 그리드 (rng 로 randomFill)
  static fromStage(stageDef, rng) {
    const legend = legendFor(stageDef);
    const rows = stageDef.map;
    const grid = new GridManager(rows[0].length, rows.length);
    const spawnSlots = [];
    const charAt = (x, y) => rows[y][x];

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const ch = charAt(x, y);
        const def = legend[ch];
        if (!def) throw new Error(`Stage ${stageDef.id}: unknown map char '${ch}' at ${x},${y}`);
        const cell = makeCell(x, y, def);
        cell.char = ch;
        grid.cells[y * grid.width + x] = cell;
        if (def.spawn !== undefined) spawnSlots[def.spawn] = { x, y };
      }
    }
    grid.spawns = spawnSlots;

    // 여러 칸 가구 그룹화 (같은 문자 + 인접)
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const cell = grid.get(x, y);
        if (cell.group || !cell.prop || MERGE_EXCLUDE.has(cell.prop)) continue;
        if (cell.type === CELL.BREAKABLE || cell.type === CELL.GIMMICK) {
          grid._newGroup(cell.prop, [cell], { movable: false });
          continue;
        }
        // flood fill same char
        const members = [];
        const stack = [cell];
        cell.group = -1;
        while (stack.length) {
          const c = stack.pop();
          members.push(c);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = grid.get(c.x + dx, c.y + dy);
            if (n && !n.group && n.char === cell.char && n.type === cell.type) {
              n.group = -1;
              stack.push(n);
            }
          }
        }
        grid._newGroup(cell.prop, members, { movable: !!cell.movable });
      }
    }

    // randomFill
    const fill = stageDef.randomFill;
    if (fill && rng) {
      for (const cell of grid.cells) {
        if (!cell.randomFill || cell.type !== CELL.EMPTY) continue;
        const nearSpawn = grid.spawns.some((s) => Math.abs(s.x - cell.x) + Math.abs(s.y - cell.y) <= 1);
        if (nearSpawn) continue;
        if (rng.next() < fill.density) {
          grid.setBreakable(cell.x, cell.y, rng.pick(fill.props), true);
        }
      }
    }
    grid.version = 0;
    return grid;
  }

  _newGroup(prop, members, { movable }) {
    const id = this.nextGroupId++;
    for (const c of members) c.group = id;
    this.groups.set(id, {
      id,
      prop,
      movable,
      cells: members.map((c) => ({ x: c.x, y: c.y })),
    });
    return id;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y * this.width + x];
  }

  // 이동을 막는 칸인가 (폭탄/플레이어 제외 — 그리드 자체 규칙만)
  isSolid(x, y) {
    const c = this.get(x, y);
    if (!c) return true;
    if (c.type === CELL.SOLID || c.type === CELL.BREAKABLE) return true;
    if (c.type === CELL.GIMMICK && c.gimmick && c.gimmick.solid) return true;
    return false;
  }

  isWalkable(x, y) {
    return !this.isSolid(x, y);
  }

  // Sound Wave 전파 판정: 'block'(SOLID, 멈춤) | 'destroy'(BREAKABLE, 파괴 후 멈춤) | 'pass'
  waveInteraction(x, y) {
    const c = this.get(x, y);
    if (!c) return 'block';
    if (c.type === CELL.SOLID) return 'block';
    if (c.type === CELL.BREAKABLE) return 'destroy';
    if (c.type === CELL.GIMMICK && c.gimmick && c.gimmick.solid) return 'block';
    return 'pass';
  }

  setBreakable(x, y, prop, silent = false) {
    const c = this.get(x, y);
    if (!c) return null;
    this._detachFromGroup(c);
    c.type = CELL.BREAKABLE;
    c.prop = prop;
    c.gimmick = null;
    c.routeCrate = false;
    c.movable = false;
    this._newGroup(prop, [c], { movable: false });
    if (!silent) this.version++;
    return c.group;
  }

  // BREAKABLE 파괴 → EMPTY. 파괴 전 셀 정보(복사본)를 반환
  destroyBreakable(x, y) {
    const c = this.get(x, y);
    if (!c || c.type !== CELL.BREAKABLE) return null;
    const before = { ...c };
    this._detachFromGroup(c);
    c.type = CELL.EMPTY;
    c.prop = null;
    c.routeCrate = false;
    this.version++;
    return before;
  }

  setEmpty(x, y) {
    const c = this.get(x, y);
    if (!c) return;
    this._detachFromGroup(c);
    c.type = CELL.EMPTY;
    c.prop = null;
    c.gimmick = null;
    c.routeCrate = false;
    c.movable = false;
    c.light = false;
    this.version++;
  }

  _detachFromGroup(c) {
    if (!c.group) return;
    const g = this.groups.get(c.group);
    if (g) {
      g.cells = g.cells.filter((p) => !(p.x === c.x && p.y === c.y));
      if (g.cells.length === 0) this.groups.delete(c.group);
    }
    c.group = 0;
  }

  // 가구 그룹을 (dx,dy) 만큼 이동. 목적지 검증은 호출자 책임.
  moveGroup(groupId, dx, dy) {
    const g = this.groups.get(groupId);
    if (!g) return false;
    const snapshots = g.cells.map((p) => {
      const c = this.get(p.x, p.y);
      return { from: { x: p.x, y: p.y }, data: extractContent(c) };
    });
    for (const s of snapshots) clearContent(this.get(s.from.x, s.from.y));
    for (const s of snapshots) {
      const t = this.get(s.from.x + dx, s.from.y + dy);
      applyContent(t, s.data);
      t.group = groupId;
    }
    g.cells = g.cells.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    this.version++;
    return true;
  }

  // 셀 내용(BREAKABLE 등)을 다른 셀로 옮김 — 턴테이블 회전용 (permutation)
  permuteContents(positions) {
    // positions: [{x,y}] — i 번째 내용이 i+1 번째 칸으로 이동 (순환)
    const datas = positions.map((p) => {
      const c = this.get(p.x, p.y);
      return { data: extractContent(c), group: c.group };
    });
    positions.forEach((p) => clearContent(this.get(p.x, p.y)));
    const n = positions.length;
    for (let i = 0; i < n; i++) {
      const to = positions[(i + 1) % n];
      const c = this.get(to.x, to.y);
      applyContent(c, datas[i].data);
      c.group = datas[i].group;
      if (c.group) {
        const g = this.groups.get(c.group);
        if (g) g.cells = [{ x: to.x, y: to.y }];
      }
    }
    this.version++;
  }

  cellsOfType(type) {
    return this.cells.filter((c) => c.type === type);
  }

  // 디버그/테스트용 ASCII
  toAscii() {
    const rows = [];
    for (let y = 0; y < this.height; y++) {
      let r = '';
      for (let x = 0; x < this.width; x++) {
        const c = this.get(x, y);
        r +=
          c.type === CELL.SOLID
            ? '#'
            : c.type === CELL.BREAKABLE
              ? 'b'
              : c.type === CELL.GIMMICK
                ? c.gimmick?.solid
                  ? 'G'
                  : 'g'
                : '.';
      }
      rows.push(r);
    }
    return rows.join('\n');
  }
}

function makeCell(x, y, def) {
  return {
    x,
    y,
    type: def.type,
    prop: def.prop || null,
    group: 0,
    char: null,
    randomFill: !!def.randomFill,
    ring: !!def.ring,
    routeCrate: !!def.routeCrate,
    amp: def.amp || null,
    light: !!def.light,
    movable: !!def.movable,
    gimmick: def.gimmick
      ? {
          kind: def.gimmick,
          open: def.open !== undefined ? def.open : undefined,
          solid: def.gimmick === 'secretShelf' ? true : def.gimmick === 'door' ? !def.open : false,
        }
      : null,
  };
}

const CONTENT_KEYS = ['type', 'prop', 'routeCrate', 'amp', 'light', 'movable', 'gimmick', 'char'];

function extractContent(c) {
  const d = {};
  for (const k of CONTENT_KEYS) d[k] = c[k];
  return d;
}

function clearContent(c) {
  c.type = CELL.EMPTY;
  c.prop = null;
  c.routeCrate = false;
  c.amp = null;
  c.light = false;
  c.movable = false;
  c.gimmick = null;
  c.group = 0;
  c.char = null;
}

function applyContent(c, d) {
  for (const k of CONTENT_KEYS) c[k] = d[k];
}
