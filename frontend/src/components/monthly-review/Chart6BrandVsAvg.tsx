"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

interface BarPoint {
  category: string;
  monthly_avg: number;
  current_month: number;
}

interface Chart6Props {
  chart6: {
    title: string;
    series_names: string[]; // ["월평균", "당월"]
    colors: string[];
    data: BarPoint[];
  };
}

const toMan = (v: number) => Math.round(v / 1_000_000);

export default function Chart6BrandVsAvg({ chart6 }: Chart6Props) {
  const { title, series_names, colors, data } = chart6;
  const chartData = data.map((d) => ({
    category: d.category,
    [series_names[0]]: toMan(d.monthly_avg),
    [series_names[1]]: toMan(d.current_month),
  }));

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">{title}</h3>
        <span className="text-[12px] text-[#5d5d5d]">최근 12개월 (단위: 백만)</span>
      </div>

      <div key={data.map((d) => d.category).join("|")}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 28, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="category" stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
            <YAxis stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
            <Tooltip
              contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
              formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series_names.map((name, i) => (
              <Bar
                key={name}
                dataKey={name}
                fill={colors[i] ?? "#000000"}
                radius={[2, 2, 0, 0]}
                animationDuration={1500}
                animationEasing="ease-out"
              >
                <LabelList
                  dataKey={name}
                  position="top"
                  style={{ fontSize: 10, fill: colors[i] ?? "#000000" }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
