import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, enabledForms, enabledItems, enabledTypes } from '../settings';
import { createSession } from '../../session/session';
import { contextsFor } from '../../engine/items';

describe('설정 필터', () => {
  it('기본값은 전부 켜짐 = 120개', () => {
    expect(enabledItems(DEFAULT_SETTINGS)).toHaveLength(120);
    expect(enabledTypes(DEFAULT_SETTINGS)).toEqual(['major', 'minor']);
    expect(enabledForms(DEFAULT_SETTINGS)).toEqual(['A', 'B']);
  });

  it('폼 하나만 켜면 절반', () => {
    const items = enabledItems({ ...DEFAULT_SETTINGS, B: false });
    expect(items).toHaveLength(60);
    expect(items.every((i) => i.form === 'A')).toBe(true);
  });

  it('메이저만: m7·dom7·maj7 (마이너 전용 quality는 빠진다)', () => {
    const items = enabledItems({ ...DEFAULT_SETTINGS, minor: false });
    const qualities = new Set(items.map((i) => i.quality));
    expect([...qualities].sort()).toEqual(['dom7', 'm7', 'maj7']);
    expect(items).toHaveLength(3 * 12 * 2);
  });

  it('마이너만: m7b5·dom7b9·m7 (m7은 마이너 i로 남는다)', () => {
    const items = enabledItems({ ...DEFAULT_SETTINGS, major: false });
    const qualities = new Set(items.map((i) => i.quality));
    expect([...qualities].sort()).toEqual(['dom7b9', 'm7', 'm7b5']);
    expect(items).toHaveLength(3 * 12 * 2);
  });

  it('메이저만 + A형만 = 36개', () => {
    expect(enabledItems({ major: true, minor: false, A: true, B: false })).toHaveLength(36);
  });
});

describe('출제 문맥 제한', () => {
  const m7Items = [{ rootPc: 2, quality: 'm7' as const, form: 'A' as const }];

  it('마이너만 켜면 m7은 마이너 i로만 출제된다', () => {
    const s = createSession(m7Items, 0, () => 0.5, ['minor']);
    expect(s.current!.ctx.type).toBe('minor');
    expect(s.current!.ctx.roman).toBe('i');
  });

  it('메이저만 켜면 m7은 메이저 ii로만 출제된다', () => {
    const s = createSession(m7Items, 0, () => 0.5, ['major']);
    expect(s.current!.ctx.type).toBe('major');
    expect(s.current!.ctx.roman).toBe('ii');
  });

  it('허용 문맥이 없는 quality면 필터를 무시하고 원래 문맥을 쓴다', () => {
    // maj7은 메이저 전용 — 마이너만 켜도 카드가 사라지면 안 된다
    const s = createSession([{ rootPc: 0, quality: 'maj7', form: 'A' }], 0, () => 0.5, ['minor']);
    expect(s.current).not.toBeNull();
    expect(s.current!.ctx).toEqual(contextsFor(0, 'maj7')[0]);
  });
});
