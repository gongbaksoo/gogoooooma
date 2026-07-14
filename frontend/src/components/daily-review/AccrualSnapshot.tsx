"use client";

import { fmtManwon, fmtManwonBare } from "@/lib/manwon";
import { AChannelRow, DailyReview } from "./types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/**
 * 「직전 코어 계상일 계상 현황」 — 제목이 '어제 매출'이 아닌 이유가 여기 다 들어 있다.
 *
 * A군(일 단위 해석 가능)과 B군(배치 계상)을 같은 표에 섞지 않는다.
 * 2026-06-05에는 A군 순매출이 전사 순매출의 395%였다(반품이 B군에 몰려서). 단일 총계는 반드시 오독된다.
 */
function RangeBar({ row, flagged }: { row: AChannelRow; flagged: boolean }) {
  const { net, ref_min, ref_max } = row;
  if (ref_min === null || ref_max === null) return null;

  // 당일 값과 참조 범위를 함께 담는 축. 범위를 벗어난 값도 화면 안에 보이게 한다.
  const lo = Math.min(ref_min, net, 0);
  const hi = Math.max(ref_max, net);
  const span = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / span) * 100;

  return (
    <div className="relative h-[6px] w-full rounded-[3px]" style={{ background: "#f0f0f0" }}>
      {/* 같은 요일 8주 관측 범위 */}
      <div
        className="absolute h-full rounded-[3px]"
        style={{
          left: `${pct(ref_min)}%`,
          width: `${pct(ref_max) - pct(ref_min)}%`,
          background: "#d9d9d9",
        }}
      />
      {/* 당일 값. 범위를 벗어나도 게이트를 못 넘으면 강조하지 않는다 — 예외 카드와 색이 어긋나면 안 된다. */}
      <div
        className="absolute top-[-3px] h-[12px] w-[2px]"
        style={{ left: `${pct(net)}%`, background: flagged ? "#b45309" : "#000" }}
      />
    </div>
  );
}

export default function AccrualSnapshot({ data }: { data: DailyReview }) {
  const s = data.accrual_snapshot;

  // 범위를 벗어났어도 절대금액 게이트를 못 넘으면 예외로 올리지 않는다.
  // 그 사실을 화면에 쓰지 않으면 "범위 하단 미만"과 "확인할 예외 없음"이 모순으로 읽힌다.
  const flagged = new Set(
    data.anomalies.flags.filter((f) => f.level === "channel").map((f) => f.entity)
  );
  const gate = data.anomalies.checked.gates.channel;

  const rows: { label: string; v: typeof s.a_group; note?: string }[] = [
    { label: "A군", v: s.a_group, note: "일 단위 해석 가능" },
    { label: "B군", v: s.b_group, note: "계상 이벤트 · 하루 성과로 해석 불가" },
    { label: "전사", v: s.total },
  ];

  return (
    <section>
      <h2 className="text-[18px] font-bold text-black">직전 코어 계상일 계상 현황</h2>
      <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
        단위: 만원 · 총매출 / 반품 / 순매출 3분할
      </p>

      <table className="mt-4 w-full text-[14px]">
        <thead>
          <tr style={{ color: MUTED }} className="text-left text-[13px]">
            <th className="pb-2 font-normal">구분</th>
            <th className="pb-2 font-normal text-right">총매출</th>
            <th className="pb-2 font-normal text-right">반품</th>
            <th className="pb-2 font-normal text-right">순매출</th>
            <th className="pb-2 pl-4 font-normal" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="border-t border-solid"
              style={{ borderColor: "#eee", fontWeight: r.label === "전사" ? 700 : 400 }}
            >
              <td className="py-2">{r.label}</td>
              <td className="py-2 text-right tabular-nums">{fmtManwonBare(r.v.gross)}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: r.v.returns < 0 ? "#b45309" : undefined }}>
                {fmtManwonBare(r.v.returns)}
              </td>
              <td className="py-2 text-right tabular-nums">{fmtManwonBare(r.v.net)}</td>
              <td className="py-2 pl-4 text-[12px] font-normal" style={{ color: MUTED }}>
                {r.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-8 text-[15px] font-bold text-black">A군 채널 — 같은 요일 8주 범위 안에서의 위치</h3>
      <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
        증감률(전일비)은 내지 않습니다. 요일별 평균이 259배 벌어져 잡음이 됩니다.
      </p>

      <table className="mt-3 w-full text-[14px]">
        <thead>
          <tr style={{ color: MUTED }} className="text-left text-[13px]">
            <th className="pb-2 font-normal">채널</th>
            <th className="pb-2 font-normal text-right">당일 순매출</th>
            <th className="pb-2 font-normal text-right">8주 중앙값</th>
            <th className="pb-2 pl-4 font-normal w-[34%]">8주 범위 내 위치</th>
            <th className="pb-2 pl-4 font-normal">판정</th>
          </tr>
        </thead>
        <tbody>
          {s.a_channels.map((c) => {
            const outside = c.position !== "범위 내";
            const isFlagged = flagged.has(c.channel);
            return (
            <tr key={c.channel} className="border-t border-solid" style={{ borderColor: "#eee" }}>
              <td className="py-2.5">
                {c.channel}
                {c.high_variance && (
                  <span className="ml-2 text-[11px]" style={{ color: MUTED }}>
                    변동 큼
                  </span>
                )}
              </td>
              <td className="py-2.5 text-right tabular-nums font-bold">{fmtManwonBare(c.net)}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: MUTED }}>
                {fmtManwonBare(c.ref_median)}
              </td>
              <td className="py-2.5 pl-4">
                <RangeBar row={c} flagged={isFlagged} />
                <div className="mt-1 flex justify-between text-[11px] tabular-nums" style={{ color: MUTED }}>
                  <span>{fmtManwonBare(c.ref_min)}</span>
                  <span>{fmtManwonBare(c.ref_max)}</span>
                </div>
              </td>
              <td className="py-2.5 pl-4 text-[13px]">
                {!outside ? (
                  <span style={{ color: MUTED }}>범위 내</span>
                ) : isFlagged ? (
                  <span className="font-bold" style={{ color: "#b45309" }}>
                    {c.position} · 확인 필요
                  </span>
                ) : (
                  <span style={{ color: MUTED }}>
                    {c.position}
                    <br />
                    <span className="text-[11px]">이탈폭이 게이트({fmtManwon(gate)}) 미만 — 예외로 올리지 않음</span>
                  </span>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-3 text-[12px]" style={{ color: MUTED }}>
        참조일({data.meta.weekday}): {s.ref_dates.join(" · ")}
      </p>
    </section>
  );
}
