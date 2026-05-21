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
  LabelList,
} from "recharts";
import ProductSelectionModal, { ProductOption } from "./ProductSelectionModal";
import { getMultiSeriesStyle } from "@/lib/chartPalette";

interface Chart3Point {
  month: string; // "YYYY-MM"
  values: number[]; // series_names와 같은 길이/순서
}

interface Chart3Props {
  chart3: {
    title: string;
    series_names: string[];
    colors: string[];
    data: Chart3Point[];
  };
  /** 편집 모드: 켜면 "표시 항목 수정" 버튼 노출 */
  editMode?: boolean;
  /** 표시 시리즈 선택 (순서 = 표시 우선순위). undefined면 전체 표시 (기존 동작) */
  selected?: string[];
  onSelectedChange?: (next: string[]) => void;
}

const toMan = (v: number) => Math.round(v / 1_000_000);

// "2026-04" → "26.04"
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

export default function Chart3MainVsCoupang({
  chart3,
  editMode = false,
  selected,
  onSelectedChange,
}: Chart3Props) {
  const { title, series_names, data } = chart3;
  const [modalOpen, setModalOpen] = useState(false);

  // 시리즈명 → 원본 인덱스 (data.values에서 값 추출용)
  const indexByName = useMemo(() => {
    const m = new Map<string, number>();
    series_names.forEach((n, i) => m.set(n, i));
    return m;
  }, [series_names]);

  // 표시 시리즈 (선택 없으면 전체, 백엔드 순서). 선택 시 그 순서대로 + 존재하는 것만
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

  const lastIndex = chartData.length - 1;

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
              <XAxis
                dataKey="month"
                stroke="#5d5d5d"
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: "#c4c4c4" }}
              />
              <YAxis stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
              <Tooltip
                contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} iconType="plainline" />
              {visibleSeries.map((name, i) => {
                const s = styles[i];
                // 첫 시리즈는 위쪽 라벨, 나머지는 아래쪽 (겹침 회피)
                const pos = i === 0 ? "top" : "bottom";
                const dy = i === 0 ? -8 : 14;
                const fontWeight = i === 0 ? "bold" : "normal";
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
                  >
                    <LabelList
                      dataKey={name}
                      position={pos}
                      content={(p: any) => {
                        const { x, y, value, index } = p;
                        if (index !== lastIndex) return null;
                        if (value === undefined || value === null) return null;
                        return (
                          <text
                            x={x}
                            y={y}
                            dy={dy}
                            fill={s.stroke}
                            fontSize={10}
                            textAnchor="middle"
                            fontWeight={fontWeight}
                          >
                            {value.toLocaleString()}
                          </text>
                        );
                      }}
                    />
                  </Line>
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
          title={`${title} — 표시 항목 수정`}
          description="선택한 항목만 차트에 표시됩니다. 순서를 바꾸면 선 색·범례 순서가 바뀝니다."
          options={productOptions}
          selected={visibleSeries}
          onApply={onSelectedChange}
          searchable={false}
        />
      )}
    </div>
  );
}
