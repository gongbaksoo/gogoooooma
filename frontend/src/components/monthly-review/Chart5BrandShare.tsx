"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getMultiSeriesStyle } from "@/lib/chartPalette";

interface SharePoint {
  name: string;
  value: number;
}

interface Chart5Props {
  chart5: {
    title: string;
    series_names: string[];
    colors: string[];
    data: SharePoint[];
  };
  /** 표시 시리즈 선택 (순서 = 표시 우선순위). 트렌드 차트(Chart4)와 공유 — 편집은 트렌드 쪽에서만 */
  selected?: string[];
}

const toMan = (v: number) => Math.round(v / 1_000_000);

export default function Chart5BrandShare({ chart5, selected }: Chart5Props) {
  const { title, series_names, data } = chart5;

  const valueByName = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((d) => m.set(d.name, d.value));
    return m;
  }, [data]);

  // 표시 시리즈 (선택 없으면 전체, 백엔드 순서). 선택 시 그 순서대로 + 존재하는 것만
  const visibleSeries = useMemo(() => {
    if (selected == null) return series_names;
    return selected.filter((n) => valueByName.has(n));
  }, [selected, series_names, valueByName]);

  const total = visibleSeries.reduce((s, n) => s + (valueByName.get(n) ?? 0), 0) || 1;
  const chartData = visibleSeries.map((name) => {
    const v = valueByName.get(name) ?? 0;
    return {
      name,
      value: toMan(v),
      pct: ((v / total) * 100).toFixed(1),
    };
  });
  const colors = visibleSeries.map((_, i) => getMultiSeriesStyle(i).stroke);

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">{title}</h3>
        <span className="text-[12px] text-[#5d5d5d]">최근 12개월 (단위: 백만)</span>
      </div>

      {visibleSeries.length === 0 ? (
        <div className="text-center text-[13px] text-[#5d5d5d] py-16 border border-dashed border-[#c4c4c4]">
          표시할 항목을 선택해주세요
        </div>
      ) : (
        <div key={visibleSeries.join("|")}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                animationDuration={1500}
                animationEasing="ease-out"
                label={(p: any) => {
                  const { x, y, textAnchor, name, pct } = p;
                  return (
                    <text
                      x={x}
                      y={y}
                      textAnchor={textAnchor}
                      dominantBaseline="central"
                      fontSize={10}
                      fill="#5d5d5d"
                    >
                      {`${name} ${pct}%`}
                    </text>
                  );
                }}
                labelLine={false}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={colors[i] ?? "#000000"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
