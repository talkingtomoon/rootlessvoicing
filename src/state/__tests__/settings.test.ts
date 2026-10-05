import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, enabledForms, enabledItems, enabledTypes } from '../settings';
import { createSession } from '../../session/session';
import { contextOf } from '../../engine/items';

describe('설정 필터', () => {
  it('기본값은 전부 켜짐 = 144개', () => {
    expect(enabledItems(DEFAULT_SETTINGS)).toHaveLength(144);
    expect(enabledTypes(DEFAULT_SETTINGS)).toEqual(['major', 'minor']);
    expect(enabledForms(DEFAULT_SETTINGS)).toEqual(['A', 'B']);
  });

  it('폼 하나만 켜면 절반', () => {
    const items = enabledItems({ ...DEFAULT_SETTINGS, B: false });
    expect(items).toHaveLength(72);
    expect(items.every((i) => i.form === 'A')).toBe(true);
  });

  it('메이저만: m7·dom7·maj7 (마이너 전용 quality는 빠진다)', () => {
    const items = enabledItems({ ...DEFAULT_SETTINGS, minor: false });
    const qualities = new Set(items.map((i) => i.quality));
    expect([...qualities].sort()).toEqual(['dom7', 'm7', 'maj7']);
    expect(items).toHaveLength(3 * 12 * 2);
  });

  it('마이너만: m7b5·dom7b9b13·m6', () => {
    const items = enabledItems({ ...DEFAULT_SETTINGS, major: false });
    const qualities = new Set(items.map((i) => i.quality));
    expect([...qualities].sort()).toEqual(['dom7b9b13', 'm6', 'm7b5']);
    expect(items).toHaveLength(3 * 12 * 2);
  });

  it('메이저만 + A형만 = 36개', () => {
    expect(enabledItems({ major: true, minor: false, A: true, B: false })).toHaveLength(36);
  });
});

describe('출제 문맥', () => {
  it('quality가 문맥을 정한다 — 설정은 풀만 거른다', () => {
    const s = createSession([{ rootPc: 2, quality: 'm7', form: 'A' }], 0, () => 0.5);
    expect(s.current!.ctx).toEqual(contextOf(2, 'm7'));
    expect(s.current!.ctx.roman).toBe('ii');
  });

  it('마이너 전용 quality도 제 문맥으로 나온다', () => {
    const s = createSession([{ rootPc: 0, quality: 'm6', form: 'A' }], 0, () => 0.5);
    expect(s.current!.ctx).toEqual({ type: 'minor', keyPc: 0, roman: 'i' });
  });
});
