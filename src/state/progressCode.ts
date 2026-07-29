import { allItems, itemId } from '../engine/items';
import { emptyProgress, MAX_LEVEL, type ProgressStore } from './progress';

/**
 * 진도를 URL에 실을 수 있는 짧은 코드로 만든다. 서버 없이 기기 사이를 옮기는 유일한 통로.
 *
 * 형식 (123바이트 → base64url 164자):
 *   [0]    버전
 *   [1..2] 세션 번호 (LE, 0..65535로 clamp)
 *   [3..]  item당 1바이트 — 상위 3비트 = 단계(0=미학습, 1..5), 하위 5비트 = 나이
 *
 * 나이 = 세션번호 - lastSeenSession. 최대 간격이 16세션이라 31에서 잘라도
 * 재출제 판정(isDue)은 완전히 동일하다. 절대 세션번호 대신 나이를 담는 이유는
 * 가져온 기기에서 세션 번호가 달라도 간격이 그대로 유지되게 하려는 것.
 *
 * item 순서는 allItems() 순서이고 **이 순서가 포맷의 일부다** — 바꾸면 옛 코드가 깨진다.
 */

const VERSION = 1;
const MAX_AGE = 31;
const BYTES = 3 + 120;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): Uint8Array | null {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeProgress(store: ProgressStore): string {
  const bytes = new Uint8Array(BYTES);
  const session = Math.max(0, Math.min(store.session, 0xffff));
  bytes[0] = VERSION;
  bytes[1] = session & 0xff;
  bytes[2] = (session >> 8) & 0xff;

  allItems().forEach((item, i) => {
    const p = store.items[itemId(item)];
    if (!p) return; // 미학습 = 0
    const level = Math.max(1, Math.min(p.level, MAX_LEVEL));
    const age = Math.max(0, Math.min(session - p.lastSeenSession, MAX_AGE));
    bytes[3 + i] = (level << 5) | age;
  });

  return toBase64Url(bytes);
}

/** 형식이 어긋나면 null — 잘못 붙여넣은 코드로 진도를 날리지 않는다 */
export function decodeProgress(code: string): ProgressStore | null {
  const bytes = fromBase64Url(code.trim());
  if (!bytes || bytes.length !== BYTES || bytes[0] !== VERSION) return null;

  const session = bytes[1] | (bytes[2] << 8);
  const store: ProgressStore = { ...emptyProgress(), session, items: {} };

  allItems().forEach((item, i) => {
    const byte = bytes[3 + i];
    const level = byte >> 5;
    if (level === 0) return;
    if (level > MAX_LEVEL) return;
    store.items[itemId(item)] = { level, lastSeenSession: session - (byte & 0x1f) };
  });

  return store;
}

const HASH_KEY = 'p';

export function progressLink(store: ProgressStore, base = location.href): string {
  const url = new URL(base);
  url.hash = `${HASH_KEY}=${encodeProgress(store)}`;
  return url.toString();
}

/** 주소에 실려온 진도 코드를 읽는다 (읽기만 — 적용은 사용자가 확인한 뒤) */
export function readIncoming(hash = location.hash): ProgressStore | null {
  const m = hash.match(new RegExp(`[#&]${HASH_KEY}=([^&]+)`));
  return m ? decodeProgress(m[1]) : null;
}

export function clearIncoming(): void {
  history.replaceState(null, '', location.pathname + location.search);
}
