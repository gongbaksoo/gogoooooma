"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";
import DataGuard from "@/components/daily-review/DataGuard";
import AccrualSnapshot from "@/components/daily-review/AccrualSnapshot";
import AnomalyCards from "@/components/daily-review/AnomalyCards";
import PaceSection from "@/components/daily-review/PaceSection";
import BGroupEvents from "@/components/daily-review/BGroupEvents";
import SilenceLog from "@/components/daily-review/SilenceLog";
import { DailyReview } from "@/components/daily-review/types";

const MUTED = "rgba(93, 93, 93, 0.64)";

/**
 * 일 리뷰 — 「직전 코어 계상일 점검표」.
 *
 * pull 방식이다(열었을 때 서버의 최신 파일 기준). CSV를 사람이 손으로 올리는 구조라
 * 정해진 시각에 자동 발송하는 푸시는 기준일이 밀린 채로 나갈 수 있다.
 */
export default function DailyReviewPage() {
  const [data, setData] = useState<DailyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string>("");

  const load = useCallback(async (date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<DailyReview>(`${API_BASE_URL}/api/daily-review/summary/`, {
        params: { ...(date ? { target_date: date } : {}), t: Date.now() },
        timeout: 60000,
      });
      setData(res.data);
      if (res.data.status === "ok") setTargetDate(res.data.meta.target_date);
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.detail ?? e.message
        : "알 수 없는 오류";
      setError(String(msg));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-white px-5 py-10 md:px-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-[13px]" style={{ color: MUTED }}>
          ← 홈
        </Link>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] leading-[1.13] font-bold text-black">일 리뷰</h1>
            <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
              직전 코어 계상일 점검표 — 데이터 도착 · 예외 감지 · 월 페이스
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="border border-solid rounded-[4px] px-3 py-2 text-[14px]"
              style={{ borderColor: "#c4c4c4" }}
            />
            <button
              type="button"
              onClick={() => load(targetDate || undefined)}
              className="border border-solid rounded-[4px] px-4 py-2 text-[14px] font-bold text-black"
              style={{ borderColor: "#c4c4c4" }}
            >
              조회
            </button>
            <button
              type="button"
              onClick={() => load()}
              className="text-[13px]"
              style={{ color: MUTED }}
            >
              최신일
            </button>
          </div>
        </header>

        {loading && (
          <p className="mt-16 text-[15px]" style={{ color: MUTED }}>
            불러오는 중…
          </p>
        )}

        {error && (
          <div
            className="mt-8 border border-solid rounded-[4px] px-5 py-4 text-[14px]"
            style={{ borderColor: "#c4c4c4" }}
          >
            <b>불러오지 못했습니다.</b>
            <p className="mt-1" style={{ color: MUTED }}>
              {error}
            </p>
          </div>
        )}

        {!loading && data?.status === "non_core_day" && (
          <div
            className="mt-8 border border-solid rounded-[4px] px-5 py-4"
            style={{ borderColor: "#c4c4c4" }}
          >
            <p className="text-[15px] font-bold text-black">{data.message}</p>
            <p className="mt-1 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
              계상된 채널이 6개 미만인 날입니다. 주말·공휴일에는 소수 채널의 배치 전표만 실리므로
              그날을 리뷰하면 잘못된 결론이 나옵니다.
            </p>
            {data.suggestion && (
              <button
                type="button"
                onClick={() => {
                  setTargetDate(data.suggestion!);
                  load(data.suggestion!);
                }}
                className="mt-3 border border-solid rounded-[4px] px-4 py-2 text-[14px] font-bold text-black"
                style={{ borderColor: "#c4c4c4" }}
              >
                직전 계상일 {data.suggestion} 보기
              </button>
            )}
          </div>
        )}

        {!loading && data?.status === "no_data" && (
          <p className="mt-16 text-[15px]" style={{ color: MUTED }}>
            {data.message}
          </p>
        )}

        {!loading && data?.status === "ok" && (
          <main className="mt-8 flex flex-col gap-10">
            <div>
              <h2 className="text-[22px] font-bold text-black">
                {data.meta.target_date}({data.meta.weekday}) 계상 기준
              </h2>
              <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
                {data.meta.target_date_source === "auto_latest" ? "자동 선택된 최신 코어 계상일" : "사용자 지정일"}
                {" · "}파일 {data.meta.filename}
              </p>
            </div>

            <DataGuard data={data} />
            <AnomalyCards data={data} />
            <AccrualSnapshot data={data} />
            <PaceSection data={data} />
            <BGroupEvents data={data} />
            <SilenceLog data={data} />
          </main>
        )}
      </div>
    </div>
  );
}
