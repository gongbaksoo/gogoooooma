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
import { getMultiSeriesStyle } from "@/lib/chartPalette";

interface Chart4Point {
  month: string;
  values: number[];
}

interface Chart4Props {
  chart4: {
    title: string;
    series_names: string[];
    colors: string[];
    data: Chart4Point[];
  };
  /** 편집 모드: 켜면 "표시 항목 수정" 버튼 노출 */
  editMode?: boolean;
  /** 표시 시리즈 선택 (순서 = 표시 우선순위). 비중 차트와 공유. undefined면 전체 표시 */
  selected?: string[];
  onSelectedChange?: (next: string[]) => void;
}

const toMan = (v: number) => Math.round(v / 1_000_000);
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

export default function Chart4BrandTrend({
  chart4,
  editMode = false,
  selected,
  onSelectedChange,
}: Chart4Props) {
  const { title, series_names, data } = chart4;
  const [modalOpen, setModalOpen] = useState(false);

  const indexByName = useMemo(() => {
    const m = new Map<string, number>();
    series_names.forEach((n, i) => m.set(n, i));
    return m;
  }, [series_names]);

  const visibleSeries = useMemo(() => {
    if (selected == null) return series_names;
    return selected.filter((n) => indexByName.has(n));
  }, [selected, series_names, indexByName]);

  const styles = visibleSeries.map((_, i) => getMultiSeriesStyle(i));

  const chartData = data.map((d) => {
    const row: Record<string, string | number> = { month: shortLabel(d.month) };
    visibleSeries.forEach((name) => {
      const idx = indexByName.get(name)!;
      row[name] = toMan(d.values[idx] ?? 0);
    });
    return row;
  });

  const productOptions: ProductOption[] = series_names.map((name) => ({ name }));

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] text-[#5d5d5d]">단위: 백만</span>
          {editMode && onSelectedChange && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-[11px] border border-[#c4c4c4] px-2 py-0.5 rounded hover:border-black whitespace-nowrap"
            >
              수정 ▾
            </button>
          )}
        </div>
      </div>

      {visibleSeries.length === 0 ? (
        <div className="text-center text-[13px] text-[#5d5d5d] py-16 border border-dashed border-[#c4c4c4]">
          표시할 항목을 선택해주세요
        </div>
      ) : (
        <div key={`${data[0]?.month ?? ""}-${visibleSeries.join("|")}`}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
              <YAxis stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
              <Tooltip
                contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} iconType="plainline" />
              {visibleSeries.map((name, i) => {
                const s = styles[i];
                return (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={s.stroke}
                    strokeWidth={s.strokeWidth}
                    strokeDasharray={s.strokeDasharray}
                    dot={{ r: s.dotR, fill: s.stroke }}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {onSelectedChange && (
        <ProductSelectionModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="브랜드별 매출 — 표시 항목 수정"
          description="선택한 브랜드만 트렌드·비중 차트에 함께 표시됩니다. 순서를 바꾸면 선 색·범례 순서가 바뀝니다."
          options={productOptions}
          selected={visibleSeries}
          onApply={onSelectedChange}
          searchable={false}
        />
      )}
    </div>
  );
}
