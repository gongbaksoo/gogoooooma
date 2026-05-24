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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import ProductSelectionModal, { ProductOption } from "./ProductSelectionModal";
import { Part } from "./channelSelectionStorage";
import { getMultiSeriesStyle } from "@/lib/chartPalette";

interface ChannelOption {
  name: string;
  row_count: number;
  values: number[]; // 12개월 (비중 파이·월평균용)
  values13?: number[]; // 13개월 (트렌드·전년비용, 대상월-12~대상월)
  monthly_avg: number;
  current_month: number;
}

interface Props {
  part: Part;
  options: ChannelOption[];
  months: string[]; // 12개월 라벨 (비중·월평균용)
  months13: string[]; // 13개월 라벨 (트렌드용)
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  editMode: boolean;
}

const toMan = (v: number) => Math.round(v / 1_000_000);
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

export default function ChannelSection({ part, options, months, months13, selected, onSelectedChange, editMode }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  // 선택된 옵션만 추출 — 사용자가 정한 selected 순서 그대로 (표시 우선순위)
  const selectedOptions = useMemo(() => {
    const byName = new Map(options.map((o) => [o.name, o]));
    return selected
      .map((name) => byName.get(name))
      .filter((o): o is ChannelOption => Boolean(o));
  }, [options, selected]);

  const styles = selectedOptions.map((_, i) => getMultiSeriesStyle(i));
  const colors = styles.map((s) => s.stroke);

  // 13개월 시계열(values13) 기준 채널 라벨 — 트렌드 차트용. 백엔드 미배포 폴백: 12개월.
  const trendMonths = months13.length ? months13 : months;
  const seriesOf = (o: ChannelOption) => (o.values13 && o.values13.length ? o.values13 : o.values);
  // 트렌드 데이터 (13개월)
  const trendData = trendMonths.map((m, idx) => {
    const row: Record<string, string | number> = { month: shortLabel(m) };
    selectedOptions.forEach((o) => {
      row[o.name] = toMan(seriesOf(o)[idx] ?? 0);
    });
    return row;
  });

  // 헤더 아래 채널별 실적 요약 (백만). 13개월 시계열: 마지막=당월, [0]=전년 동월. 목표비 제외.
  const fmtGrowth = (actual: number, base: number | null) => {
    if (base == null || base <= 0) return "-";
    const g = ((actual - base) / base) * 100;
    return `${g >= 0 ? "▲" : "▼"}${Math.abs(g).toFixed(1)}%`;
  };
  const channelSummaries = selectedOptions.map((o) => {
    const vals = seriesOf(o);
    const n = vals.length;
    const actual = vals[n - 1] ?? 0;
    return {
      name: o.name,
      actual,
      prevMonth: n >= 2 ? vals[n - 2] : null,
      prev3Avg: n >= 4 ? (vals[n - 2] + vals[n - 3] + vals[n - 4]) / 3 : null,
      prevYear: n >= 13 ? vals[0] : null,
    };
  });

  // 비중 파이
  const total12 = selectedOptions.map((o) => o.values.reduce((s, v) => s + v, 0));
  const totalSum = total12.reduce((s, v) => s + v, 0) || 1;
  const pieData = selectedOptions.map((o, i) => ({
    name: o.name,
    value: toMan(total12[i]),
    pct: ((total12[i] / totalSum) * 100).toFixed(1),
  }));

  // 월평균 vs 당월 막대
  const barData = selectedOptions.map((o) => ({
    category: o.name,
    월평균: toMan(o.monthly_avg),
    당월: toMan(o.current_month),
  }));

  const productOptions: ProductOption[] = options.map((o) => ({
    name: o.name,
    row_count: o.row_count,
  }));

  const editTitle = `채널 종합 — 표시 채널 수정 (${
    part === "all" ? "전체" : part === "ecommerce" ? "이커머스" : "오프라인"
  })`;
  const editDesc =
    "엑셀 P열(채널구분) 중 해당 파트에 존재하는 채널만 표시. 선택한 항목만 차트에 표시됩니다.";

  return (
    <>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#c4c4c4]">
        <h2 className="text-[15px] font-bold text-black">채널 종합</h2>
        {editMode && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-[11px] border border-[#c4c4c4] px-2 py-1 rounded hover:border-black"
          >
            표시 채널 수정 ▾
          </button>
        )}
      </div>

      {/* 채널별 실적 요약 — 선택 채널별 한 줄(백만), 목표비 제외 (채널 목표 미보유) */}
      {channelSummaries.length > 0 && (
        <div className="mb-3 space-y-0.5">
          {channelSummaries.map((c) => (
            <p key={c.name} className="text-[13px] text-black">
              <span className="font-bold">{c.name}</span> 실적 :{" "}
              <span className="font-bold">{Math.round(c.actual / 1_000_000).toLocaleString()}</span> 백만{" "}
              <span className="text-[#5d5d5d]">
                (전월비 {fmtGrowth(c.actual, c.prevMonth)} , 직전 3개월비 {fmtGrowth(c.actual, c.prev3Avg)} , 전년비{" "}
                {fmtGrowth(c.actual, c.prevYear)})
              </span>
            </p>
          ))}
        </div>
      )}

      {selectedOptions.length === 0 ? (
        <div className="text-center text-[13px] text-[#5d5d5d] py-12 border border-[#c4c4c4]">
          표시할 채널을 선택해주세요
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 트렌드 */}
          <div className="bg-white border border-[#c4c4c4] p-5">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-[15px] font-bold text-black">채널별 매출 트렌드</h3>
              <span className="text-[12px] text-[#5d5d5d]">최근 13개월 (백만)</span>
            </div>
            <div key={`trend-${part}-${selected.join("|")}`}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" stroke="#5d5d5d" tick={{ fontSize: 11 }} axisLine={{ stroke: "#c4c4c4" }} />
                  <YAxis stroke="#5d5d5d" tick={{ fontSize: 11 }} axisLine={{ stroke: "#c4c4c4" }} />
                  <Tooltip
                    contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                    formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} itemSorter={null} iconType="plainline" />
                  {selectedOptions.map((o, i) => {
                    const s = styles[i];
                    return (
                      <Line
                        key={o.name}
                        type="monotone"
                        dataKey={o.name}
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
          </div>

          {/* 비중 파이 */}
          <div className="bg-white border border-[#c4c4c4] p-5">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-[15px] font-bold text-black">채널별 매출 비중 (최근 12개월)</h3>
              <span className="text-[12px] text-[#5d5d5d]">단위: 백만</span>
            </div>
            <div key={`pie-${part}-${selected.join("|")}`}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
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
                        <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={10} fill="#5d5d5d">
                          {`${name} ${pct}%`}
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
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
          </div>

          {/* 월평균 vs 당월 막대 */}
          <div className="bg-white border border-[#c4c4c4] p-5">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-[15px] font-bold text-black">월 평균 대비 실적</h3>
              <span className="text-[12px] text-[#5d5d5d]">최근 12개월 (백만)</span>
            </div>
            <div key={`bar-${part}-${selected.join("|")}`}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 28, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="category" stroke="#5d5d5d" tick={{ fontSize: 11 }} axisLine={{ stroke: "#c4c4c4" }} />
                  <YAxis stroke="#5d5d5d" tick={{ fontSize: 11 }} axisLine={{ stroke: "#c4c4c4" }} />
                  <Tooltip
                    contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                    formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} itemSorter={null} iconType="plainline" />
                  <Bar dataKey="월평균" fill="#5d5d5d" radius={[2, 2, 0, 0]} animationDuration={1500} animationEasing="ease-out">
                    <LabelList dataKey="월평균" position="top" style={{ fontSize: 10, fill: "#5d5d5d" }} />
                  </Bar>
                  <Bar dataKey="당월" fill="#000000" radius={[2, 2, 0, 0]} animationDuration={1500} animationEasing="ease-out">
                    <LabelList dataKey="당월" position="top" style={{ fontSize: 10, fill: "#000" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <ProductSelectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTitle}
        description={editDesc}
        options={productOptions}
        selected={selected}
        onApply={onSelectedChange}
      />
    </>
  );
}
