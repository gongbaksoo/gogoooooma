"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";
import { getFileList } from "@/lib/api";
import Chart1Achievement from "@/components/monthly-review/Chart1Achievement";
import Chart2YoYTrend from "@/components/monthly-review/Chart2YoYTrend";
import Chart3MainVsCoupang from "@/components/monthly-review/Chart3MainVsCoupang";
import Chart4BrandTrend from "@/components/monthly-review/Chart4BrandTrend";
import Chart5BrandShare from "@/components/monthly-review/Chart5BrandShare";
import Chart6BrandVsAvg from "@/components/monthly-review/Chart6BrandVsAvg";
import ChannelSection from "@/components/monthly-review/ChannelSection";
import {
  ChannelSelections,
  DEFAULT_CHANNEL_SELECTIONS,
  loadChannelSelections,
  saveChannelSelections,
} from "@/components/monthly-review/channelSelectionStorage";
import ChartVisibilityModal, {
  VisibilityMap,
  defaultVisibility,
  loadVisibility,
} from "@/components/monthly-review/ChartVisibilityModal";
import BrandSection from "@/components/monthly-review/BrandSection";
import {
  Brand,
  BrandSelection,
  PartScopedBrandSelections,
  loadBrandSelections,
  saveBrandSelections,
  DEFAULT_BRAND_SELECTIONS,
} from "@/components/monthly-review/brandSelectionStorage";
import ChannelIssueSection from "@/components/monthly-review/ChannelIssueSection";
import {
  GroupDef,
  PartScopedGroups,
  DEFAULT_CHANNEL_ISSUE_GROUPS,
  loadChannelIssueGroups,
  saveChannelIssueGroups,
} from "@/components/monthly-review/channelIssueStorage";

type Part = "all" | "ecommerce" | "offline";

interface TrendChart {
  title: string;
  series_names: string[];
  colors: string[];
  data: { month: string; values: number[] }[];
}
interface ShareChart {
  title: string;
  series_names: string[];
  colors: string[];
  data: { name: string; value: number }[];
}
interface BarChart {
  title: string;
  series_names: string[];
  colors: string[];
  data: { category: string; monthly_avg: number; current_month: number }[];
}

interface SummaryResponse {
  month: string;
  part: Part;
  chart1: { target: number | null; actual: number; achievement_rate: number | null };
  chart2: { month: string; current_year: number; prev_year: number }[];
  chart3: TrendChart;
  chart4: TrendChart;
  chart5: ShareChart;
  chart6: BarChart;
  chart10: TrendChart;
  chart12: TrendChart;
  chart14: TrendChart;
  brand_products: Record<Brand, { name: string; row_count: number; values: number[] }[]>;
  brand_products_months: string[];
  channel_options: Record<"all" | "ecommerce" | "offline", {
    name: string;
    row_count: number;
    values: number[];
    monthly_avg: number;
    current_month: number;
  }[]>;
  channel_defaults: Record<"all" | "ecommerce" | "offline", string[]>;
  channel_months: string[];
  channel_issue: Record<"all" | "ecommerce" | "offline", {
    channels: {
      name: string;
      row_count: number;
      vendors: { name: string; row_count: number; values: number[] }[];
      brands: { name: string; row_count: number; values: number[] }[];
    }[];
  }>;
  channel_issue_months: string[];
}

interface TargetFile {
  filename: string;
  size: number;
  modified: number;
}

const PART_LABELS: Record<Part, string> = {
  all: "전체",
  ecommerce: "이커머스",
  offline: "오프라인",
};

