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
  value1: number;
  value2: number;
}

interface Chart3Props {
  chart3: {
    title: string;
    series_names: [string, string] | string[];
    colors: [string, string] | string[];
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
  const [name1, name2] = series_names;
  const [color1, color2] = colors;

  const chartData = data.map((d) => ({
    month: shortLabel(d.month),
    [name1]: toMan(d.value1),
    [name2]: toMan(d.value2),
  }));

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">{title}</h3>
        <span className="text-[12px] text-[#5d5d5d]">최근 12개월 (단위: 백만)</span>
      </div>

      <div key={`${data[0]?.month ?? ""}-${data.length}-${name1}-${name2}`}>
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
            <Line
              type="monotone"
              dataKey={name1}
              stroke={color1}
              strokeWidth={2}
              dot={{ r: 3, fill: color1 }}
              animationDuration={1500}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey={name1}
                position="top"
                content={(p: any) => {
                  const { x, y, value, index } = p;
                  if (index !== chartData.length - 1) return null;
                  if (value === undefined || value === null) return null;
                  return (
                    <text x={x} y={y} dy={-8} fill={color1} fontSize={10} textAnchor="middle" fontWeight="bold">
                      {value.toLocaleString()}
                    </text>
                  );
                }}
              />
            </Line>
            <Line
              type="monotone"
              dataKey={name2}
              stroke={color2}
              strokeWidth={2}
              dot={{ r: 3, fill: color2 }}
              animationDuration={1500}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey={name2}
                position="bottom"
                content={(p: any) => {
                  const { x, y, value, index } = p;
                  if (index !== chartData.length - 1) return null;
                  if (value === undefined || value === null) return null;
                  return (
                    <text x={x} y={y} dy={14} fill={color2} fontSize={10} textAnchor="middle">
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
