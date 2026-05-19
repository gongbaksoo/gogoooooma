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
}

const toMan = (v: number) => Math.round(v / 1_000_000);

// "2026-04" → "26.04"
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

export default function Chart3MainVsCoupang({ chart3 }: Chart3Props) {
  const { title, series_names, colors, data } = chart3;

  const chartData = data.map((d) => {
    const row: Record<string, string | number> = { month: shortLabel(d.month) };
    series_names.forEach((name, i) => {
      row[name] = toMan(d.values[i] ?? 0);
    });
    return row;
  });

  const lastIndex = chartData.length - 1;

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">{title}</h3>
        <span className="text-[12px] text-[#5d5d5d]">최근 12개월 (단위: 백만)</span>
      </div>

      <div key={`${data[0]?.month ?? ""}-${data.length}-${series_names.join("|")}`}>
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
              formatter={(v: number) => [`${v.toLocaleString()} 백만`, ""]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series_names.map((name, i) => {
              const color = colors[i] ?? "#000000";
              // 첫 시리즈는 위쪽 라벨, 나머지는 아래쪽 (겹침 회피)
              const pos = i === 0 ? "top" : "bottom";
              const dy = i === 0 ? -8 : 14;
              const fontWeight = i === 0 ? "bold" : "normal";
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
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
                          fill={color}
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
    </div>
  );
}
