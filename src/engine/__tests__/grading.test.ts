import { describe, expect, it } from 'vitest';
import { gradeAttempt } from '../grading';

describe('옥타브 관대 채점', () => {
  // C major A형 Dm7 canonical = F3 A3 C4 E4
  const dm7 = [53, 57, 60, 64];

  it('canonical 그대로 = 정답 (입력 순서 무관)', () => {
    expect(gradeAttempt([53, 57, 60, 64], dm7)).toBe(true);
    expect(gradeAttempt([64, 53, 60, 57], dm7)).toBe(true);
  });

  it('-1 옥타브 이동형: 최저음이 41(F2) 이상이면 정답', () => {
    expect(gradeAttempt([41, 45, 48, 52], dm7)).toBe(true);
  });

  it('+1 옥타브 이동형: 최고음이 72(C5) 넘으면 오답', () => {
    expect(gradeAttempt([65, 69, 72, 76], dm7)).toBe(false);
  });

  it('+1 옥타브가 범위 안이면 정답 (Dm7b5 B형: C3 D3 F3 Ab3 → C4 D4 F4 Ab4)', () => {
    const dm7b5B = [48, 50, 53, 56];
    expect(gradeAttempt([60, 62, 65, 68], dm7b5B)).toBe(true);
  });

  it('-1 옥타브가 41 아래로 내려가면 오답', () => {
    const dm7b5B = [48, 50, 53, 56];
    expect(gradeAttempt([36, 38, 41, 44], dm7b5B)).toBe(false);
  });

  it('한 음이라도 틀리면 오답', () => {
    expect(gradeAttempt([53, 57, 59, 64], dm7)).toBe(false);
  });

  it('일부 음만 옥타브 이동한 건 오답', () => {
    expect(gradeAttempt([41, 57, 60, 64], dm7)).toBe(false);
    expect(gradeAttempt([53, 57, 60, 76], dm7)).toBe(false);
  });

  it('중복 음 4개는 오답', () => {
    expect(gradeAttempt([53, 53, 60, 64], dm7)).toBe(false);
  });

  it('음 개수가 다르면 오답', () => {
    expect(gradeAttempt([53, 57, 60], dm7)).toBe(false);
  });
});
