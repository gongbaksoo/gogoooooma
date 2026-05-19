// 브랜드 상세 섹션의 사용자 선택을 localStorage에 저장/복원
//
// 키: avk_monthly_review_brand_selections
// 구조:
//   {
//     "마이비":  { mainLine: ["순한라인", "얼룩제거제", ...], individual: ["순한라인", "얼룩제거제", ...] },
//     "누비":    { ... },
//     "쏭레브":  { ... },
//   }
//
// 기본값 (PPT 언급 상품):
//   마이비:  순한라인 / 얼룩제거제 / 삶기세제 / 건조기시트 / 구강티슈
//   누비:    롱핸들 / 스텐 물병 / 정글 물병
//   쏭레브:  키즈 샴푸 / 핸드워시 / 클렌징 젤 / 바디 크림

export type Brand = "마이비" | "누비" | "쏭레브";

export interface BrandSelection {
  mainLine: string[];  // 주요 상품 라인 차트에 같이 표시할 상품들
  individual: string[]; // 개별 상품 차트로 별도 표시할 상품들
}

export type BrandSelections = Record<Brand, BrandSelection>;

const STORAGE_KEY = "avk_monthly_review_brand_selections";

export const DEFAULT_BRAND_SELECTIONS: BrandSelections = {
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

export const ALL_BRANDS: Brand[] = ["마이비", "누비", "쏭레브"];

export function loadBrandSelections(): BrandSelections {
  if (typeof window === "undefined") return cloneDefault();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefault();
    const parsed = JSON.parse(raw);
    const result = cloneDefault();
    for (const b of ALL_BRANDS) {
      if (parsed[b]) {
        if (Array.isArray(parsed[b].mainLine)) result[b].mainLine = parsed[b].mainLine.filter((x: unknown) => typeof x === "string");
        if (Array.isArray(parsed[b].individual)) result[b].individual = parsed[b].individual.filter((x: unknown) => typeof x === "string");
      }
    }
    return result;
  } catch {
    return cloneDefault();
  }
}

export function saveBrandSelections(s: BrandSelections) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function cloneDefault(): BrandSelections {
  return JSON.parse(JSON.stringify(DEFAULT_BRAND_SELECTIONS));
}
