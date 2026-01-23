"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, ShoppingCart, Settings } from "lucide-react";

export default function Home() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
                        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Vibe Management Portal
                        </span>
                    </h1>
                    <p className="text-slate-500 text-lg">
                        통합 비즈니스 관리 및 분석 플랫폼
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Card 1: Sales Analysis */}
                    <Link
                        href="/custom-dashboard"
                        className="group relative bg-white rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />

                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <BarChart3 className="w-7 h-7" />
                            </div>

                            <h2 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">
                                매출 분석 대시보드
                            </h2>
                            <p className="text-slate-500 mb-6 leading-relaxed">
                                엑셀 데이터를 기반으로 한 상세 매출 분석, 이익률 추적 및 AI 기반 인사이트 제공
                            </p>

                            <div className="flex items-center text-sm font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                                대시보드 이동 <ArrowRight className="w-4 h-4 ml-1" />
                            </div>
                        </div>
                    </Link>

                    {/* Card 2: Coupang Orders (New) */}
                    <Link
                        href="/coupang-orders"
                        className="group relative bg-white rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />

                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                <ShoppingCart className="w-7 h-7" />
                            </div>

                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-2xl font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                                    쿠팡 발주 현황
                                </h2>
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                    New
                                </span>
                            </div>

                            <p className="text-slate-500 mb-6 leading-relaxed">
                                쿠팡 Wing API 연동을 통한 실시간 발주 리스트 확인 및 상태 모니터링
                            </p>

                            <div className="flex items-center text-sm font-bold text-orange-600 group-hover:translate-x-1 transition-transform">
                                발주 확인하기 <ArrowRight className="w-4 h-4 ml-1" />
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="mt-12 text-center">
                    <button className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium">
                        <Settings className="w-4 h-4" />
                        시스템 설정 (준비중)
                    </button>
                    <p className="mt-4 text-xs text-slate-300">
                        © 2024 Vibe Coding Corp. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
}
