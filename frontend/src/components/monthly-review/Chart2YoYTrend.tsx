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

interface Chart2Point {
  month: string;
  current_year: number;
  prev_year: number;
}

const toMan = (v: number) => Math.round(v / 1_000_000);

export default function Chart2YoYTrend({
  data,
  currentYear,
  prevYear,
}: {
  data: Chart2Point[];
  currentYear: number;
  prevYear: number;
}) {
  const chartData = data.map((d) => ({
    month: d.month,
    [`${currentYear}년`]: toMan(d.current_year),
    [`${prevYear}년`]: toMan(d.prev_year),
  }));

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">전년비 트렌드</h3>
        <span className="text-[12px] text-[#5d5d5d]">1~12월 (단위: 백만)</span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
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
            dataKey={`${currentYear}년`}
            stroke="#000000"
            strokeWidth={2}
            dot={{ r: 3, fill: "#000000" }}
          />
          <Line
            type="monotone"
            dataKey={`${prevYear}년`}
            stroke="#5d5d5d"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 3, fill: "#5d5d5d" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
