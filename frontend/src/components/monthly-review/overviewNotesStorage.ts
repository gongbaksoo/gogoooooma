// 종합 섹션 사용자 코멘트(메모) 저장 — 대상 월 × 파트 조합별 독립
// 키: avk_monthly_review_overview_notes, 값: { `${month}|${part}`: text }
// 빈 내용은 저장하지 않음(키 삭제) → 보기 모드에서 아무것도 표시 안 함.

export type Part = "all" | "ecommerce" | "offline";
export type OverviewNotes = Record<string, string>;

const STORAGE_KEY = "avk_monthly_review_overview_notes";

function noteKey(month: string, part: Part): string {
  return `${month}|${part}`;
}

export function loadOverviewNotes(): OverviewNotes {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: OverviewNotes = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function getOverviewNote(notes: OverviewNotes, month: string, part: Part): string {
  return notes[noteKey(month, part)] ?? "";
}

// 텍스트 저장(빈 문자열이면 삭제). 갱신된 전체 맵을 반환.
export function saveOverviewNote(month: string, part: Part, text: string): OverviewNotes {
  const notes = loadOverviewNotes();
  const key = noteKey(month, part);
  if (text.trim() === "") {
    delete notes[key];
  } else {
    notes[key] = text;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // 저장 실패는 무시(시크릿 모드 등)
  }
  return notes;
}
