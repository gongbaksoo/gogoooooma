"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import ProductSelectionModal, { ProductOption } from "./ProductSelectionModal";
import { Brand, BrandSelection } from "./brandSelectionStorage";
import { getMultiSeriesStyle } from "@/lib/chartPalette";

interface BrandProduct {
  name: string;
  row_count: number;
  values: number[]; // length = months.length
}

interface BrandTotalChart {
  title: string;
  series_names: string[];
  colors: string[];
  data: { month: string; values: number[] }[];
}

interface Props {
  brand: Brand;
  totalChart: BrandTotalChart;
  products: BrandProduct[]; // 해당 브랜드 전체 옵션 (모든 S열 값)
  months: string[];          // 백엔드 brand_products_months
  selection: BrandSelection;
  onSelectionChange: (next: BrandSelection) => void;
  editMode: boolean;
}

// 브랜드 종합 트렌드는 집계값(수백만~수천만)이라 백만원 단위.
const toMillion = (v: number) => Math.round(v / 1_000_000);
// 품목(상품) 차트는 100만원 미만 항목이 많아 백만 반올림이면 0/1로 뭉개지므로 만원 단위(천원 반올림). (error.md §45)
const toManWon = (v: number) => Math.round(v / 10_000);
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

export default function BrandSection({
  brand,
  totalChart,
  products,
  months,
  selection,
  onSelectionChange,
  editMode,
}: Props) {
  const [editMainOpen, setEditMainOpen] = useState(false);
  const [addIndividualOpen, setAddIndividualOpen] = useState(false);

  // 제품 검색용 dictionary
  const productByName = useMemo(() => {
    const map = new Map<string, BrandProduct>();
    products.forEach((p) => map.set(p.name, p));
    return map;
  }, [products]);

  const options: ProductOption[] = products.map((p) => ({
    name: p.name,
    row_count: p.row_count,
  }));

  // 주요 상품 라인 차트 데이터 (선택된 상품들 모아서 multi-line)
  const mainLineData = useMemo(() => {
    const selected = selection.mainLine.map((name) => productByName.get(name)).filter(Boolean) as BrandProduct[];
    if (selected.length === 0) return { data: [], names: [], styles: [] };
    const data = months.map((m, idx) => {
      const row: Record<string, string | number> = { month: shortLabel(m) };
      selected.forEach((p) => {
        row[p.name] = toManWon(p.values[idx] ?? 0);
      });
      return row;
    });
    const styles = selected.map((_, i) => getMultiSeriesStyle(i));
    return { data, names: selected.map((p) => p.name), styles };
  }, [selection.mainLine, productByName, months]);

  // 종합 트렌드 차트 데이터
  const totalData = totalChart.data.map((d) => ({
    month: shortLabel(d.month),
    [brand]: toMillion(d.values[0] ?? 0),
  }));

  // 13개월(대상월-12~대상월) 시계열 → 실적 요약 지표. 마지막=당월, [0]=전년 동월.
  const summarize = (vals: number[]) => {
    const n = vals.length;
    if (n === 0) return null;
    return {
      actual: vals[n - 1],
      prevMonth: n >= 2 ? vals[n - 2] : null,
      prev3Avg: n >= 4 ? (vals[n - 2] + vals[n - 3] + vals[n - 4]) / 3 : null,
      prevYear: n >= 13 ? vals[0] : null, // 13개월 첫 점 = 전년 동월
    };
  };
  // 헤더 아래 브랜드 전체 요약 — 「종합」 형식, 목표 데이터 없어 목표비 제외.
  const summary = useMemo(
    () => summarize(totalChart.data.map((d) => d.values[0] ?? 0)),
    [totalChart.data]
  );
  // 선택된 주요 상품 라인별 요약 (만원 단위). selection.mainLine 순서 유지.
  const productSummaries = useMemo(() => {
    return selection.mainLine
      .map((name) => productByName.get(name))
      .filter(Boolean)
      .map((p) => ({ name: p!.name, s: summarize(p!.values) }))
      .filter((x) => x.s != null);
  }, [selection.mainLine, productByName]);
  const fmtGrowth = (actual: number, base: number | null) => {
    if (base == null || base <= 0) return "-";
    const g = ((actual - base) / base) * 100;
    return `${g >= 0 ? "▲" : "▼"}${Math.abs(g).toFixed(1)}%`;
  };

  // 개별 상품 차트들 (selection.individual 순서대로)
  const individualProducts = selection.individual
    .map((name) => productByName.get(name))
    .filter(Boolean) as BrandProduct[];

  // "+ 추가" 모달용 옵션: 이미 individual에 있는 건 제외
  const availableForIndividual = options.filter((o) => !selection.individual.includes(o.name));

  const removeIndividual = (name: string) => {
    onSelectionChange({
      ...selection,
      individual: selection.individual.filter((n) => n !== name),
    });
  };

  return (
    <section>
      <h2 className="text-[18px] font-bold text-black mb-3 pb-2 border-b-2 border-black">
        {brand}
      </h2>

      {/* 실적 요약 — 브랜드 전체(백만) + 선택 주요 상품별(만원). 목표비 제외(목표 미보유) */}
      {summary && (
        <div className="mb-3">
          <p className="text-[13px] text-black">
            실적 : <span className="font-bold">{Math.round(summary.actual / 1_000_000).toLocaleString()}</span> 백만{" "}
            <span className="text-[#5d5d5d]">
              (전월비 {fmtGrowth(summary.actual, summary.prevMonth)} , 직전 3개월비{" "}
              {fmtGrowth(summary.actual, summary.prev3Avg)} , 전년비 {fmtGrowth(summary.actual, summary.prevYear)})
            </span>
          </p>
          {/* 브랜드 전체 ↔ 상품 요약 사이 한 줄 간격 */}
          <div className="mt-3 space-y-0.5">
            {productSummaries.map(({ name, s }) => (
              <p key={name} className="text-[13px] text-black">
                <span className="font-bold">{name}</span> 실적 :{" "}
                <span className="font-bold">{Math.round(s!.actual / 10_000).toLocaleString()}</span> 만원{" "}
                <span className="text-[#5d5d5d]">
                  (전월비 {fmtGrowth(s!.actual, s!.prevMonth)} , 직전 3개월비 {fmtGrowth(s!.actual, s!.prev3Avg)} , 전년비{" "}
                  {fmtGrowth(s!.actual, s!.prevYear)})
                </span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Row 1: 종합 (1) + 주요 상품 라인 (2 wide) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* ① 종합 트렌드 */}
        <div className="bg-white border border-[#c4c4c4] p-5">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[15px] font-bold text-black">{brand} 종합 트렌드</h3>
            <span className="text-[12px] text-[#5d5d5d]">13개월 (단위: 백만)</span>
          </div>
          <div key={`total-${brand}-${months.length}`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={totalData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" stroke="#5d5d5d" tick={{ fontSize: 11 }} axisLine={{ stroke: "#c4c4c4" }} />
                <YAxis stroke="#5d5d5d" tick={{ fontSize: 11 }} axisLine={{ stroke: "#c4c4c4" }} />
                <Tooltip
                  contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                  formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
                />
                <Line type="monotone" dataKey={brand} stroke="#000000" strokeWidth={2} dot={{ r: 1.5 }} animationDuration={1500} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ② 주요 상품 라인 */}
        <div className="bg-white border border-[#c4c4c4] p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[15px] font-bold text-black">{brand} 주요 상품 라인</h3>
            {editMode && (
              <button
                type="button"
                onClick={() => setEditMainOpen(true)}
                className="text-[11px] border border-[#c4c4c4] px-2 py-1 rounded hover:border-black"
              >
                표시 상품 수정 ▾
              </button>
            )}
          </div>
          {mainLineData.names.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-[13px] text-[#5d5d5d]">
              표시할 상품을 선택해주세요
            </div>
          ) : (
            <div key={`main-${brand}-${mainLineData.names.join("|")}`}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={mainLineData.data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" stroke="#5d5d5d" tick={{ fontSize: 11 }} axisLine={{ stroke: "#c4c4c4" }} />
                  <YAxis stroke="#5d5d5d" tick={{ fontSize: 11 }} axisLine={{ stroke: "#c4c4c4" }} />
                  <Tooltip
                    contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                    formatter={(v: number, name: string) => [`${v.toLocaleString()} 만원`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} itemSorter={null} iconType="plainline" />
                  {mainLineData.names.map((name, i) => {
                    const s = mainLineData.styles[i];
                    return (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={s.stroke}
                        strokeWidth={s.strokeWidth}
                        strokeDasharray={s.strokeDasharray}
                        dot={{ r: 1.5, fill: s.stroke }}
                        animationDuration={1500}
                        animationEasing="ease-out"
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Row 2+: 개별 상품 카드들 + 추가 카드 */}
      <h3 className="text-[12px] font-bold text-[#5d5d5d] uppercase tracking-wider mb-2">
        개별 상품 ({individualProducts.length}개)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {individualProducts.map((p) => {
          const data = months.map((m, idx) => ({
            month: shortLabel(m),
            [p.name]: toManWon(p.values[idx] ?? 0),
          }));
          return (
            <div key={p.name} className="bg-white border border-[#c4c4c4] p-4">
              <div className="flex items-baseline justify-between mb-1">
                <h4 className="text-[13px] font-bold text-black truncate">{p.name}</h4>
                {editMode && (
                  <button
                    type="button"
                    onClick={() => removeIndividual(p.name)}
                    className="text-[12px] text-[#5d5d5d] hover:text-black px-1.5"
                    title="이 차트 제거"
                  >
                    ×
                  </button>
                )}
              </div>
              <div key={`ind-${p.name}-${months.length}`}>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" stroke="#5d5d5d" tick={{ fontSize: 10 }} axisLine={{ stroke: "#c4c4c4" }} />
                    <YAxis stroke="#5d5d5d" tick={{ fontSize: 10 }} axisLine={{ stroke: "#c4c4c4" }} />
                    <Tooltip
                      contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                      formatter={(v: number, name: string) => [`${v.toLocaleString()} 만원`, name]}
                    />
                    <Line type="monotone" dataKey={p.name} stroke="#000000" strokeWidth={2} dot={{ r: 1.5 }} animationDuration={1500} animationEasing="ease-out" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}

        {/* + 추가 카드 — 편집 모드에서만 노출 */}
        {editMode && (
          <button
            type="button"
            onClick={() => setAddIndividualOpen(true)}
            className="border border-dashed border-[#c4c4c4] bg-[#fafafa] min-h-[200px] flex flex-col items-center justify-center hover:border-black hover:bg-[#f5f5f5] transition"
          >
            <span className="text-[24px] text-black mb-1">+</span>
            <span className="text-[13px] text-[#5d5d5d]">상품 추가</span>
          </button>
        )}
      </div>

      {/* 모달 — 주요 상품 라인 수정 */}
      <ProductSelectionModal
        open={editMainOpen}
        onClose={() => setEditMainOpen(false)}
        title={`${brand} 주요 상품 라인 — 표시 상품 수정`}
        description={`엑셀 S열(품목 구분) 중 ${brand} 품목만 표시 — ${options.length}개. 체크된 항목이 차트에 라인으로 추가됩니다.`}
        options={options}
        selected={selection.mainLine}
        onApply={(next) => onSelectionChange({ ...selection, mainLine: next })}
      />

      {/* 모달 — 개별 상품 추가 (이미 추가된 건 옵션에서 제외) */}
      <ProductSelectionModal
        open={addIndividualOpen}
        onClose={() => setAddIndividualOpen(false)}
        title={`${brand} 개별 상품 추가`}
        description="아직 추가되지 않은 상품 중에서 선택하세요. 추가한 상품은 별도 차트로 표시됩니다."
        options={availableForIndividual}
        selected={[]}
        onApply={(next) => {
          onSelectionChange({
            ...selection,
            individual: [...selection.individual, ...next],
          });
        }}
      />
    </section>
  );
}
