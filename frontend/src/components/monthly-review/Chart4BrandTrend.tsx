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
}

const toMan = (v: number) => Math.round(v / 1_000_000);
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

export default function Chart4BrandTrend({ chart4 }: Chart4Props) {
  const { title, series_names, colors, data } = chart4;
  const chartData = data.map((d) => {
    const row: Record<string, string | number> = { month: shortLabel(d.month) };
    series_names.forEach((n, i) => {
      row[n] = toMan(d.values[i] ?? 0);
    });
    return row;
  });

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">{title}</h3>
        <span className="text-[12px] text-[#5d5d5d]">최근 12개월 (단위: 백만)</span>
      </div>

      <div key={`${data[0]?.month ?? ""}-${series_names.join("|")}`}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
            <YAxis stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
            <Tooltip
              contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
              formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series_names.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={colors[i] ?? "#000000"}
                strokeWidth={2}
                dot={{ r: 1.5, fill: colors[i] ?? "#000000" }}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
