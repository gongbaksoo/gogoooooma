"use client";

import { useEffect, useState } from "react";

export type ChartId =
  | "chart1" | "chart2" | "chart3"
  | "chart4" | "chart5" | "chart6"
  | "chart7" | "chart8" | "chart9";

export type VisibilityMap = Record<ChartId, boolean>;

const ALL_CHART_IDS: ChartId[] = [
  "chart1", "chart2", "chart3",
  "chart4", "chart5", "chart6",
  "chart7", "chart8", "chart9",
];

const SECTIONS: { title: string; charts: { id: ChartId; label: string }[] }[] = [
  {
    title: "종합",
    charts: [
      { id: "chart1", label: "1. 목표비 실적" },
      { id: "chart2", label: "2. 전년비 트렌드" },
      { id: "chart3", label: "3. 파트별 동적 비교" },
    ],
  },
  {
    title: "브랜드 종합",
    charts: [
      { id: "chart4", label: "4. 브랜드별 매출 트렌드" },
      { id: "chart5", label: "5. 브랜드별 매출 비중" },
      { id: "chart6", label: "6. 브랜드 월평균 vs 당월" },
    ],
  },
  {
    title: "채널 종합",
    charts: [
      { id: "chart7", label: "7. 채널별 매출 트렌드" },
      { id: "chart8", label: "8. 채널별 매출 비중" },
      { id: "chart9", label: "9. 채널 월평균 vs 당월" },
    ],
  },
];
// 주: "브랜드 상세" 섹션은 각 브랜드 BrandSection 내부에서 자체적으로 관리 (상품 추가/제거 모달)

const STORAGE_KEY = "avk_monthly_review_visible_charts";

export function defaultVisibility(): VisibilityMap {
  return Object.fromEntries(ALL_CHART_IDS.map((id) => [id, true])) as VisibilityMap;
}

export function loadVisibility(): VisibilityMap {
  if (typeof window === "undefined") return defaultVisibility();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultVisibility();
    const parsed = JSON.parse(raw);
    const base = defaultVisibility();
    for (const id of ALL_CHART_IDS) {
      if (typeof parsed[id] === "boolean") base[id] = parsed[id];
    }
    return base;
  } catch {
    return defaultVisibility();
  }
}

export function saveVisibility(v: VisibilityMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

interface Props {
  open: boolean;
  onClose: () => void;
  visibility: VisibilityMap;
  onChange: (next: VisibilityMap) => void;
}

export default function ChartVisibilityModal({ open, onClose, visibility, onChange }: Props) {
  const [draft, setDraft] = useState<VisibilityMap>(visibility);

  useEffect(() => {
    if (open) setDraft(visibility);
  }, [open, visibility]);

  if (!open) return null;

  const handleToggle = (id: ChartId) => {
    setDraft((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSectionToggle = (charts: { id: ChartId }[], targetState: boolean) => {
    setDraft((prev) => {
      const next = { ...prev };
      charts.forEach((c) => (next[c.id] = targetState));
      return next;
    });
  };

  const handleApply = () => {
    onChange(draft);
    saveVisibility(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#c4c4c4] max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#c4c4c4] sticky top-0 bg-white">
          <h2 className="text-[18px] font-bold text-black">차트 표시 설정</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5d5d5d] hover:text-black text-[13px]"
          >
            닫기 ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {SECTIONS.map((section) => {
            const allOn = section.charts.every((c) => draft[c.id]);
            return (
              <div key={section.title}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-bold text-black">{section.title}</h3>
                  <button
                    type="button"
                    onClick={() => handleSectionToggle(section.charts, !allOn)}
                    className="text-[12px] text-[#5d5d5d] hover:text-black underline"
                  >
                    {allOn ? "모두 끄기" : "모두 켜기"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {section.charts.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-[13px] cursor-pointer hover:bg-[#f5f5f5] px-2 py-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={draft[c.id]}
                        onChange={() => handleToggle(c.id)}
                        className="w-4 h-4 accent-black"
                      />
                      <span className={draft[c.id] ? "text-black" : "text-[#5d5d5d]"}>
                        {c.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-[#c4c4c4] flex justify-end gap-2 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#c4c4c4] bg-white text-black text-[13px] px-4 py-2 rounded hover:border-black"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="bg-black text-white text-[13px] font-bold px-4 py-2 rounded-[2px]"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
