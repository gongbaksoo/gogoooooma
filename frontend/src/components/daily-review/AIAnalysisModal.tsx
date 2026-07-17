"use client";

// 일 리뷰 AI 분석 모달.
//   - 월 리뷰 버전을 복제·단순화(파트/대상월 없음, 화면에 뜬 summary 그대로 전송).
//   - 분석 지침은 코드 동봉 기본값으로 바로 동작하고, 저장하면 그 값이 우선(런타임 파일).
//   - 하드룰(전일비 금지·배치 해석 금지·활동 인과 금지 등)은 백엔드 코드에 박혀 있어 편집 불가.
//   - 예외·플래그·범위 밖이 하나도 없으면 백엔드가 LLM을 부르지 않고 고정 문구를 준다(llm_called=false).
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";
import { DailyReview } from "./types";

export default function AIAnalysisModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: DailyReview;
}) {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [editing, setEditing] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState("");
  const [llmCalled, setLlmCalled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult("");
    setLlmCalled(null);
    setCopied(false);
    setEditing(false);
    axios
      .get(`${API_BASE_URL}/api/daily-review/analysis-prompt/`)
      .then((res) => {
        const p: string = res.data?.prompt ?? "";
        setPrompt(p);
        setDraft(p);
        setIsDefault(Boolean(res.data?.is_default));
      })
      .catch(() => {
        setPrompt("");
        setDraft("");
      });
  }, [open]);

  if (!open) return null;

  const dirty = draft !== prompt;

  const savePrompt = async () => {
    setSavingPrompt(true);
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/api/daily-review/analysis-prompt/`, { prompt: draft });
      setPrompt(draft);
      setIsDefault(false);
    } catch {
      setError("프롬프트 저장에 실패했습니다.");
    } finally {
      setSavingPrompt(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch {
      // clipboard API는 보안 컨텍스트(HTTPS) 전용 — 폴백 필수 (docs/error.md §57)
      const ta = document.createElement("textarea");
      ta.value = result;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    setResult("");
    setLlmCalled(null);
    setCopied(false);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/daily-review/ai-analysis/`,
        { summary: data, api_key: "server_managed" },
        { timeout: 90000 }
      );
      setResult(res.data?.analysis ?? "");
      setLlmCalled(Boolean(res.data?.llm_called));
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "AI 분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e5e5]">
          <h3 className="text-[14px] font-bold text-black">
            AI 분석 — {data.meta.target_date}({data.meta.weekday}) 계상 기준
          </h3>
          <button onClick={onClose} className="text-[#888] hover:text-black text-[20px] leading-none" aria-label="닫기">
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <p className="text-[12px] text-[#888] leading-relaxed">
            화면에 뜬 값만 근거로 분석합니다. 전일비·전년 동일자·착지 금액은 만들지 않고, 배치 채널(쿠팡 사입·다이소)의
            일 변동을 성과로 해석하지 않습니다 — 이 규칙은 서버에 고정되어 편집할 수 없습니다.
          </p>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[12px] font-bold text-[#555]">
                분석 지침{isDefault && <span className="ml-1.5 font-normal text-[#888]">(기본값)</span>}
              </label>
              <button
                onClick={() => setEditing((v) => !v)}
                className="text-[11px] border border-[#c4c4c4] px-2 py-0.5 rounded hover:border-black"
              >
                {editing ? "닫기" : "편집"}
              </button>
            </div>
            {editing ? (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={5}
                  className="w-full border border-[#c4c4c4] rounded px-2 py-1.5 text-[13px] focus:outline-none focus:border-black resize-y"
                />
                <div className="flex items-center justify-end gap-2 mt-1">
                  {dirty && <span className="text-[11px] text-[#c47a00]">저장해야 분석에 반영됩니다.</span>}
                  <button
                    onClick={savePrompt}
                    disabled={!dirty || savingPrompt}
                    className="text-[11px] border border-[#c4c4c4] px-3 py-0.5 rounded hover:border-black disabled:opacity-40"
                  >
                    {savingPrompt ? "저장 중…" : "지침 저장"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-[#666] whitespace-pre-wrap border border-[#eee] rounded px-2 py-1.5 bg-[#fafafa]">
                {prompt}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runAnalysis}
              disabled={analyzing || (editing && dirty)}
              className="text-[13px] bg-black text-white px-4 py-1.5 rounded hover:bg-[#333] disabled:opacity-40"
            >
              {analyzing ? "분석 중…" : "분석하기"}
            </button>
          </div>

          {error && <p className="text-[12px] text-red-600 whitespace-pre-wrap">{error}</p>}

          {result && (
            <div className="border border-[#e5e5e5] rounded p-3 bg-[#fafafa]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#555]">
                  분석 결과
                  {llmCalled === false && (
                    <span className="ml-1.5 font-normal text-[#888]">(신호가 없어 AI를 호출하지 않았습니다)</span>
                  )}
                </span>
                <button
                  onClick={copyResult}
                  className="text-[11px] border border-[#c4c4c4] px-3 py-0.5 rounded hover:border-black"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <p className="text-[13px] text-black whitespace-pre-wrap leading-relaxed">{result}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
