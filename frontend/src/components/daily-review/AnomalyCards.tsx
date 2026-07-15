"use client";

import { fmtManwon } from "@/lib/manwon";
import { DailyReview } from "./types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/** 범위는 벗어났지만 절대금액 게이트를 못 넘어 카드로 올리지 않은 채널. */
function belowGate(data: DailyReview): string[] {
  const flagged = new Set(data.anomalies.flags.filter((f) => f.level === "channel").map((f) => f.entity));
  return data.accrual_snapshot.a_channels
    .filter((c) => c.position !== "범위 내" && !flagged.has(c.channel))
    .map((c) => c.channel);
}

/**
 * 확인 필요 — 예외 카드.
 *
 * 판정일의 58.7%는 여기가 0건이고, 그런 날은 이 섹션이 한 줄로 끝난다. 그게 정상이다.
 * 억지로 채우면 3주 만에 아무도 안 읽는다.
 */
export default function AnomalyCards({ data }: { data: DailyReview }) {
  const { flags, suppressed_reason, checked } = data.anomalies;

  if (flags.length === 0) {
    const near = belowGate(data);
    return (
      <section>
        <h2 className="text-[18px] font-bold text-black">확인 필요</h2>
        <p className="mt-3 text-[15px] font-bold text-black">확인할 예외 없음</p>
        <p className="mt-1 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
          {suppressed_reason ??
            (near.length > 0
              ? `${near.join(" · ")} — 8주 범위를 벗어났으나 이탈폭이 게이트(${fmtManwon(
                  checked.gates.channel
                )}) 미만이라 예외로 올리지 않았습니다. 나머지 A군 채널은 범위 안입니다.`
              : `A군 ${checked.channels}개 채널과 그 거래처가 모두 같은 요일 8주 범위 안에 있습니다.`)}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-[18px] font-bold text-black">
        확인 필요 <span style={{ color: MUTED }}>({flags.length}건)</span>
      </h2>
      {suppressed_reason && (
        <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
          {suppressed_reason}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {flags.map((f, i) => {
          const surge = f.kind === "surge";
          const over = surge ? f.value - f.ref_max : f.ref_min - f.value;
          return (
            <div
              key={`${f.level}-${f.entity}-${i}`}
              className="border border-solid rounded-[4px] px-5 py-4"
              style={{ borderColor: "#c4c4c4" }}
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[15px] font-bold" style={{ color: "#b45309" }}>
                  {surge ? "급증" : "급감"}
                </span>
                <span className="text-[15px] font-bold text-black">{f.entity_display}</span>
                <span className="text-[12px]" style={{ color: MUTED }}>
                  {f.level === "channel" ? "채널" : "거래처"}
                </span>
                {f.entity_display !== f.entity && (
                  <span className="text-[11px]" style={{ color: MUTED }}>
                    (ERP: {f.entity.split(" · ").pop()})
                  </span>
                )}
              </div>

              <p className="mt-2 text-[14px] leading-[1.7] text-black">
                당일 <b>{fmtManwon(f.value)}</b> · 같은 {data.meta.weekday}요일 8주 범위{" "}
                {fmtManwon(f.ref_min)} ~ {fmtManwon(f.ref_max)} (중앙값 {fmtManwon(f.ref_median)})
              </p>
              <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
                8주 {surge ? "최대치를" : "최소치를"} {fmtManwon(Math.abs(over))} {surge ? "초과" : "미달"} ·
                유효관측 {f.ref_valid}/8
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
