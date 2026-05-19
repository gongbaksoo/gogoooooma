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
}

const toMan = (v: number) => Math.round(v / 1_000_000);
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
        row[p.name] = toMan(p.values[idx] ?? 0);
      });
      return row;
    });
    const styles = selected.map((_, i) => getMultiSeriesStyle(i));
    return { data, names: selected.map((p) => p.name), styles };
  }, [selection.mainLine, productByName, months]);

  // 종합 트렌드 차트 데이터
  const totalData = totalChart.data.map((d) => ({
    month: shortLabel(d.month),
    [brand]: toMan(d.values[0] ?? 0),
  }));

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

      {/* Row 1: 종합 (1) + 주요 상품 라인 (2 wide) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* ① 종합 트렌드 */}
        <div className="bg-white border border-[#c4c4c4] p-5">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[15px] font-bold text-black">{brand} 종합 트렌드</h3>
            <span className="text-[12px] text-[#5d5d5d]">12개월 (단위: 백만)</span>
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
                <Line type="monotone" dataKey={brand} stroke="#000000" strokeWidth={2} dot={{ r: 2 }} animationDuration={1500} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ② 주요 상품 라인 */}
        <div className="bg-white border border-[#c4c4c4] p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[15px] font-bold text-black">{brand} 주요 상품 라인</h3>
            <button
              type="button"
              onClick={() => setEditMainOpen(true)}
              className="text-[11px] border border-[#c4c4c4] px-2 py-1 rounded hover:border-black"
            >
              표시 상품 수정 ▾
            </button>
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
                    formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
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
                        dot={{ r: 2, fill: s.stroke }}
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
            [p.name]: toMan(p.values[idx] ?? 0),
          }));
          return (
            <div key={p.name} className="bg-white border border-[#c4c4c4] p-4">
              <div className="flex items-baseline justify-between mb-1">
                <h4 className="text-[13px] font-bold text-black truncate">{p.name}</h4>
                <button
                  type="button"
                  onClick={() => removeIndividual(p.name)}
                  className="text-[12px] text-[#5d5d5d] hover:text-black px-1.5"
                  title="이 차트 제거"
                >
                  ×
                </button>
              </div>
              <div key={`ind-${p.name}-${months.length}`}>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" stroke="#5d5d5d" tick={{ fontSize: 10 }} axisLine={{ stroke: "#c4c4c4" }} />
                    <YAxis stroke="#5d5d5d" tick={{ fontSize: 10 }} axisLine={{ stroke: "#c4c4c4" }} />
                    <Tooltip
                      contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 11 }}
                      formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
                    />
                    <Line type="monotone" dataKey={p.name} stroke="#000000" strokeWidth={2} dot={{ r: 2 }} animationDuration={1500} animationEasing="ease-out" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}

        {/* + 추가 카드 */}
        <button
          type="button"
          onClick={() => setAddIndividualOpen(true)}
          className="border border-dashed border-[#c4c4c4] bg-[#fafafa] min-h-[200px] flex flex-col items-center justify-center hover:border-black hover:bg-[#f5f5f5] transition"
        >
          <span className="text-[24px] text-black mb-1">+</span>
          <span className="text-[13px] text-[#5d5d5d]">상품 추가</span>
        </button>
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
