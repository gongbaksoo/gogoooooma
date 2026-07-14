"use client";

import { useState } from "react";
import { fmtEok } from "@/lib/manwon";
import { DailyReview } from "./types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/**
 * 침묵 로그 + 채널 판정 근거.
 *
 * 커버리지 한 줄은 접지 않는다. '예외 0건'을 '문제 없음'으로 읽으면 안 되기 때문이다 —
 * 감시 대상은 전사 순매출의 40% 안팎뿐이고, 나머지(쿠팡 사입·다이소 등)는
 * 어떤 설계로도 일 단위 이상 감지가 불가능하다. 데이터의 한계이지 구현의 한계가 아니다.
 */
export default function SilenceLog({ data }: { data: DailyReview }) {
  const [open, setOpen] = useState(false);
  const s = data.silence_log;
  const cc = data.channel_classification;

  return (
    <section className="border-t border-solid pt-6" style={{ borderColor: "#eee" }}>
      <p className="text-[14px] leading-[1.7] text-black">
        예외 판정 대상은 <b>A군 {cc.channels.filter((c) => c.group === "A").length}개 채널 = 전사 순매출의 {s.coverage_pct}%</b>입니다.
      </p>
      <p className="mt-1 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
        나머지 {s.skipped_bgroup.length}개 채널({s.skipped_bgroup.slice(0, 4).join(" · ")}
        {s.skipped_bgroup.length > 4 ? " 외" : ""})은 배치 계상이라 일 단위 이상 감지가 불가능합니다.
        {" "}{s.skipped_shadow_product}
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-[13px] font-bold text-black"
      >
        채널 판정 근거 {open ? "접기" : "펼치기"}
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-[12px]" style={{ color: MUTED }}>
            창: 최근 {cc.window.n}개 정상 코어일 ({cc.window.start} ~ {cc.window.end}) · 매 실행 시 재판정합니다.
            A군 조건: 기록밀도 ≥ {cc.thresholds.density_min} · 계상일수 ≥ {cc.thresholds.days_min} · 60일 순매출 ≥{" "}
            {fmtEok(cc.thresholds.net_60d_min)}. 이탈은 연속 {cc.thresholds.exit_streak}회 위반 시에만(히스테리시스).
          </p>

          <table className="mt-3 w-full text-[13px]">
            <thead>
              <tr style={{ color: MUTED }} className="text-left text-[12px]">
                <th className="pb-2 font-normal">군</th>
                <th className="pb-2 font-normal">채널</th>
                <th className="pb-2 font-normal text-right">기록밀도</th>
                <th className="pb-2 font-normal text-right">계상일수</th>
                <th className="pb-2 font-normal text-right">CV</th>
                <th className="pb-2 font-normal text-right">60일 순매출</th>
              </tr>
            </thead>
            <tbody>
              {cc.channels.map((c) => (
                <tr key={c.name} className="border-t border-solid" style={{ borderColor: "#f5f5f5" }}>
                  <td className="py-1.5 font-bold">{c.group}</td>
                  <td className="py-1.5">
                    {c.name}
                    {c.high_variance && (
                      <span className="ml-2 text-[11px]" style={{ color: MUTED }}>
                        변동 큼
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{c.density.toFixed(3)}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.days_seen}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.cv?.toFixed(2) ?? "-"}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtEok(c.net_60d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
