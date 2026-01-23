"use client";

import Link from "next/link";
import { ArrowLeft, ShoppingCart, RefreshCw, Box } from "lucide-react";

export default function CoupangOrdersPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-orange-500" />
                                쿠팡 발주 현황
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                API 연동 준비중
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Portal */}
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Stat Card 1 */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="text-slate-500 text-sm font-medium mb-2">신규 주문</div>
                        <div className="text-3xl font-bold text-slate-800">0 건</div>
                        <div className="text-xs text-slate-400 mt-2">최근 업데이트: -</div>
                    </div>
                    {/* Stat Card 2 */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="text-slate-500 text-sm font-medium mb-2">발주 대기</div>
                        <div className="text-3xl font-bold text-orange-600">0 건</div>
                        <div className="text-xs text-slate-400 mt-2">빠른 처리가 필요합니다</div>
                    </div>
                    {/* Stat Card 3 */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="text-slate-500 text-sm font-medium mb-2">오늘 출고량</div>
                        <div className="text-3xl font-bold text-blue-600">0 건</div>
                        <div className="text-xs text-slate-400 mt-2">전일 대비 -</div>
                    </div>
                </div>

                {/* Empty State / Placeholder */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <Box className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                        발주 내역을 불러올 준비가 되었습니다
                    </h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-8">
                        쿠팡 Wing API 키를 설정하고 연동하면 실시간으로 주문 데이터를 가져올 수 있습니다.
                    </p>
                    <button className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-100 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        API 연동하기 (개발 예정)
                    </button>
                </div>
            </div>
        </div>
    );
}
