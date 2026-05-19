// 차트 팔레트 — design_document §8.5 (B-6 다중 시리즈 매핑, 2026-05-20 도입)
//
// 다중 시리즈 차트(시리즈 ≥ 4개)에 적용. 4 hue(검정/네이비/베이지/회색) × 진/연 × 실/점 = 14 슬롯.
// 이익률(분홍) / 증감률(녹색) 의미색은 별도 보존.

export type SeriesStyle = {
  stroke: string;
  strokeDasharray?: string;
  strokeWidth: number;
  dotR: number;
  activeR: number;
};

// B-6 14 슬롯 (시리즈 순서 i → 슬롯 매핑)
//  1~4: 검정/네이비/베이지/회색 진한 톤 × 실선
//  5~8: 동일 4 hue × 점선
//  9~11: 검정/네이비/베이지 연한 톤 × 실선 (회색 패스)
// 12~14: 동일 3 hue × 점선
const B6_PALETTE: { color: string; pattern: 'solid' | 'dashed' }[] = [
  { color: '#000000', pattern: 'solid'  },  // 1 검정 진/실
  { color: '#1a2942', pattern: 'solid'  },  // 2 네이비 진/실
  { color: '#a08e7a', pattern: 'solid'  },  // 3 베이지 진/실
  { color: '#9d9d9d', pattern: 'solid'  },  // 4 회색/실
  { color: '#000000', pattern: 'dashed' },  // 5 검정 진/점
  { color: '#1a2942', pattern: 'dashed' },  // 6 네이비 진/점
  { color: '#a08e7a', pattern: 'dashed' },  // 7 베이지 진/점
  { color: '#9d9d9d', pattern: 'dashed' },  // 8 회색/점
  { color: '#3d3d3d', pattern: 'solid'  },  // 9 검정 연/실
  { color: '#4a5e80', pattern: 'solid'  },  // 10 네이비 연/실
  { color: '#c4b5a0', pattern: 'solid'  },  // 11 베이지 연/실
  { color: '#3d3d3d', pattern: 'dashed' },  // 12 검정 연/점
  { color: '#4a5e80', pattern: 'dashed' },  // 13 네이비 연/점
  { color: '#c4b5a0', pattern: 'dashed' },  // 14 베이지 연/점
];

// 시리즈 i번째의 스타일 반환. i가 14를 넘으면 마지막 슬롯 반복.
export function getMultiSeriesStyle(i: number): SeriesStyle {
  const slot = B6_PALETTE[i] ?? B6_PALETTE[B6_PALETTE.length - 1];
  const isPrimary = i === 0;
  return {
    stroke: slot.color,
    strokeDasharray: slot.pattern === 'dashed' ? '4 4' : undefined,
    strokeWidth: isPrimary ? 2.5 : (slot.pattern === 'dashed' ? 1.5 : 2),
    dotR: isPrimary ? 4 : 3,
    activeR: isPrimary ? 6 : 5,
  };
}

// 이익률/증감률 — 단일 데이터 종류 4단계 명도 + 실/점선 교차 (기존 §8.5 v4 패턴 유지)
const DATA_TYPE_PALETTES = {
  profitRate: ['#ff0066', '#ff3385', '#ff66a3', '#ff99c1'],
  growth:     ['#065f46', '#10b981', '#34d399', '#6ee7b7'],
} as const;

export type DataTypePaletteKey = keyof typeof DATA_TYPE_PALETTES;

export function getDataTypeSeriesStyle(i: number, key: DataTypePaletteKey): SeriesStyle {
  const palette = DATA_TYPE_PALETTES[key];
  const color = palette[Math.floor(i / 2)] ?? palette[palette.length - 1];
  const dashed = i % 2 === 1;
  return {
    stroke: color,
    strokeDasharray: dashed ? '4 4' : undefined,
    strokeWidth: i === 0 ? 2.5 : 1.5,
    dotR: i === 0 ? 4 : 3,
    activeR: i === 0 ? 6 : 5,
  };
}
