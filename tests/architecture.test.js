import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GameManager } from '../src/core/GameManager.js';
import { BotBrain } from '../src/core/ai/BotBrain.js';
import { STAGE_ORDER } from '../src/config/stageConfig.js';
import { PLAYABLE_CHARACTER_IDS } from '../src/config/characterConfig.js';
import { KEY_PROFILES } from '../src/config/inputConfig.js';

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('Architecture guards (GDD v2 rules)', () => {
  const files = walk('src').filter((f) => f.endsWith('.js'));

  it('no per-character controllers (VinController, PickerController, ...)', () => {
    const names = files.map((f) => f.split('/').pop());
    expect(names.filter((n) => /^(Vin|Picker|AA|Locke|Rex|Buddy|Bully|MrOdd)Controller/i.test(n))).toEqual([]);
    for (const f of files) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/class\s+(Vin|Picker|AA|Locke|Rex|Buddy|Bully)\w*Controller/);
    }
  });

  it('no character active skill / skill cooldown / ultimate code', () => {
    const forbidden = /useSkill|skillGauge|SkillGauge|skillCooldown|SkillCooldown|heroSkill|HeroSkill|ultimate\s*[:(=]|Resonance|Overcharge|RoyalPush|SecretDoorSkill/;
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(forbidden);
    }
  });

  it('Q key is not bound to anything (character skill must not come back)', () => {
    for (const profile of Object.values(KEY_PROFILES)) {
      for (const keys of Object.values(profile)) expect(keys).not.toContain('KeyQ');
    }
  });

  it('core simulation does not import three.js or touch the DOM', () => {
    for (const f of files.filter((f) => f.includes('src/core/'))) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from 'three'|document\.|window\./);
    }
  });
});

describe('Bot smoke test — every stage, every character, both modes', () => {
  for (const stageId of STAGE_ORDER) {
    for (const mode of ['battle', 'team']) {
      it(`${stageId} / ${mode}: 4 CPU players run 150s without errors`, () => {
        const chars = PLAYABLE_CHARACTER_IDS;
        const offset = STAGE_ORDER.indexOf(stageId);
        const players = [0, 1, 2, 3].map((i) => ({
          slot: i,
          characterId: chars[(i + offset) % chars.length],
          team: mode === 'team' ? (i % 2 === 0 ? 'A' : 'B') : undefined,
          bot: true,
        }));
        const gm = new GameManager({ mode, stageId, players, seed: 1000 + offset, skipCountdown: true, timeLimit: 150 });
        const bots = gm.players.list.map((p) => new BotBrain(p.id, { seed: gm.seed }));
        let bombs = 0;
        let explosions = 0;
        for (let i = 0; i < 150 * 60 && !gm.result; i++) {
          const intents = {};
          for (const b of bots) intents[b.playerId] = b.update(gm, 1 / 60);
          gm.step(1 / 60, intents);
          for (const e of gm.drainEvents()) {
            if (e.type === 'bombPlaced') bombs++;
            if (e.type === 'explosion') explosions++;
          }
        }
        expect(bombs).toBeGreaterThan(5);
        expect(explosions).toBeGreaterThan(5);
        expect(gm.result).not.toBeNull();
        // 플레이어가 벽 속에 끼지 않았는지
        for (const p of gm.players.list) {
          if (!p.isEliminated) expect(gm.grid.isSolid(p.cellX, p.cellY), `${p.name} stuck`).toBe(false);
        }
      });
    }
  }
});

describe('Basic controls are only MOVE / BOMB / ITEM (no default Dash)', () => {
  it('no dash binding, intent, state or player field', async () => {
    const { KEY_PROFILES, KEY_LABELS, GAMEPAD_MAP } = await import('../src/config/inputConfig.js');
    const { PLAYER_STATE } = await import('../src/core/constants.js');
    const { GAME_CONFIG } = await import('../src/config/gameConfig.js');
    for (const prof of Object.values(KEY_PROFILES)) expect(Object.keys(prof).sort()).toEqual(['bomb', 'down', 'item', 'left', 'right', 'up']);
    for (const lab of Object.values(KEY_LABELS)) expect(lab.dash).toBeUndefined();
    expect(GAMEPAD_MAP.dash).toBeUndefined();
    expect(PLAYER_STATE.DASH).toBeUndefined();
    expect(GAME_CONFIG.dash).toBeUndefined();
    const gm = new GameManager({ mode: 'battle', stageId: 'lounge', players: [{ characterId: 'vin' }, { characterId: 'picker' }], seed: 1, skipCountdown: true });
    expect(gm.players.get(0).dash).toBeUndefined();
  });
});
