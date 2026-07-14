"use client";

import { fmtManwonBare } from "@/lib/manwon";
import { DailyReview } from "./types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/**
 * 월 페이스.
 *
 * 착지 예상 금액을 내지 않는다 — DOM10 백테스트 MAPE가 31%였다.
 * 밴드 하회를 빨강으로 칠하지 않는다 — 최근 17개월 중 13개월이 하회했고 그중 2개월은 107%로 끝났다.
 * 기대 진척률은 균등 안분(DOM12 → 40%)이 아니라 실측 곡선(32.3%)이다.
 */
export default function PaceSection({ data }: { data: DailyReview }) {
  const p = data.mtd_pace;
  const band = p.expected_mtd_band;

  // 밴드와 실제 MTD를 한 축에 놓는다. 축은 0 ~ 목표.
  const axisMax = Math.max(p.target ?? 0, p.mtd.net, band?.high ?? 0) || 1;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / axisMax) * 100));

  return (
    <section>
      <h2 className="text-[18px] font-bold text-black">월 페이스 · {p.month}</h2>
      <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
        진행률 {p.dom}/{p.days_in_month}일 = {(p.progress_ratio * 100).toFixed(1)}% · 단위 만원
      </p>

      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 text-[14px]">
        <div>
          <div className="text-[12px]" style={{ color: MUTED }}>
            MTD 순매출
          </div>
          <div className="text-[20px] font-bold tabular-nums text-black">{fmtManwonBare(p.mtd.net)}</div>
          <div className="text-[12px] tabular-nums" style={{ color: MUTED }}>
            총매출 {fmtManwonBare(p.mtd.gross)} / 반품 {fmtManwonBare(p.mtd.returns)}
          </div>
        </div>
        <div>
          <div className="text-[12px]" style={{ color: MUTED }}>
            월 목표
          </div>
          <div className="text-[20px] font-bold tabular-nums text-black">{fmtManwonBare(p.target)}</div>
        </div>
        {p.is_month_final && p.achievement_pct !== null && (
          <div>
            <div className="text-[12px]" style={{ color: MUTED }}>
              최종 달성률
            </div>
            <div className="text-[20px] font-bold tabular-nums text-black">{p.achievement_pct}%</div>
          </div>
        )}
        {p.pace_index !== null && (
          <div>
            <div className="text-[12px]" style={{ color: MUTED }}>
              페이스 지수
            </div>
            <div className="text-[20px] font-bold tabular-nums text-black">{p.pace_index}%</div>
            <div className="text-[12px]" style={{ color: MUTED }}>
              기대 대비
            </div>
          </div>
        )}
      </div>

      {band && p.expected_share ? (
        <div className="mt-6">
          <div className="relative h-[10px] w-full rounded-[3px]" style={{ background: "#f0f0f0" }}>
            <div
              className="absolute h-full rounded-[3px]"
              style={{ left: `${pct(band.low)}%`, width: `${pct(band.high) - pct(band.low)}%`, background: "#d9d9d9" }}
            />
            <div
              className="absolute top-[-4px] h-[18px] w-[2px]"
              style={{ left: `${pct(p.mtd.net)}%`, background: "#000" }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[14px]">
            <span className="font-bold text-black">{p.band_position}</span>
            <span style={{ color: MUTED }}>
              기대 누계 {fmtManwonBare(band.low)} ~ {fmtManwonBare(band.high)} (실측 진척률 중앙값{" "}
              {p.expected_share.med}%, P25~P75 {p.expected_share.p25}~{p.expected_share.p75}%)
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-[13px]" style={{ color: MUTED }}>
          {p.suppressed_reason}
        </p>
      )}

      <div className="mt-5 border-t border-solid pt-3 text-[12px] leading-[1.7]" style={{ borderColor: "#eee", color: MUTED }}>
        <p>착지 예상 금액은 제공하지 않습니다 — DOM 10 시점 백테스트 오차가 31%입니다.</p>
        {p.base_rate && (
          <p>
            참고: 최근 {p.base_rate.n_months}개월 평균 목표 달성률 {p.base_rate.mean_achievement}%,
            100% 달성 {p.base_rate.hit_100_count}회. 밴드 하회는 자주 발생하므로 경보색을 쓰지 않습니다.
          </p>
        )}
      </div>
    </section>
  );
}
