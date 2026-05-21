// "종합" / "브랜드 종합" 섹션의 차트 표시 선택을 localStorage에 저장/복원 (27회차)
//
// 키: avk_monthly_review_overview_selections
// 구조: { chart3: Partial<Record<Part, string[]>>, brand: Partial<Record<Part, string[]>> }
//   - chart3 : "이커머스 vs 오프라인" (파트마다 시리즈 구성이 다름)
//   - brand  : "브랜드별 매출 트렌드" + "브랜드별 매출 비중" (두 차트 공유)
//
// 값 의미:
//   - 해당 파트 키 없음(undefined) → 미편집 상태. 백엔드 시리즈 전체를 원래 순서대로 표시 (기존 동작 유지)
//   - 빈 배열([])                 → 사용자가 전부 해제. 차트 비움 (안내 문구)
//   - 배열                        → 선택한 시리즈를 그 순서(표시 우선순위)대로 표시

export type Part = "all" | "ecommerce" | "offline";

export interface OverviewSelections {
  chart3: Partial<Record<Part, string[]>>;
  brand: Partial<Record<Part, string[]>>;
}

const STORAGE_KEY = "avk_monthly_review_overview_selections";

export const DEFAULT_OVERVIEW_SELECTIONS: OverviewSelections = {
  chart3: {},
  brand: {},
};

const ALL_PARTS: Part[] = ["all", "ecommerce", "offline"];

function parseScoped(raw: unknown): Partial<Record<Part, string[]>> {
  const out: Partial<Record<Part, string[]>> = {};
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const p of ALL_PARTS) {
      if (Array.isArray(obj[p])) {
        out[p] = (obj[p] as unknown[]).filter((x): x is string => typeof x === "string");
      }
    }
  }
  return out;
}

export function loadOverviewSelections(): OverviewSelections {
  if (typeof window === "undefined") return clone(DEFAULT_OVERVIEW_SELECTIONS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_OVERVIEW_SELECTIONS);
    const parsed = JSON.parse(raw);
    return {
      chart3: parseScoped(parsed?.chart3),
      brand: parseScoped(parsed?.brand),
    };
  } catch {
    return clone(DEFAULT_OVERVIEW_SELECTIONS);
  }
}

export function saveOverviewSelections(s: OverviewSelections) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function clone(s: OverviewSelections): OverviewSelections {
  return JSON.parse(JSON.stringify(s));
}
