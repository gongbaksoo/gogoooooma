"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 py-12 md:px-12">
      <div className="max-w-3xl w-full">
        <div className="mb-16 md:mb-20">
          <h1 className="text-[30px] leading-[1.13] font-bold text-black tracking-normal">
            Vibe Management Portal
          </h1>
          <p
            className="mt-4 text-[15px] leading-[1.5] font-normal"
            style={{ color: "rgba(93, 93, 93, 0.64)" }}
          >
            통합 비즈니스 관리 및 분석 플랫폼
          </p>
        </div>

        <Link
          href="/custom-dashboard"
          className="block bg-white border-0 group"
        >
          <h2 className="text-[22px] leading-[29.92px] font-bold text-black">
            매출 분석 대시보드
          </h2>
          <p className="mt-2 text-[15px] leading-[22.5px] font-normal text-black">
            엑셀 데이터를 기반으로 한 상세 매출 분석, 이익률 추적 및 AI 기반 인사이트 제공
          </p>

          <span
            className="mt-6 inline-flex items-center justify-between gap-3 bg-white text-black text-[14px] font-bold rounded-[4px] border border-solid"
            style={{
              borderColor: "#c4c4c4",
              padding: "16px 16px 16px 20px",
              minWidth: "180px",
              height: "52px",
            }}
          >
            <span>더보기</span>
            <span aria-hidden="true" className="text-[14px] leading-none">
              &gt;
            </span>
          </span>
        </Link>

        <div className="mt-20 md:mt-24 flex flex-col gap-3">
          <button
            type="button"
            className="self-start text-[13px] font-normal"
            style={{ color: "rgba(93, 93, 93, 0.64)" }}
          >
            시스템 설정 (준비중)
          </button>
          <p
            className="text-[12px] font-normal"
            style={{ color: "rgba(93, 93, 93, 0.64)" }}
          >
            © 2024 Vibe Coding Corp. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
