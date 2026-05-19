// "채널 종합" 섹션의 part별 채널 선택을 localStorage에 저장/복원
//
// 키: avk_monthly_review_channel_selections
// 구조: { all: string[], ecommerce: string[], offline: string[] }
//
// 기본값:
//   all       : 오픈마켓(사입) / 오픈마켓(위탁) / 자사몰 / 할인점
//   ecommerce : 오픈마켓(사입) / 오픈마켓(위탁) / 종합몰 / 버티컬커머스 / 자사몰 (P열 unique 중 PPT 의미 가까운 5개)
//   offline   : 할인점 / 다이소 / 오프라인 대리점

export type Part = "all" | "ecommerce" | "offline";

export type ChannelSelections = Record<Part, string[]>;

const STORAGE_KEY = "avk_monthly_review_channel_selections";

export const DEFAULT_CHANNEL_SELECTIONS: ChannelSelections = {
  all: ["오픈마켓(사입)", "오픈마켓(위탁)", "자사몰", "할인점"],
  ecommerce: ["오픈마켓(사입)", "오픈마켓(위탁)", "종합몰", "버티컬커머스", "자사몰"],
  offline: ["할인점", "다이소", "오프라인 대리점"],
};

const ALL_PARTS: Part[] = ["all", "ecommerce", "offline"];

export function loadChannelSelections(): ChannelSelections {
  if (typeof window === "undefined") return clone(DEFAULT_CHANNEL_SELECTIONS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_CHANNEL_SELECTIONS);
    const parsed = JSON.parse(raw);
    const out = clone(DEFAULT_CHANNEL_SELECTIONS);
    for (const p of ALL_PARTS) {
      if (Array.isArray(parsed[p])) {
        out[p] = parsed[p].filter((x: unknown) => typeof x === "string");
      }
    }
    return out;
  } catch {
    return clone(DEFAULT_CHANNEL_SELECTIONS);
  }
}

export function saveChannelSelections(s: ChannelSelections) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function clone(s: ChannelSelections): ChannelSelections {
  return JSON.parse(JSON.stringify(s));
}
