"use client";

import { useState } from "react";
import { fmtManwonBare, fmtEok } from "@/lib/manwon";
import { DailyReview, TopVendor } from "./types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/**
 * 주요 거래처 감시 — A군 채널 소속 상위 거래처의 오늘 위치를 상시 표시.
 *
 * 월 리뷰가 거래처(11번가·지마켓·제제스스·롯데마트·이마트·CJ 등)를 상시 파는 것을 일 단위로 옮긴 것.
 * 기본 접힘: 판정일의 58.7%는 예외 0건이라, 여기까지 펼칠 필요 없이 화면이 짧게 끝나야 한다.
 * 표시명은 별칭(11st→11번가). 감시·매칭은 항상 원본 거래처명(R열) exact.
 */
function Bar({ v, flagged }: { v: TopVendor; flagged: boolean }) {
  const { net, ref_min, ref_max } = v;
  const lo = Math.min(ref_min, net, 0);
  const hi = Math.max(ref_max, net);
  const span = hi - lo || 1;
  const pct = (x: number) => ((x - lo) / span) * 100;
  return (
    <div className="relative h-[6px] w-full rounded-[3px]" style={{ background: "#f0f0f0" }}>
      <div
        className="absolute h-full rounded-[3px]"
        style={{ left: `${pct(ref_min)}%`, width: `${pct(ref_max) - pct(ref_min)}%`, background: "#d9d9d9" }}
      />
      <div
        className="absolute top-[-3px] h-[12px] w-[2px]"
        style={{ left: `${pct(net)}%`, background: flagged ? "#b45309" : "#000" }}
      />
    </div>
  );
}

export default function VendorWatch({ data }: { data: DailyReview }) {
  const [open, setOpen] = useState(false);
  const vendors = data.accrual_snapshot.top_vendors ?? [];
  if (vendors.length === 0) return null;

  // 게이트를 넘어 예외 카드로 올라간 거래처 = 강조. 그 외 범위 이탈은 참고용(무채색).
  const flaggedAccounts = new Set(
    data.anomalies.flags
      .filter((f) => f.level === "account")
      .map((f) => f.entity.split(" · ").pop())
  );
  const outCount = vendors.filter((v) => v.position !== "범위 내" && v.position !== "표본 부족").length;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[15px] font-bold text-black"
        aria-expanded={open}
      >
        주요 거래처 감시 <span style={{ color: MUTED }}>({vendors.length}곳{outCount > 0 ? ` · 범위 밖 ${outCount}` : ""}) {open ? "접기" : "펼치기"}</span>
      </button>
      <p className="mt-1 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
        A군 채널의 순매출 상위 거래처. 오늘 값이 같은 요일 8주 범위 안 어디인가. 감시는 원본 거래처명 기준입니다.
      </p>

      {open && (
        <table className="mt-4 w-full text-[14px]">
          <thead>
            <tr style={{ color: MUTED }} className="text-left text-[13px]">
              <th className="pb-2 font-normal">거래처</th>
              <th className="pb-2 pl-4 font-normal">채널</th>
              <th className="pb-2 pl-4 font-normal text-right">당일</th>
              <th className="pb-2 pl-4 font-normal text-right">8주 중앙값</th>
              <th className="pb-2 pl-4 font-normal w-[26%]">범위 위치</th>
              <th className="pb-2 pl-4 font-normal text-right">60일</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => {
              const flagged = flaggedAccounts.has(v.account);
              const out = v.position !== "범위 내" && v.position !== "표본 부족";
              return (
                <tr key={v.account} className="border-t border-solid" style={{ borderColor: "#eee" }}>
                  <td className="py-2.5">
                    {v.account_display}
                    {v.account_display !== v.account && (
                      <span className="ml-1.5 text-[11px]" style={{ color: MUTED }}>
                        ({v.account.length > 12 ? v.account.slice(0, 12) + "…" : v.account})
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-4 text-[13px]" style={{ color: MUTED }}>
                    {v.channel}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums font-bold">{fmtManwonBare(v.net)}</td>
                  <td className="py-2.5 pl-4 text-right tabular-nums" style={{ color: MUTED }}>
                    {fmtManwonBare(v.ref_median)}
                  </td>
                  <td className="py-2.5 pl-4">
                    {v.position === "표본 부족" ? (
                      <span className="text-[12px]" style={{ color: MUTED }}>
                        표본 부족(같은 요일 관측 {v.ref_n}/8)
                      </span>
                    ) : (
                      <>
                        <Bar v={v} flagged={flagged} />
                        <div
                          className="mt-1 text-[11px]"
                          style={{ color: flagged ? "#b45309" : MUTED, fontWeight: flagged ? 700 : 400 }}
                        >
                          {v.position}
                          {out && !flagged && " · 게이트 미만"}
                          {flagged && " · 확인 필요"}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums" style={{ color: MUTED }}>
                    {fmtEok(v.net_60d)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
