"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
}

const toMan = (v: number) => Math.round(v / 1_000_000);

export default function Chart5BrandShare({ chart5 }: Chart5Props) {
  const { title, colors, data } = chart5;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const chartData = data.map((d) => ({
    name: d.name,
    value: toMan(d.value),
    pct: ((d.value / total) * 100).toFixed(1),
  }));

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">{title}</h3>
        <span className="text-[12px] text-[#5d5d5d]">단위: 백만</span>
      </div>

      <div key={data.map((d) => d.name).join("|")}>
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
    </div>
  );
}
