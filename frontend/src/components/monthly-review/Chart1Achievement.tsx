"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface Chart1Data {
  target: number | null;
  actual: number;
  achievement_rate: number | null;
}

const toMan = (v: number) => Math.round(v / 1_000_000);

export default function Chart1Achievement({
  data,
  month,
}: {
  data: Chart1Data | null;
  month: string;
}) {
  const hasTarget = data && data.target != null;
  const chartData = data
    ? [
        { name: "사업계획", value: hasTarget ? toMan(data.target as number) : 0, color: "#5d5d5d" },
        { name: "실적", value: toMan(data.actual), color: "#000000" },
      ]
    : [];

  return (
    <div className="bg-white border border-[#c4c4c4] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-bold text-black">목표비 실적</h3>
        <span className="text-[12px] text-[#5d5d5d]">{month} (단위: 백만)</span>
      </div>

      {!data ? (
        <div className="h-[260px] flex items-center justify-center text-[13px] text-[#5d5d5d]">
          데이터가 없습니다
        </div>
      ) : !hasTarget ? (
        <div className="h-[260px] flex items-center justify-center text-[13px] text-[#5d5d5d]">
          목표 데이터를 업로드하세요
        </div>
      ) : (
        <>
          <div key={month}>
          <ResponsiveContainer width="100%" height={227}>
            <BarChart data={chartData} margin={{ top: 28, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
              <YAxis stroke="#5d5d5d" tick={{ fontSize: 12 }} axisLine={{ stroke: "#c4c4c4" }} />
              <Tooltip
                contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                formatter={(v: number, _n: string, item: any) => [
                  `${v.toLocaleString()} 백만`,
                  item?.payload?.name ?? "",
                ]}
              />
              <Bar dataKey="value" radius={[2, 2, 0, 0]} animationDuration={1500} animationEasing="ease-out">
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  content={(props: any) => {
                    const { x, y, width, value, index } = props;
                    if (index !== chartData.length - 1) return null;
                    if (value === undefined || value === null) return null;
                    return (
                      <text
                        x={Number(x) + Number(width) / 2}
                        y={Number(y) - 6}
                        fill="#000"
                        fontSize={12}
                        textAnchor="middle"
                      >
                        {value.toLocaleString()}
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          <div className="mt-3 text-center text-[14px]">
            <span className="text-[#5d5d5d]">달성률</span>{" "}
            <span className="font-bold" style={{ color: "#ff0066" }}>
              {data.achievement_rate?.toFixed(1) ?? "-"}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
