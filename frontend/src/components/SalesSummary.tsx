'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { TrendingUp, TrendingDown, Minus, Calendar, RefreshCw, Info } from 'lucide-react';

interface SalesSummaryProps {
    filename: string | null;
}

interface SummaryData {
    current_total: number;
    current_daily_avg: number;
    current_days: number;
    latest_day_sales: number;  // 당일매출
    growth_rate: number;
    prev_total: number;
    prev_daily_avg: number;
}

interface SummaryResponse {
    meta: {
        current_month: string;
        prev_month: string;
        max_date: string;
    };
    data: {
        [key: string]: SummaryData;
    };
}

const SalesSummary: React.FC<SalesSummaryProps> = ({ filename }) => {
    const [summary, setSummary] = useState<SummaryResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!filename) return;

        const fetchSummary = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/summary`, {
                    params: { filename }
                });
                setSummary(response.data);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch summary:', err);
                setError('요약 데이터를 불러오는데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [filename]);

    if (!filename) return null;

    // Skeleton Loading
    if (loading) {
        return (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 mb-8 animate-pulse">
                <div className="h-8 bg-slate-100 rounded-lg w-1/3 mb-8"></div>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-16 bg-slate-50 rounded-xl w-full"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) return null;
    if (!summary || !summary.data) return null;

    const { meta, data } = summary;

    const formatMillions = (val: number) => {
        return Math.round(val / 1000000).toLocaleString();
    };

    const formatRate = (val: number) => {
        const absVal = Math.abs(val);
        return `${absVal.toFixed(1)}%`;
    };

    const categories = [
        { key: '전체', label: '전체 매출', type: 'total' },
        { key: '이커머스', label: '이커머스', type: 'channel' },
        { key: '오프라인', label: '오프라인', type: 'channel' },
        { key: '마이비', label: '마이비', type: 'brand' },
        { key: '누비', label: '누비', type: 'brand' },
        { key: '쏭레브', label: '쏭레브', type: 'brand' },
    ];

    const currentMonthLabel = meta.current_month ? `${meta.current_month.split('-')[0]}년 ${parseInt(meta.current_month.split('-')[1])}월` : '';

    // 기준일 포맷 (YYYY-MM-DD -> YYYY년 MM월 DD일)
    const formatReferenceDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 mb-6 md:mb-10 overflow-hidden transition-all hover:shadow-2xl hover:shadow-slate-200/60">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-5 md:px-8 md:py-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                        <span className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
                            <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                        </span>
                        월간 매출 현황 보고서
                    </h2>
                    <div className="mt-2 flex flex-col gap-1">
                        <p className="text-slate-500 text-xs md:text-sm font-medium flex flex-wrap items-center gap-1 md:gap-2">
                            집계월: <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">{currentMonthLabel}</span>
                            <span className="text-slate-300 hidden md:inline">|</span>
                            데이터 기준일: <span className="text-slate-700 font-bold underline decoration-blue-200 underline-offset-4">{formatReferenceDate(meta.max_date)}</span>
                        </p>
                        <p className="text-slate-400 text-[10px] md:text-xs">
                            Source: {filename}
                        </p>
                    </div>
                </div>
                <div className="hidden md:flex px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-100 items-center gap-1 shadow-sm">
                    <RefreshCw className="w-3 h-3" />
                    Auto-Refreshed
                </div>
            </div>

            {/* Content Section */}
            <div className="p-0 md:p-8">

                {/* Mobile View (Cards) - Visible on small screens */}
                <div className="md:hidden flex flex-col divide-y divide-slate-100">
                    {categories.map((cat) => {
                        const item = data[cat.key];
                        if (!item) return null;

                        const isTotal = cat.type === 'total';
                        const isGrowth = item.growth_rate > 0;
                        const isDecline = item.growth_rate < 0;

                        return (
                            <div key={cat.key} className={`p-5 ${isTotal ? 'bg-slate-50 border-b-2 border-slate-200' : ''}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        {isTotal && <div className="w-1 h-5 bg-blue-600 rounded-full"></div>}
                                        <span className={`font-bold text-lg ${isTotal ? 'text-slate-900' : 'text-slate-700'}`}>
                                            {cat.label}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${isGrowth ? 'bg-red-50 text-red-600 border-red-100' :
                                        isDecline ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                                        }`}>
                                        {isGrowth ? <TrendingUp className="w-3 h-3" /> : isDecline ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                        {formatRate(item.growth_rate)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex flex-col space-y-1">
                                        <span className="text-xs text-slate-400 font-medium">당월 누적 매출</span>
                                        <div>
                                            <span className="text-xl font-bold text-slate-800 tracking-tight">
                                                {formatMillions(item.current_total)}
                                            </span>
                                            <span className="text-xs font-normal text-slate-400 ml-1">백만</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 bg-slate-50 self-start px-1.5 py-0.5 rounded">
                                            전월 {formatMillions(item.prev_total)}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end space-y-1">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400 font-medium">일평균 매출</span>
                                            <span className="text-[9px] text-blue-500 font-bold bg-blue-50 px-1 rounded">{item.current_days}일 기준</span>
                                        </div>
                                        <div>
                                            <span className="text-lg font-bold text-slate-700 tracking-tight">
                                                {formatMillions(item.current_daily_avg)}
                                            </span>
                                            <span className="text-xs font-normal text-slate-400 ml-1">백만</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 bg-slate-50 self-end px-1.5 py-0.5 rounded">
                                            전월 {formatMillions(item.prev_daily_avg)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* PC/Tablet View (Table) - Hidden on mobile */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50/80 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <th className="text-left py-4 pl-8 font-semibold w-[12%]">구분</th>
                                <th className="text-right py-4 font-semibold w-[15%]">당월 누적 <span className="text-[10px] normal-case text-slate-400">(백만원)</span></th>
                                <th className="text-right py-4 font-semibold w-[15%]">당일매출 <span className="text-[10px] normal-case text-slate-400">(백만원)</span></th>
                                <th className="text-right py-4 font-semibold w-[18%]">당월 일평균 <span className="text-[10px] normal-case text-slate-400">(백만원)</span></th>
                                <th className="text-center py-4 font-semibold w-[13%]">전월 대비</th>
                                <th className="text-right py-4 pr-8 font-semibold w-[27%]">전월 데이터 <span className="text-[10px] normal-case text-slate-400">(누적 / 일평균)</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {categories.map((cat) => {
                                const item = data[cat.key];
                                if (!item) return null;

                                const isTotal = cat.type === 'total';
                                const isGrowth = item.growth_rate > 0;
                                const isDecline = item.growth_rate < 0;
                                const isZero = item.growth_rate === 0;

                                return (
                                    <tr key={cat.key} className={`group transition-colors hover:bg-slate-50 ${isTotal ? 'bg-slate-50/50' : ''}`}>
                                        <td className="py-5 pl-8">
                                            <div className={`flex items-center gap-3 ${isTotal ? 'pl-2' : ''}`}>
                                                {isTotal && <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-sm shadow-blue-200"></div>}
                                                <span className={`font-bold text-base ${isTotal ? 'text-slate-900' : 'text-slate-600'}`}>
                                                    {cat.label}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-5 text-right font-bold text-slate-800 text-lg tabular-nums tracking-tight">
                                            {formatMillions(item.current_total)}
                                        </td>

                                        <td className="py-5 text-right font-bold text-blue-600 text-lg tabular-nums tracking-tight">
                                            {formatMillions(item.latest_day_sales)}
                                        </td>

                                        <td className="py-5 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-bold text-slate-600 tabular-nums tracking-tight">
                                                        {formatMillions(item.current_daily_avg)}
                                                    </span>
                                                    <div className="group relative">
                                                        <span className="cursor-help text-[10px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-0.5">
                                                            {item.current_days}일 기준
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-slate-400 mt-1 mr-1">
                                                    (누적 ÷ {item.current_days}일)
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-5 text-center">
                                            <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full w-[110px] mx-auto transition-all shadow-sm ${isGrowth ? 'bg-green-50 text-green-700 border border-green-200' :
                                                isDecline ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                }`}>
                                                {isGrowth && <TrendingUp className="w-3.5 h-3.5" />}
                                                {isDecline && <TrendingDown className="w-3.5 h-3.5" />}
                                                {isZero && <Minus className="w-3.5 h-3.5" />}
                                                <span className="font-bold text-sm tabular-nums">{formatRate(item.growth_rate)}</span>
                                            </div>
                                        </td>

                                        <td className="py-5 pr-8 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">누적</span>
                                                    <span className="text-slate-500 text-sm font-medium tabular-nums">
                                                        {formatMillions(item.prev_total)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">일평균</span>
                                                    <span className="text-slate-400 text-sm tabular-nums">
                                                        {formatMillions(item.prev_daily_avg)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Insight */}
                <div className="mt-4 md:mt-6 flex flex-col md:flex-row justify-between items-center px-6 md:px-0 gap-2">
                    <p className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        일평균 매출은 [당월 누적 매출]을 [해당 월의 실제 데이터가 존재하는 일수]로 나누어 계산됩니다.
                    </p>
                    <p className="text-[10px] md:text-xs text-slate-400 italic">
                        * 매출 단위: 백만 원, 소수점 반올림 처리
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SalesSummary;
