import type { Item } from '../engine/items';
import type { ProgressionType } from '../engine/types';
import { PROGRESSIONS } from '../engine/progressions';
import { bottomDegree, formALink, movedLabels, progressionLinks, shapeGaps, siblingLink } from '../engine/links';
import { toGlyphs } from '../engine/spelling';

type Props = {
  item: Item;
  /** 진행 문맥 — 있으면 ii→V→I 연결을 보여준다 */
  ctx?: { type: ProgressionType; keyPc: number; roman: string };
  /** 보여줄 줄 — 기본은 전부 */
  show?: ('shape' | 'progression' | 'sibling' | 'formA')[];
};

/**
 * 외울 때 기대는 연결 한두 줄. 설명문이 아니라 사실만: 모양, 어떤 음이 움직이는지.
 * 정답 공개 뒤와 새 코드 소개에서만 쓴다 (문제 화면에 띄우면 답을 좁혀준다).
 */
export function LinkLines({ item, ctx, show = ['shape', 'progression', 'sibling', 'formA'] }: Props) {
  const lines: { key: string; label: string; body: string }[] = [];

  if (show.includes('shape')) {
    lines.push({
      key: 'shape',
      label: '모양',
      body: `${shapeGaps(item.quality, item.form).join('·')} · 맨 아래 ${toGlyphs(bottomDegree(item.quality, item.form))}`,
    });
  }

  if (show.includes('progression') && ctx) {
    const slotIdx = PROGRESSIONS[ctx.type].findIndex((s) => s.roman === ctx.roman);
    for (const link of progressionLinks(ctx.keyPc, ctx.type, item.form, slotIdx)) {
      const moved = movedLabels(link.moves).join(' · ');
      if (link.kind === 'prev') {
        lines.push({ key: 'prev', label: `${link.otherSymbol}에서`, body: moved });
      } else {
        lines.push({ key: 'next', label: `→ ${link.otherSymbol}`, body: moved });
      }
    }
  }

  if (show.includes('sibling')) {
    const sib = siblingLink(item.rootPc, item.quality, item.form);
    if (sib) lines.push({ key: 'sibling', label: `${sib.otherSymbol}에서`, body: movedLabels(sib.moves).join(' · ') });
  }

  if (show.includes('formA')) {
    const fa = formALink(item.rootPc, item.quality, item.form);
    if (fa) lines.push({ key: 'formA', label: fa.otherSymbol, body: '위 두 음을 아래로' });
  }

  if (lines.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {lines.map((l) => (
        <div key={l.key} className="contents">
          <dt className="text-right text-muted">{l.label}</dt>
          <dd className="text-ivory-dim">{l.body}</dd>
        </div>
      ))}
    </dl>
  );
}
