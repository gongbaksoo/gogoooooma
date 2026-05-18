"use client";

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

interface Chart3Point {
  month: string;
  main_channels: number;
  coupang_purchase: number;
}

const toMan = (v: number) => Math.round(v / 1_000_000);

// "2026-04" → "26.04" 같은 짧은 라벨로 가독성 확보
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

export default function Chart3MainVsCoupang({ data }: { data: Chart3Point[] }) {
  const chartData = data.map((d) => ({
    month: shortLabel(d.month),
    주력채널: toMan(d.main_channels),
    "쿠팡(사입)": toMan(d.coupang_purchase),
  }));

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">주력채널 vs 쿠팡(사입)</h3>
        <span className="text-[12px] text-[#5d5d5d]">최근 12개월 (단위: 백만)</span>
      </div>

      <div key={`${data[0]?.month ?? ''}-${data.length}`} className="chart-fade-in" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="month" stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
          <YAxis stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
          <Tooltip
            contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
            formatter={(v: number) => [`${v.toLocaleString()} 백만`, ""]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="주력채널"
            stroke="#000000"
            strokeWidth={2}
            dot={{ r: 3, fill: "#000000" }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="쿠팡(사입)"
            stroke="#ff0066"
            strokeWidth={2}
            dot={{ r: 3, fill: "#ff0066" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
