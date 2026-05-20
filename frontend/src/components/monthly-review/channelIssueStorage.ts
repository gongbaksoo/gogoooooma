// "주요 채널 이슈" 섹션의 사용자 정의 그룹 + 표시 거래처/브랜드 selection을 localStorage에 저장
//
// 키: avk_monthly_review_channel_issue
// 구조:
//   {
//     all:       [ GroupDef, GroupDef, GroupDef ],
//     ecommerce: [ ... ],
//     offline:   [ ... ],
//   }
// 각 GroupDef:
//   { id, name, channels: P열 채널구분 값들, vendorSelection: R열 거래처들, brandSelection: D열 브랜드들 }

export type Part = "all" | "ecommerce" | "offline";

export interface GroupDef {
  id: string;
  name: string;
  channels: string[];       // P열 채널구분 매핑
  // 표시 항목 selection — 타입 태그 id 저장 (이름 충돌·혼합 순서 대응)
  //   거래처 차트: "P:<채널>" (P열) | "R:<거래처>" (R열)
  //   브랜드 차트: "D:<브랜드>" (D열) | "S:<품목구분>" (S열)
  vendorSelection: string[]; // 상단(거래처) 차트 표시 — P/R 혼합 가능
  brandSelection: string[];  // 하단(브랜드) 차트 표시 — D/S 혼합 가능
}

/** 표시 항목 selection 태그 접두 (타입 구분) */
export const SEL_PREFIXES = ["P:", "R:", "D:", "S:"] as const;

/** 평문(접두 없는) selection을 기본 타입 접두로 마이그레이션 */
function tagSelection(arr: string[], defaultPrefix: "R:" | "D:"): string[] {
  return arr.map((v) =>
    SEL_PREFIXES.some((p) => v.startsWith(p)) ? v : `${defaultPrefix}${v}`
  );
}

export type PartScopedGroups = Record<Part, GroupDef[]>;

const STORAGE_KEY = "avk_monthly_review_channel_issue";

const BASE_DEFAULT_GROUPS: GroupDef[] = [
  {
    id: "g_사입몰",
    name: "사입몰",
    channels: ["오픈마켓(사입)"],
    vendorSelection: [],
    brandSelection: [],
  },
  {
    id: "g_위탁몰",
    name: "위탁몰",
    channels: ["오픈마켓(위탁)", "종합몰", "버티컬커머스"],
    vendorSelection: [],
    brandSelection: [],
  },
  {
    id: "g_자사몰",
    name: "자사몰",
    channels: ["자사몰"],
    vendorSelection: [],
    brandSelection: [],
  },
];

export const DEFAULT_CHANNEL_ISSUE_GROUPS: PartScopedGroups = {
  all: cloneGroups(BASE_DEFAULT_GROUPS),
  ecommerce: cloneGroups(BASE_DEFAULT_GROUPS),
  offline: cloneGroups(BASE_DEFAULT_GROUPS),
};

const ALL_PARTS: Part[] = ["all", "ecommerce", "offline"];

export function loadChannelIssueGroups(): PartScopedGroups {
  if (typeof window === "undefined") return clone(DEFAULT_CHANNEL_ISSUE_GROUPS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_CHANNEL_ISSUE_GROUPS);
    const parsed = JSON.parse(raw);
    const out: PartScopedGroups = clone(DEFAULT_CHANNEL_ISSUE_GROUPS);
    for (const p of ALL_PARTS) {
      if (Array.isArray(parsed[p])) {
        out[p] = parsed[p].map(sanitizeGroup).filter((g): g is GroupDef => g !== null);
        if (out[p].length === 0) out[p] = cloneGroups(BASE_DEFAULT_GROUPS);
      }
    }
    return out;
  } catch {
    return clone(DEFAULT_CHANNEL_ISSUE_GROUPS);
  }
}

export function saveChannelIssueGroups(g: PartScopedGroups) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(g));
}

export function createEmptyGroup(name: string = "새 그룹"): GroupDef {
  return {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    channels: [],
    vendorSelection: [],
    brandSelection: [],
  };
}

function sanitizeGroup(raw: unknown): GroupDef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<GroupDef>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  return {
    id: r.id,
    name: r.name,
    channels: Array.isArray(r.channels) ? r.channels.filter((x): x is string => typeof x === "string") : [],
    vendorSelection: tagSelection(
      Array.isArray(r.vendorSelection)
        ? r.vendorSelection.filter((x): x is string => typeof x === "string")
        : [],
      "R:"
    ),
    brandSelection: tagSelection(
      Array.isArray(r.brandSelection)
        ? r.brandSelection.filter((x): x is string => typeof x === "string")
        : [],
      "D:"
    ),
  };
}

function cloneGroups(g: GroupDef[]): GroupDef[] {
  return JSON.parse(JSON.stringify(g));
}

function clone(g: PartScopedGroups): PartScopedGroups {
  return JSON.parse(JSON.stringify(g));
}
