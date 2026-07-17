// 리치 텍스트 에디터의 색상 스와치를 localStorage에 저장/복원 (글자색·형광펜 각각 독립 목록)
//   - pinned: 사용자가 ★로 직접 고정한 색 (수동, 순서 유지)
//   - recent: 실제 적용한 색이 자동으로 쌓임 (최신 우선)
export type SwatchKind = "fore" | "hilite";
export type SwatchSet = { pinned: string[]; recent: string[] };
export type ColorSwatches = Record<SwatchKind, SwatchSet>;

const STORAGE_KEY = "avk_monthly_review_color_swatches";

export const MAX_PINNED = 8;
export const MAX_RECENT = 8;

// 최초 사용자에게 보여줄 기본 고정색 (저장값이 생기면 그쪽이 우선)
export const DEFAULT_COLOR_SWATCHES: ColorSwatches = {
  fore: { pinned: ["#000000", "#c00000", "#0070c0"], recent: [] },
  hilite: { pinned: ["#ffff00", "#ffd966", "#c6efce"], recent: [] },
};

// #rrggbb 형태만 허용 (localStorage 오염 방어) — 소문자로 정규화해 중복 판정 일관성 확보
function normHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

function normList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const h = normHex(item);
    if (h && !out.includes(h)) out.push(h);
    if (out.length >= max) break;
  }
  return out;
}

export function loadColorSwatches(): ColorSwatches {
  if (typeof window === "undefined") return DEFAULT_COLOR_SWATCHES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLOR_SWATCHES;
    const parsed = JSON.parse(raw) as Partial<Record<SwatchKind, Partial<SwatchSet>>>;
    const pick = (k: SwatchKind): SwatchSet => ({
      pinned: normList(parsed?.[k]?.pinned, MAX_PINNED),
      recent: normList(parsed?.[k]?.recent, MAX_RECENT),
    });
    return { fore: pick("fore"), hilite: pick("hilite") };
  } catch {
    return DEFAULT_COLOR_SWATCHES;
  }
}

export function saveColorSwatches(s: ColorSwatches): ColorSwatches {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* 용량 초과 등은 무시 — 스와치는 부가 기능 */
    }
  }
  return s;
}

export function pushRecent(s: ColorSwatches, kind: SwatchKind, color: string): ColorSwatches {
  const h = normHex(color);
  if (!h) return s;
  const recent = [h, ...s[kind].recent.filter((c) => c !== h)].slice(0, MAX_RECENT);
  return { ...s, [kind]: { ...s[kind], recent } };
}

// 가득 차면 가장 오래된 고정색을 밀어냄 (방금 고정한 색은 항상 보이도록)
export function pinColor(s: ColorSwatches, kind: SwatchKind, color: string): ColorSwatches {
  const h = normHex(color);
  if (!h || s[kind].pinned.includes(h)) return s;
  return { ...s, [kind]: { ...s[kind], pinned: [...s[kind].pinned, h].slice(-MAX_PINNED) } };
}

export function unpinColor(s: ColorSwatches, kind: SwatchKind, color: string): ColorSwatches {
  const h = normHex(color);
  if (!h) return s;
  return { ...s, [kind]: { ...s[kind], pinned: s[kind].pinned.filter((c) => c !== h) } };
}
