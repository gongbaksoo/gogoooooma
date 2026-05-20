"use client";

import { useEffect, useState } from "react";

export type ChartId =
  | "chart1" | "chart2" | "chart3"
  | "chart4" | "chart5" | "chart6";

/** 섹션 단위 토글 ID */
export type SectionId =
  | "overview"        // 종합 (chart1/2/3 묶음)
  | "brandOverview"   // 브랜드 종합 (chart4/5/6 묶음)
  | "brandDetail"     // 브랜드 상세 (BrandSection × 3)
  | "channelOverview" // 채널 종합 (ChannelSection)
  | "channelIssue";   // 주요 채널 이슈 (ChannelIssueSection)

export type VisibilityMap = Record<ChartId | SectionId, boolean>;

const ALL_CHART_IDS: ChartId[] = [
  "chart1", "chart2", "chart3",
  "chart4", "chart5", "chart6",
];

const ALL_SECTION_IDS: SectionId[] = [
  "overview",
  "brandOverview",
  "brandDetail",
  "channelOverview",
  "channelIssue",
];

interface SectionDef {
  id: SectionId;
  label: string;
  charts?: { id: ChartId; label: string }[]; // 있으면 sub-toggle 노출
}

const SECTIONS: SectionDef[] = [
  {
    id: "overview",
    label: "종합",
    charts: [
      { id: "chart1", label: "목표비 실적 (Chart 1)" },
      { id: "chart2", label: "전년비 트렌드 (Chart 2)" },
      { id: "chart3", label: "파트별 동적 비교 (Chart 3)" },
    ],
  },
  {
    id: "brandOverview",
    label: "브랜드 종합",
    charts: [
      { id: "chart4", label: "브랜드별 트렌드 (Chart 4)" },
      { id: "chart5", label: "브랜드별 비중 (Chart 5)" },
      { id: "chart6", label: "브랜드 월평균 vs 당월 (Chart 6)" },
    ],
  },
  { id: "brandDetail", label: "브랜드 상세" },
  { id: "channelOverview", label: "채널 종합" },
  { id: "channelIssue", label: "주요 채널 이슈" },
];

const STORAGE_KEY = "avk_monthly_review_visible_charts";

export function defaultVisibility(): VisibilityMap {
  const base: Record<string, boolean> = {};
  ALL_CHART_IDS.forEach((id) => (base[id] = true));
  ALL_SECTION_IDS.forEach((id) => (base[id] = true));
  return base as VisibilityMap;
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
    for (const id of ALL_SECTION_IDS) {
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
  /** 편집 모드: 켜면 화면에 상품 추가·수정 등 편집 버튼 노출 */
  editMode: boolean;
  onEditModeChange: (next: boolean) => void;
}

export default function ChartVisibilityModal({
  open,
  onClose,
  visibility,
  onChange,
  editMode,
  onEditModeChange,
}: Props) {
  const [draft, setDraft] = useState<VisibilityMap>(visibility);
  const [draftEditMode, setDraftEditMode] = useState<boolean>(editMode);

  useEffect(() => {
    if (open) {
      setDraft(visibility);
      setDraftEditMode(editMode);
    }
  }, [open, visibility, editMode]);

  if (!open) return null;

  const toggleChart = (id: ChartId) => {
    setDraft((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSection = (id: SectionId) => {
    setDraft((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApply = () => {
    onChange(draft);
    saveVisibility(draft);
    onEditModeChange(draftEditMode);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#c4c4c4] max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#c4c4c4] sticky top-0 bg-white">
          <h2 className="text-[18px] font-bold text-black">편집 모드</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5d5d5d] hover:text-black text-[13px]"
          >
            닫기 ×
          </button>
        </div>

        {/* 편집 모드 스위치 */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between bg-[#f5f5f5] border border-[#c4c4c4] rounded px-3 py-2.5">
            <div className="pr-3">
              <div className="text-[14px] font-bold text-black">편집 모드 활성화</div>
              <div className="text-[11px] text-[#5d5d5d] leading-relaxed">
                켜면 상품 추가·표시 항목 수정·그룹 설정 등 편집 버튼이 화면에 표시됩니다.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draftEditMode}
              onClick={() => setDraftEditMode((v) => !v)}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                draftEditMode ? "bg-black" : "bg-[#c4c4c4]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  draftEditMode ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        </div>

        <p className="px-5 pt-4 text-[12px] text-[#5d5d5d]">
          표시할 차트와 섹션을 선택하세요. 변경은 적용 시 저장됩니다.
        </p>

        <div className="p-5 pt-2 space-y-3">
          {SECTIONS.map((section) => (
            <div key={section.id}>
              {/* Section-level toggle */}
              <label className="flex items-center gap-2 cursor-pointer hover:bg-[#f5f5f5] px-1 py-1.5 rounded">
                <input
                  type="checkbox"
                  checked={draft[section.id]}
                  onChange={() => toggleSection(section.id)}
                  className="w-4 h-4 accent-black"
                />
                <span className={`text-[14px] font-bold ${draft[section.id] ? "text-black" : "text-[#5d5d5d]"}`}>
                  {section.label}
                </span>
              </label>
              {/* Sub-charts (if any) — section이 켜져 있을 때만 활성 */}
              {section.charts && (
                <div className="ml-6 mt-1 space-y-1">
                  {section.charts.map((c) => {
                    const sectionOn = draft[section.id];
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 px-1 py-1 rounded text-[13px] ${
                          sectionOn ? "cursor-pointer hover:bg-[#f5f5f5]" : "opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={draft[c.id]}
                          onChange={() => sectionOn && toggleChart(c.id)}
                          disabled={!sectionOn}
                          className="w-4 h-4 accent-black"
                        />
                        <span className={draft[c.id] ? "text-black" : "text-[#5d5d5d]"}>{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="border-b border-dashed border-[#c4c4c4] mt-2" />
            </div>
          ))}
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
