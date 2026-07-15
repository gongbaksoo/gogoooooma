"use client";

import { fmtManwonBare } from "@/lib/manwon";
import { DailyReview } from "./types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/**
 * B군 계상 이벤트.
 *
 * 금액 추이 차트를 그리지 않는다. 그릴 수도 없다 — 응답 스키마에 일별 배열이 없다.
 * 쿠팡 사입은 63 거래일 중 31일만 기록되고 월요일에 몰린다. 그 선을 그으면
 * 전사 일별 그래프가 '쿠팡 발주 계상 타이밍 그래프'가 된다.
 * B군에는 severity가 없다. 여기서 '나쁨' 판정을 내리지 않는다.
 */
export default function BGroupEvents({ data }: { data: DailyReview }) {
  const events = data.bgroup_events;
  if (events.length === 0) return null;

  return (
    <section>
      <h2 className="text-[18px] font-bold text-black">B군 계상 이벤트</h2>
      <p className="mt-1 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
        배치로 계상되는 채널입니다. 하루 값의 증감은 성과가 아니라 계상 타이밍입니다 — 금액 추이를 표시하지 않습니다.
      </p>

      <table className="mt-4 w-full text-[14px]">
        <thead>
          <tr style={{ color: MUTED }} className="text-left text-[13px]">
            <th className="pb-2 font-normal">채널</th>
            <th className="pb-2 font-normal text-right">당일 계상</th>
            <th className="pb-2 pl-4 font-normal">직전 계상</th>
            <th className="pb-2 pl-4 font-normal">비고</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.channel} className="border-t border-solid" style={{ borderColor: "#eee" }}>
              <td className="py-2.5">
                {e.channel}
                {e.kind === "check" && (
                  <span className="ml-2 text-[11px] font-bold" style={{ color: "#b45309" }}>
                    확인
                  </span>
                )}
                {e.dormant && (
                  <span className="ml-2 text-[11px]" style={{ color: MUTED }}>
                    휴면
                  </span>
                )}
              </td>
              <td className="py-2.5 text-right tabular-nums" style={{ opacity: e.dormant ? 0.55 : 1 }}>
                {e.today_net === 0 ? <span style={{ color: MUTED }}>계상 없음</span> : fmtManwonBare(e.today_net)}
              </td>
              <td className="py-2.5 pl-4 tabular-nums" style={{ color: MUTED, opacity: e.dormant ? 0.55 : 1 }}>
                {e.last_accrual_date} · {fmtManwonBare(e.last_accrual_net)} ({e.days_since}일 전)
              </td>
              <td className="py-2.5 pl-4 text-[13px]" style={{ color: e.kind === "check" ? "#b45309" : MUTED }}>
                {e.kind === "check" ? e.message : e.dormant ? "중단·휴면 추정" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
