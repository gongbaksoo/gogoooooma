"use client";

import { useState } from "react";
import { fmtManwonBare, fmtEok } from "@/lib/manwon";
import { DailyReview } from "./types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/**
 * 심화 감시 — 월 리뷰가 상시 파는 3축(거래처 · 브랜드 · 상품)을 일 단위로.
 *
 * 전부 **A군 채널로 스코프**한다(배치 채널 제외). 브랜드는 A군 스코프여야 깨끗하다
 * (마이비 전채널 CV 1.68 → A군 0.68, 48회차). 상품은 예외 카드로 올리지 않는다
 * (상품 예외는 연 101건이라 '조용한 날은 짧게' 원칙을 깬다) — 감시 패널로만.
 * 기본 접힘: 판정일 58.7%가 예외 0건이므로 조용한 날 화면이 길어지지 않게.
 */
interface Row {
  key: string;
  label: string;
  sub?: string;      // 채널 / ERP 원본 / 배지
  badge?: string;    // 변동 큼
  net: number;
  ref_min: number;
  ref_max: number;
  ref_median: number;
  ref_n: number;
  position: string;
  net_60d: number;
  flagged: boolean;
}

function Bar({ r }: { r: Row }) {
  const lo = Math.min(r.ref_min, r.net, 0);
  const hi = Math.max(r.ref_max, r.net);
  const span = hi - lo || 1;
  const pct = (x: number) => ((x - lo) / span) * 100;
  return (
    <div className="relative h-[6px] w-full rounded-[3px]" style={{ background: "#f0f0f0" }}>
      <div
        className="absolute h-full rounded-[3px]"
        style={{ left: `${pct(r.ref_min)}%`, width: `${pct(r.ref_max) - pct(r.ref_min)}%`, background: "#d9d9d9" }}
      />
      <div
        className="absolute top-[-3px] h-[12px] w-[2px]"
        style={{ left: `${pct(r.net)}%`, background: r.flagged ? "#b45309" : "#000" }}
      />
    </div>
  );
}

function SubTable({ title, note, firstHeader, rows }: { title: string; note: string; firstHeader: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="text-[14px] font-bold text-black">{title}</h3>
      <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>{note}</p>
      <table className="mt-2 w-full text-[13px]">
        <thead>
          <tr style={{ color: MUTED }} className="text-left text-[12px]">
            <th className="pb-2 font-normal">{firstHeader}</th>
            <th className="pb-2 pl-4 font-normal text-right">당일</th>
            <th className="pb-2 pl-4 font-normal text-right">8주 중앙값</th>
            <th className="pb-2 pl-4 font-normal w-[30%]">범위 위치</th>
            <th className="pb-2 pl-4 font-normal text-right">60일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const out = r.position !== "범위 내" && r.position !== "표본 부족";
            return (
              <tr key={r.key} className="border-t border-solid" style={{ borderColor: "#eee" }}>
                <td className="py-2">
                  {r.label}
                  {r.badge && (
                    <span className="ml-1.5 text-[11px]" style={{ color: MUTED }}>{r.badge}</span>
                  )}
                  {r.sub && (
                    <span className="ml-1.5 text-[11px]" style={{ color: MUTED }}>{r.sub}</span>
                  )}
                </td>
                <td className="py-2 pl-4 text-right tabular-nums font-bold">{fmtManwonBare(r.net)}</td>
                <td className="py-2 pl-4 text-right tabular-nums" style={{ color: MUTED }}>
                  {fmtManwonBare(r.ref_median)}
                </td>
                <td className="py-2 pl-4">
                  {r.position === "표본 부족" ? (
                    <span className="text-[12px]" style={{ color: MUTED }}>
                      표본 부족(같은 요일 {r.ref_n}/8)
                    </span>
                  ) : (
                    <>
                      <Bar r={r} />
                      <div
                        className="mt-1 text-[11px]"
                        style={{ color: r.flagged ? "#b45309" : MUTED, fontWeight: r.flagged ? 700 : 400 }}
                      >
                        {r.position}
                        {out && !r.flagged && " · 게이트 미만"}
                        {r.flagged && " · 확인 필요"}
                      </div>
                    </>
                  )}
                </td>
                <td className="py-2 pl-4 text-right tabular-nums" style={{ color: MUTED }}>
                  {fmtEok(r.net_60d)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DeepWatch({ data }: { data: DailyReview }) {
  const [open, setOpen] = useState(false);
  const s = data.accrual_snapshot;
  const vendors = s.top_vendors ?? [];
  const brands = s.top_brands ?? [];
  const products = s.top_products ?? [];
  if (vendors.length === 0 && brands.length === 0 && products.length === 0) return null;

  // 게이트를 넘어 예외 카드로 오른 거래처 = 강조. (예외 카드는 채널·거래처만 — 브랜드·상품은 감시 전용.)
  const flaggedAccounts = new Set(
    data.anomalies.flags.filter((f) => f.level === "account").map((f) => f.entity.split(" · ").pop())
  );

  const vendorRows: Row[] = vendors.map((v) => ({
    key: `v:${v.account}`,
    label: v.account_display,
    sub: v.channel ?? undefined,
    net: v.net, ref_min: v.ref_min, ref_max: v.ref_max, ref_median: v.ref_median,
    ref_n: v.ref_n, position: v.position, net_60d: v.net_60d,
    flagged: flaggedAccounts.has(v.account),
  }));
  const brandRows: Row[] = brands.map((b) => ({
    key: `b:${b.brand}`,
    label: b.brand,
    badge: b.high_variance ? "변동 큼" : undefined,
    net: b.net, ref_min: b.ref_min, ref_max: b.ref_max, ref_median: b.ref_median,
    ref_n: b.ref_n, position: b.position, net_60d: b.net_60d,
    flagged: false,
  }));
  const productRows: Row[] = products.map((p) => ({
    key: `p:${p.code}`,
    label: p.name,
    net: p.net, ref_min: p.ref_min, ref_max: p.ref_max, ref_median: p.ref_median,
    ref_n: p.ref_n, position: p.position, net_60d: p.net_60d,
    flagged: false,
  }));

  const outCount = [...vendorRows, ...brandRows, ...productRows].filter(
    (r) => r.position !== "범위 내" && r.position !== "표본 부족"
  ).length;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[15px] font-bold text-black"
        aria-expanded={open}
      >
        심화 감시{" "}
        <span style={{ color: MUTED }}>
          거래처 · 브랜드 · 상품{outCount > 0 ? ` · 범위 밖 ${outCount}` : ""} {open ? "접기" : "펼치기"}
        </span>
      </button>
      <p className="mt-1 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
        월 리뷰가 상시 파는 3축을 일 단위로. 전부 A군 채널 기준(배치 채널 제외). 감시는 원본 기준, 표시는 별칭.
      </p>

      {open && (
        <>
          <SubTable
            title="거래처"
            note="A군 채널 순매출 상위 거래처. 표시명은 별칭(11st→11번가)."
            firstHeader="거래처"
            rows={vendorRows}
          />
          <SubTable
            title="브랜드"
            note="3대 브랜드 A군 일별. 마이비·누비는 A군 스코프로 안정(CV 0.7 안팎), 쏭레브는 변동 큼."
            firstHeader="브랜드"
            rows={brandRows}
          />
          <SubTable
            title="상품(SKU)"
            note="A군 순매출 상위 상품. 예외 카드로는 올리지 않는다(소음 방지) — 히어로 SKU 움직임만 여기서."
            firstHeader="상품"
            rows={productRows}
          />
        </>
      )}
    </section>
  );
}
