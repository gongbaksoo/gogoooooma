"use client";

// AI 매출 분석 모달 — 대상 월 × 파트 기준.
//   - 분석 가이드(프롬프트)는 파트별로 백엔드에 저장 (편집 모드에서만 편집 가능)
//   - "분석하기" → 화면에 표시 중인 summary(종합+트렌드+채널이슈)를 백엔드로 보내 Gemini 분석
//   - 분석은 "저장된 프롬프트" 기준 → 편집 중 미저장 변경이 있으면 먼저 저장하도록 안내
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

type Part = "all" | "ecommerce" | "offline";

const PART_LABEL: Record<Part, string> = {
  all: "전체",
  ecommerce: "이커머스",
  offline: "오프라인",
};

export default function AIAnalysisModal({
  open,
  onClose,
  month,
  part,
  editMode,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  part: Part;
  editMode: boolean;
  summary: unknown;
}) {
  const [prompt, setPrompt] = useState(""); // 백엔드에 저장된 프롬프트
  const [draft, setDraft] = useState(""); // 편집 중 임시값
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 모달 열림 / 파트 변경 시 해당 파트 프롬프트 로드 + 결과 초기화
  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult("");
    axios
      .get(`${API_BASE_URL}/api/monthly-review/analysis-prompt/`, { params: { part } })
      .then((res) => {
        const p: string = res.data?.prompt ?? "";
        setPrompt(p);
        setDraft(p);
      })
      .catch(() => {
        setPrompt("");
        setDraft("");
      });
  }, [open, part]);

  if (!open) return null;

  const dirty = draft !== prompt;

  const savePrompt = async () => {
    setSavingPrompt(true);
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/api/monthly-review/analysis-prompt/`, {
        part,
        prompt: draft,
      });
      setPrompt(draft);
    } catch {
      setError("프롬프트 저장에 실패했습니다.");
    } finally {
      setSavingPrompt(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    setResult("");
    try {
      const res = await axios.post(`${API_BASE_URL}/api/monthly-review/ai-analysis/`, {
        month,
        part,
        summary,
        api_key: "server_managed",
      });
      setResult(res.data?.analysis ?? "");
    } catch (e) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "AI 분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const hasData = summary != null;
  const canAnalyze = !analyzing && hasData && prompt.trim() !== "" && !(editMode && dirty);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e5e5]">
          <h3 className="text-[14px] font-bold text-black">
            AI 매출 분석 — {month} / {PART_LABEL[part]}
          </h3>
          <button
            onClick={onClose}
            className="text-[#888] hover:text-black text-[20px] leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {/* 프롬프트 편집 (편집 모드 전용) */}
          {editMode && (
            <div>
              <label className="block text-[12px] font-bold text-[#555] mb-1">
                분석 가이드 (프롬프트) — {PART_LABEL[part]}
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                placeholder="예: 이번 달 실적을 목표 대비·전년 대비로 평가하고, 채널별 특이사항과 다음 달 액션 3가지를 제안해줘."
                className="w-full border border-[#c4c4c4] rounded px-2 py-1.5 text-[13px] focus:outline-none focus:border-black resize-y"
              />
              <div className="flex items-center justify-end gap-2 mt-1">
                {dirty && (
                  <span className="text-[11px] text-[#c47a00]">
                    변경사항을 저장해야 분석에 반영됩니다.
                  </span>
                )}
                <button
                  onClick={savePrompt}
                  disabled={!dirty || savingPrompt}
                  className="text-[11px] border border-[#c4c4c4] px-3 py-0.5 rounded hover:border-black disabled:opacity-40 disabled:hover:border-[#c4c4c4]"
                >
                  {savingPrompt ? "저장 중…" : "프롬프트 저장"}
                </button>
              </div>
            </div>
          )}

          {/* 보기 모드 + 프롬프트 미작성 안내 */}
          {!editMode && prompt.trim() === "" && (
            <p className="text-[13px] text-[#888]">
              아직 분석 가이드가 작성되지 않았습니다. 편집 모드에서 프롬프트를 먼저 작성해 주세요.
            </p>
          )}

          {/* 분석 실행 */}
          <div className="flex items-center gap-2">
            <button
              onClick={runAnalysis}
              disabled={!canAnalyze}
              className="text-[13px] bg-black text-white px-4 py-1.5 rounded hover:bg-[#333] disabled:opacity-40"
            >
              {analyzing ? "분석 중…" : "분석하기"}
            </button>
            {!hasData && (
              <span className="text-[12px] text-[#888]">
                매출·목표 파일과 대상 월을 먼저 선택하면 분석할 수 있습니다.
              </span>
            )}
          </div>

          {error && <p className="text-[12px] text-red-600 whitespace-pre-wrap">{error}</p>}

          {result && (
            <div className="border border-[#e5e5e5] rounded p-3 bg-[#fafafa]">
              <p className="text-[13px] text-black whitespace-pre-wrap leading-relaxed">
                {result}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
