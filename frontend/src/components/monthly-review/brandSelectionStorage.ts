// 브랜드 상세 섹션의 사용자 선택을 localStorage에 저장/복원 (파트별 독립 저장, 2026-05-19 17회차)
//
// 키: avk_monthly_review_brand_selections
// 신규 구조 (v2):
//   {
//     all:       { 마이비: {mainLine, individual}, 누비: {...}, 쏭레브: {...} },
//     ecommerce: { ... },
//     offline:   { ... },
//   }
//
// 마이그레이션:
//   기존 v1 구조 ({마이비, 누비, 쏭레브} 최상위)가 감지되면 3 파트 모두에 그대로 복사 후 신규 구조로 저장.

export type Brand = "마이비" | "누비" | "쏭레브";
export type Part = "all" | "ecommerce" | "offline";

export interface BrandSelection {
  mainLine: string[];
  individual: string[];
}

export type BrandSelections = Record<Brand, BrandSelection>;
export type PartScopedBrandSelections = Record<Part, BrandSelections>;

const STORAGE_KEY = "avk_monthly_review_brand_selections";

const BASE_BRAND_DEFAULTS: BrandSelections = {
  마이비: {
    mainLine: ["순한라인", "얼룩제거제", "삶기세제", "건조기시트", "구강티슈"],
    individual: ["순한라인", "얼룩제거제", "삶기세제", "건조기시트", "구강티슈"],
  },
  누비: {
    mainLine: ["롱핸들", "스텐 물병", "정글 물병"],
    individual: ["롱핸들", "스텐 물병", "정글 물병"],
  },
  쏭레브: {
    mainLine: ["키즈 샴푸", "핸드워시", "클렌징 젤", "바디 크림"],
    individual: ["키즈 샴푸", "핸드워시", "클렌징 젤", "바디 크림"],
  },
};

export const DEFAULT_BRAND_SELECTIONS: PartScopedBrandSelections = {
  all: cloneBrandSelections(BASE_BRAND_DEFAULTS),
  ecommerce: cloneBrandSelections(BASE_BRAND_DEFAULTS),
  offline: cloneBrandSelections(BASE_BRAND_DEFAULTS),
};

export const ALL_BRANDS: Brand[] = ["마이비", "누비", "쏭레브"];
const ALL_PARTS: Part[] = ["all", "ecommerce", "offline"];

export function loadBrandSelections(): PartScopedBrandSelections {
  if (typeof window === "undefined") return cloneDefault();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefault();
    const parsed = JSON.parse(raw);

    // v1 구조 감지: 최상위 키가 브랜드 이름이면 (파트 키가 아니라)
    const isLegacy = parsed && typeof parsed === "object" &&
      (parsed.마이비 || parsed.누비 || parsed.쏭레브) &&
      !parsed.all && !parsed.ecommerce && !parsed.offline;

    if (isLegacy) {
      const migratedBrandSel = sanitizeBrandSelections(parsed);
      const migrated: PartScopedBrandSelections = {
        all: cloneBrandSelections(migratedBrandSel),
        ecommerce: cloneBrandSelections(migratedBrandSel),
        offline: cloneBrandSelections(migratedBrandSel),
      };
      saveBrandSelections(migrated);
      return migrated;
    }

    // v2 구조: 파트별 검증
    const out = cloneDefault();
    for (const p of ALL_PARTS) {
      if (parsed[p]) {
        out[p] = sanitizeBrandSelections(parsed[p]);
      }
    }
    return out;
  } catch {
    return cloneDefault();
  }
}

export function saveBrandSelections(s: PartScopedBrandSelections) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function sanitizeBrandSelections(raw: unknown): BrandSelections {
  const out = cloneBrandSelections(BASE_BRAND_DEFAULTS);
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, { mainLine?: unknown; individual?: unknown }>;
  for (const b of ALL_BRANDS) {
    if (r[b]) {
      if (Array.isArray(r[b].mainLine)) {
        out[b].mainLine = (r[b].mainLine as unknown[]).filter((x): x is string => typeof x === "string");
      }
      if (Array.isArray(r[b].individual)) {
        out[b].individual = (r[b].individual as unknown[]).filter((x): x is string => typeof x === "string");
      }
    }
  }
  return out;
}

function cloneBrandSelections(s: BrandSelections): BrandSelections {
  return JSON.parse(JSON.stringify(s));
}

function cloneDefault(): PartScopedBrandSelections {
  return JSON.parse(JSON.stringify(DEFAULT_BRAND_SELECTIONS));
}
