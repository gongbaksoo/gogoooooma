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
  LabelList,
} from "recharts";

interface Chart2Point {
  month: string; // "YYYY-MM" — 백엔드 직전 12개월
  current_year: number;
  prev_year: number;
}

const toMan = (v: number) => Math.round(v / 1_000_000);

// "2026-02" → "26.02"
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

// "2026-02" → "2025-02"
const prevYearMonth = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  if (!t) return m;
  const y = parseInt(t[1], 10) - 1;
  return `${y}.${t[2].slice(-2)}`;
};

export default function Chart2YoYTrend({ data }: { data: Chart2Point[] }) {
  const chartData = data.map((d) => ({
    month: shortLabel(d.month),
    pyMonth: prevYearMonth(d.month),
    당해: toMan(d.current_year),
    전년: toMan(d.prev_year),
  }));

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">전년비 트렌드</h3>
        <span className="text-[12px] text-[#5d5d5d]">최근 12개월 (단위: 백만)</span>
      </div>

      <div key={`${data[0]?.month ?? ''}-${data.length}`}>
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
            formatter={(v: number, name: string, payload: any) => {
              if (name === "전년") {
                return [`${v.toLocaleString()} 백만  (${payload?.payload?.pyMonth})`, name];
              }
              return [`${v.toLocaleString()} 백만`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="당해"
            stroke="#000000"
            strokeWidth={2}
            dot={{ r: 1.5, fill: "#000000" }}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="당해"
              position="top"
              content={(p: any) => {
                const { x, y, value, index } = p;
                if (index !== chartData.length - 1) return null;
                if (value === undefined || value === null) return null;
                return (
                  <text x={x} y={y} dy={-8} fill="#000000" fontSize={10} textAnchor="middle" fontWeight="bold">
                    {value.toLocaleString()}
                  </text>
                );
              }}
            />
          </Line>
          <Line
            type="monotone"
            dataKey="전년"
            stroke="#5d5d5d"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 1.5, fill: "#5d5d5d" }}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="전년"
              position="bottom"
              content={(p: any) => {
                const { x, y, value, index } = p;
                if (index !== chartData.length - 1) return null;
                if (value === undefined || value === null) return null;
                return (
                  <text x={x} y={y} dy={14} fill="#5d5d5d" fontSize={10} textAnchor="middle">
                    {value.toLocaleString()}
                  </text>
                );
              }}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