export default function MonthlyReviewPage() {
  const [salesFiles, setSalesFiles] = useState<{ filename: string }[]>([]);
  const [targetFiles, setTargetFiles] = useState<TargetFile[]>([]);
  const [salesFile, setSalesFile] = useState<string>("");
  const [targetFile, setTargetFile] = useState<string>("");
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string>("");
  const [part, setPart] = useState<Part>("all");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState(false);
  const [uploadingSales, setUploadingSales] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityMap>(defaultVisibility());
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  // 편집 모드: 켜면 상품 추가·수정 등 편집 UI 노출 (평소엔 숨김, 새로고침 시 기본 OFF)
  const [editMode, setEditMode] = useState(false);
  const [brandSelections, setBrandSelections] = useState<PartScopedBrandSelections>(DEFAULT_BRAND_SELECTIONS);
  const [channelSelections, setChannelSelections] = useState<ChannelSelections>(DEFAULT_CHANNEL_SELECTIONS);
  const [channelIssueGroups, setChannelIssueGroups] = useState<PartScopedGroups>(DEFAULT_CHANNEL_ISSUE_GROUPS);

  // 마운트 시 localStorage에서 모든 selections 복원 (SSR 안전)
  useEffect(() => {
    setVisibility(loadVisibility());
    setBrandSelections(loadBrandSelections());
    setChannelSelections(loadChannelSelections());
    setChannelIssueGroups(loadChannelIssueGroups());
  }, []);

  const updateBrandSelection = (p: Part, brand: Brand, next: BrandSelection) => {
    setBrandSelections((prev) => {
      const updated = {
        ...prev,
        [p]: { ...prev[p], [brand]: next },
      };
      saveBrandSelections(updated);
      return updated;
    });
  };

  const updateChannelSelection = (p: Part, next: string[]) => {
    setChannelSelections((prev) => {
      const updated = { ...prev, [p]: next };
      saveChannelSelections(updated);
      return updated;
    });
  };

  const updateChannelIssueGroups = (p: Part, next: GroupDef[]) => {
    setChannelIssueGroups((prev) => {
      const updated = { ...prev, [p]: next };
      saveChannelIssueGroups(updated);
      return updated;
    });
  };

  const chartGridRef = useRef<HTMLDivElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const salesInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);

  // 원본 컨트롤 영역이 화면 밖으로 나가면 sticky 바 등장
  useEffect(() => {
    const target = controlsRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [summary]);

  // 매출 파일 + 목표 파일 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const data = await getFileList();
        setSalesFiles(data?.files ?? []);
      } catch (e) {
        console.error(e);
      }
      try {
        const res = await axios.get(`${API_BASE_URL}/api/monthly-review/targets/`);
        setTargetFiles(res.data?.files ?? []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // 매출 파일 선택 시 가용 월 로드
  useEffect(() => {
    if (!salesFile) {
      setMonths([]);
      setMonth("");
      return;
    }
    (async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/monthly-review/months/`,
          { params: { filename: salesFile } }
        );
        const ms: string[] = res.data?.months ?? [];
        setMonths(ms);
        setMonth(ms[0] ?? "");
      } catch (e: any) {
        setError(e?.response?.data?.detail || "월 목록을 불러오지 못했습니다.");
      }
    })();
  }, [salesFile]);

  // 종합 요약 로드
  useEffect(() => {
    if (!salesFile || !month) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    axios
      .get(`${API_BASE_URL}/api/monthly-review/summary/`, {
        params: { filename: salesFile, month, part, target_file: targetFile || undefined },
      })
      .then((res) => setSummary(res.data))
      .catch((e) => setError(e?.response?.data?.detail || "데이터 로드 실패"))
      .finally(() => setLoading(false));
  }, [salesFile, month, part, targetFile]);

  const handleTargetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTarget(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await axios.post(`${API_BASE_URL}/api/monthly-review/targets/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const res = await axios.get(`${API_BASE_URL}/api/monthly-review/targets/`);
      setTargetFiles(res.data?.files ?? []);
      setTargetFile(file.name);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "목표 파일 업로드 실패");
    } finally {
      setUploadingTarget(false);
      if (targetInputRef.current) targetInputRef.current.value = "";
    }
  };

  const handleSalesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError("CSV 또는 XLSX 파일만 업로드 가능합니다.");
      return;
    }
    setUploadingSales(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await axios.post(`${API_BASE_URL}/api/upload/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = await getFileList();
      setSalesFiles(data?.files ?? []);
      setSalesFile(file.name);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "매출 파일 업로드 실패");
    } finally {
      setUploadingSales(false);
      if (salesInputRef.current) salesInputRef.current.value = "";
    }
  };

  const handlePdfDownload = async () => {
    if (!chartGridRef.current) return;
    setPdfBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(chartGridRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let w = pageW - 20;
      let h = w / ratio;
      if (h > pageH - 20) {
        h = pageH - 20;
        w = h * ratio;
      }
      pdf.addImage(img, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save(`monthly-review-${month}-${part}.pdf`);
    } catch (e) {
      console.error(e);
      setError("PDF 생성 실패");
    } finally {
      setPdfBusy(false);
    }
  };

  const ghostSelect =
    "border border-[#c4c4c4] bg-white text-black text-[13px] px-3 py-2 rounded hover:border-black focus:border-black focus:outline-none";

  return (
    <div className="min-h-screen bg-white px-5 py-8 md:px-10">
      {/* Sticky 컴팩트 바 — 원본 컨트롤 영역이 화면 밖일 때만 등장 */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#c4c4c4] shadow-sm transition-opacity duration-200 ${
          stickyVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 pr-3 border-r border-[#c4c4c4]">
              <Link href="/" className="text-[11px] text-[#5d5d5d] hover:text-black">
                ← 뒤로
              </Link>
              <span className="text-[13px] font-bold text-black">월 리뷰</span>
            </div>
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-black">대상 월</span>
              <select
                className="border border-[#c4c4c4] bg-white text-black text-[12px] px-2 py-1 rounded hover:border-black focus:border-black focus:outline-none"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={!months.length}
              >
                {months.length === 0 && <option value="">— 매출 파일 먼저 —</option>}
                {months.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-black">파트</span>
              <div className="flex gap-1">
                {(Object.keys(PART_LABELS) as Part[]).map((p) => {
                  const active = p === part;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPart(p)}
                      className={`text-[12px] px-2 py-1 rounded border transition ${
                        active
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-[#c4c4c4] hover:border-black"
                      }`}
                    >
                      {PART_LABELS[p]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVisibilityModalOpen(true)}
              className={`border text-[12px] px-3 py-1 rounded ${
                editMode
                  ? "border-black bg-black text-white"
                  : "border-[#c4c4c4] bg-white text-black hover:border-black"
              }`}
            >
              편집 모드
            </button>
            <button
              type="button"
              onClick={handlePdfDownload}
              disabled={pdfBusy || !summary}
              className="bg-black text-white text-[12px] font-bold px-3 py-1 rounded-[2px] disabled:opacity-50"
            >
              {pdfBusy ? "생성 중..." : "PDF 다운로드"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] text-[#5d5d5d] hover:text-black">
              ← 뒤로
            </Link>
            <h1 className="text-[24px] font-bold text-black">월 리뷰</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVisibilityModalOpen(true)}
              className={`border text-[13px] px-3 py-2 rounded ${
                editMode
                  ? "border-black bg-black text-white"
                  : "border-[#c4c4c4] bg-white text-black hover:border-black"
              }`}
            >
              편집 모드
            </button>
            <button
              type="button"
              onClick={handlePdfDownload}
              disabled={pdfBusy || !summary}
              className="bg-black text-white text-[13px] font-bold px-4 py-2 rounded-[2px] disabled:opacity-50"
            >
              {pdfBusy ? "생성 중..." : "PDF 다운로드"}
            </button>
          </div>
        </div>

        {/* 컨트롤 */}
        <div ref={controlsRef} className="border border-[#c4c4c4] p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-black">매출 파일</span>
            <div className="flex gap-2">
              <select
                className={`${ghostSelect} flex-1`}
                value={salesFile}
                onChange={(e) => setSalesFile(e.target.value)}
              >
                <option value="">— 선택 —</option>
                {salesFiles.map((f) => (
                  <option key={f.filename} value={f.filename}>
                    {f.filename}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => salesInputRef.current?.click()}
                disabled={uploadingSales}
                className="border border-[#c4c4c4] bg-white text-black text-[13px] px-3 py-2 rounded hover:border-black disabled:opacity-50"
              >
                {uploadingSales ? "업로드 중..." : "업로드"}
              </button>
              <input
                ref={salesInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={handleSalesUpload}
                className="hidden"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-black">목표 파일</span>
            <div className="flex gap-2">
              <select
                className={`${ghostSelect} flex-1`}
                value={targetFile}
                onChange={(e) => setTargetFile(e.target.value)}
              >
                <option value="">— 선택 (선택) —</option>
                {targetFiles.map((f) => (
                  <option key={f.filename} value={f.filename}>
                    {f.filename}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => targetInputRef.current?.click()}
                disabled={uploadingTarget}
                className="border border-[#c4c4c4] bg-white text-black text-[13px] px-3 py-2 rounded hover:border-black disabled:opacity-50"
              >
                {uploadingTarget ? "업로드 중..." : "업로드"}
              </button>
              <input
                ref={targetInputRef}
                type="file"
                accept=".csv"
                onChange={handleTargetUpload}
                className="hidden"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-black">대상 월</span>
            <select
              className={ghostSelect}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={!months.length}
            >
              {months.length === 0 && <option value="">— 매출 파일 먼저 선택 —</option>}
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-black">파트</span>
            <div className="flex gap-2">
              {(Object.keys(PART_LABELS) as Part[]).map((p) => {
                const active = p === part;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPart(p)}
                    className={`text-[13px] px-3 py-2 rounded border transition ${
                      active
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-[#c4c4c4] hover:border-black"
                    }`}
                  >
                    {PART_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 에러 / 로딩 / 빈 상태 */}
        {error && (
          <div className="border border-[#ff0066] text-[#ff0066] p-3 mb-4 text-[13px]">{error}</div>
        )}

        {!salesFile && (
          <div className="text-center text-[13px] text-[#5d5d5d] py-12">
            매출 파일을 선택해주세요.
          </div>
        )}

        {salesFile && !summary && loading && (
          <div className="text-center text-[13px] text-[#5d5d5d] py-12">불러오는 중...</div>
        )}

        {/* 차트 그리드 — 섹션 내 visible 차트만 렌더, 섹션 안에 visible 차트 0개면 섹션도 숨김 */}
        {summary && (() => {
          const sectionGroups: { title: string; charts: { id: keyof VisibilityMap; el: React.ReactNode }[] }[] = [
            {
              title: "종합",
              charts: [
                { id: "chart1", el: <Chart1Achievement data={summary.chart1} month={month} /> },
                { id: "chart2", el: <Chart2YoYTrend data={summary.chart2} /> },
                { id: "chart3", el: <Chart3MainVsCoupang chart3={summary.chart3} /> },
              ],
            },
            {
              title: "브랜드 종합",
              charts: [
                { id: "chart4", el: <Chart4BrandTrend chart4={summary.chart4} /> },
                { id: "chart5", el: <Chart5BrandShare chart5={summary.chart5} /> },
                { id: "chart6", el: <Chart6BrandVsAvg chart6={summary.chart6} /> },
              ],
            },
          ];
          // 브랜드 상세 섹션은 BrandSection 컴포넌트 3개 (마이비/누비/쏭레브)
          const brandTotalMap: Record<Brand, TrendChart> = {
            마이비: summary.chart10,
            누비: summary.chart12,
            쏭레브: summary.chart14,
          };
          // 섹션별 sectionId mapping for visibility
          const sectionVisibilityIds: Record<string, "overview" | "brandOverview"> = {
            "종합": "overview",
            "브랜드 종합": "brandOverview",
          };
          return (
            <div ref={chartGridRef} className="bg-white space-y-8">
              {sectionGroups.map((section) => {
                const secVisId = sectionVisibilityIds[section.title];
                // 섹션 자체가 OFF면 통째로 숨김
                if (secVisId && !visibility[secVisId]) return null;
                const visibleCharts = section.charts.filter((c) => visibility[c.id]);
                if (visibleCharts.length === 0) return null;
                return (
                  <section key={section.title}>
                    <h2 className="text-[15px] font-bold text-black mb-3 pb-2 border-b border-[#c4c4c4]">
                      {section.title}
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {visibleCharts.map((c) => (
                        <div key={c.id}>{c.el}</div>
                      ))}
                    </div>
                  </section>
                );
              })}

              {/* 브랜드 상세 — 브랜드 종합 바로 아래 (16-18회차 토글 + 파트별 selection) */}
              {visibility.brandDetail && (
                <div className="space-y-8 pt-4">
                  <h2 className="text-[15px] font-bold text-black mb-3 pb-2 border-b border-[#c4c4c4]">
                    브랜드 상세
                  </h2>
                  {(["마이비", "누비", "쏭레브"] as Brand[]).map((brand) => (
                    <BrandSection
                      key={`${part}-${brand}`}
                      brand={brand}
                      totalChart={brandTotalMap[brand]}
                      products={summary.brand_products[brand] ?? []}
                      months={summary.brand_products_months}
                      selection={brandSelections[part][brand]}
                      onSelectionChange={(next) => updateBrandSelection(part, brand, next)}
                      editMode={editMode}
                    />
                  ))}
                </div>
              )}

              {/* 채널 종합 */}
              {visibility.channelOverview && (
                <section>
                  <ChannelSection
                    part={part}
                    options={summary.channel_options[part] ?? []}
                    months={summary.channel_months}
                    selected={channelSelections[part]}
                    onSelectedChange={(next) => updateChannelSelection(part, next)}
                    editMode={editMode}
                  />
                </section>
              )}

              {/* 주요 채널 이슈 — 채널 종합 아래 (신규) */}
              {visibility.channelIssue && (
                <section>
                  <ChannelIssueSection
                    part={part}
                    channels={summary.channel_issue?.[part]?.channels ?? []}
                    months={summary.channel_issue_months ?? summary.channel_months}
                    groups={channelIssueGroups[part]}
                    onGroupsChange={(next) => updateChannelIssueGroups(part, next)}
                    editMode={editMode}
                  />
                </section>
              )}
            </div>
          );
        })()}

        <ChartVisibilityModal
          open={visibilityModalOpen}
          onClose={() => setVisibilityModalOpen(false)}
          visibility={visibility}
          onChange={setVisibility}
          editMode={editMode}
          onEditModeChange={setEditMode}
        />
      </div>
    </div>
  );
}
