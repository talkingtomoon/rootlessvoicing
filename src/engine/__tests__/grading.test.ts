import { describe, expect, it } from 'vitest';
import { gradeAttempt, GRADE_MAX, GRADE_MIN } from '../grading';

describe('옥타브 관대 채점', () => {
  // C major A형 Dm7 canonical = F3 A3 C4 E4
  const dm7 = [53, 57, 60, 64];

  it('canonical 그대로 = 정답 (입력 순서 무관)', () => {
    expect(gradeAttempt([53, 57, 60, 64], dm7)).toBe(true);
    expect(gradeAttempt([64, 53, 60, 57], dm7)).toBe(true);
  });

  it('-1 옥타브 이동형: 최저음이 36(C2) 이상이면 정답', () => {
    expect(gradeAttempt([41, 45, 48, 52], dm7)).toBe(true);
  });

  it('+1 옥타브는 엄지가 C5를 넘으므로 오답', () => {
    expect(gradeAttempt([65, 69, 72, 76], dm7)).toBe(false);
  });

  it('-1 옥타브까지만 (Dm7b5 B형: C4 D4 F4 Ab4)', () => {
    const dm7b5B = [60, 62, 65, 68];
    expect(gradeAttempt([48, 50, 53, 56], dm7b5B)).toBe(true);
    expect(gradeAttempt([36, 38, 41, 44], dm7b5B)).toBe(false); // -2 옥타브는 오답
  });

  it('채점 허용 범위는 건반 클릭 범위와 같아야 한다', () => {
    expect([GRADE_MIN, GRADE_MAX]).toEqual([36, 71]);
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
