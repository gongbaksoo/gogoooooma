"use client";

import { DailyReview, FLAG_LABEL } from "./types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/**
 * 최상단 데이터 가드.
 *
 * CSV는 사람이 손으로 올린다. 가장 흔한 이상은 매출이 아니라 '업로드가 안 왔다'이므로
 * 이 블록이 화면 맨 위에 온다. 'D-1'이라고 부르지 않는다 — 월요일 파일은 통상 D-3이다.
 */
export default function DataGuard({ data }: { data: DailyReview }) {
  const { meta, data_freshness: fresh } = data;
  const lag = fresh.file_lag_days;

  return (
    <div className="border border-solid rounded-[4px] px-5 py-4" style={{ borderColor: "#c4c4c4" }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[15px] font-bold text-black">
          최종 계상일 {fresh.latest_core_date}
        </span>
        {fresh.stale && (
          <span className="text-[13px] font-bold" style={{ color: "#b45309" }}>
            대상일까지 데이터가 도착하지 않았습니다
          </span>
        )}
        {lag !== null && lag > 0 && (
          <span className="text-[13px]" style={{ color: MUTED }}>
            파일 기준일({fresh.file_date})과 {lag}일 차 — 그 사이 계상일이 없습니다
          </span>
        )}
      </div>

      <p className="mt-2 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
        일별은 <b>ERP 매출계상일</b>입니다. 실제 주문일·출고일이 아닙니다.
        {fresh.provisional && (
          <>
            {" "}이 판정은 <b>잠정</b>입니다 — ERP가 과거 약 45일을 소급 정정하므로 수치가 나중에 바뀔 수 있습니다.
            (스냅샷 {meta.filename})
          </>
        )}
      </p>

      {meta.day_flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.day_flags.map((f) => (
            <span
              key={f}
              className="text-[12px] font-bold px-2 py-1 rounded-[3px] border border-solid"
              style={{ borderColor: "#c4c4c4", color: "#000" }}
            >
              {FLAG_LABEL[f] ?? f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
