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
    // 새로 추가: 최근 3개월
    last_3months_total: number;
    last_3months_daily_avg: number;
    last_3months_days: number;
    // 새로 추가: 전년 동월
    prev_year_total: number;
    prev_year_daily_avg: number;
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
            <div className="bg-white border border-[#c4c4c4] p-8 mb-8 animate-pulse">
                <div className="h-8 bg-[#f0f0f0] rounded-sm w-1/3 mb-8"></div>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-16 bg-[#f5f5f5] rounded-sm w-full"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) return null;
    if (!summary || !summary.data) return null;

    const { meta, data } = summary;

    const formatMillions = (val: number) => {
        if (val === null || val === undefined || isNaN(val)) return '0';
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
        <div className="bg-white border border-[#c4c4c4] mb-6 md:mb-10 overflow-hidden">
            {/* Header Section */}
            <div className="bg-white px-6 py-5 md:px-8 md:py-6 border-b border-[#c4c4c4] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-black flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        월간 매출 현황 보고서
                    </h2>
                    <div className="mt-2 flex flex-col gap-1">
                        <p className="text-[#5d5d5d] text-xs md:text-sm font-normal flex flex-wrap items-center gap-1 md:gap-2">
                            집계월: <span className="text-black font-bold">{currentMonthLabel}</span>
                            <span className="text-[#c4c4c4] hidden md:inline">|</span>
                            데이터 기준일: <span className="text-black font-bold">{formatReferenceDate(meta.max_date)}</span>
                        </p>
                        <p className="text-[#5d5d5d] text-[10px] md:text-xs">
                            Source: {filename}
                        </p>
                    </div>
                </div>
                <div className="hidden md:flex px-3 py-1 text-black rounded-sm text-[10px] font-bold border border-[#c4c4c4] items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Auto-Refreshed
                </div>
            </div>

            {/* Content Section */}
            <div className="p-0 md:p-8">

                {/* Mobile View (Cards) - Visible on small screens */}
                <div className="md:hidden flex flex-col divide-y divide-[#e5e5e5]">
                    {categories.map((cat) => {
                        const item = data[cat.key];
                        if (!item) return null;

                        const isTotal = cat.type === 'total';
                        const isGrowth = item.growth_rate > 0;
                        const isDecline = item.growth_rate < 0;

                        return (
                            <div key={cat.key} className={`p-5 ${isTotal ? 'bg-[#f5f5f5]' : ''}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        {isTotal && <div className="w-1 h-5 bg-black"></div>}
                                        <span className={`font-bold text-lg ${isTotal ? 'text-black' : 'text-black'}`}>
                                            {cat.label}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-bold border ${isGrowth ? 'border-[#ff0066] text-[#ff0066]' :
                                        isDecline ? 'border-black text-black' : 'border-[#c4c4c4] text-[#5d5d5d]'
                                        }`}>
                                        {isGrowth ? <TrendingUp className="w-3 h-3" /> : isDecline ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                        {formatRate(item.growth_rate)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex flex-col space-y-1">
                                        <span className="text-xs text-[#5d5d5d] font-normal">당월 누적 매출</span>
                                        <div>
                                            <span className="text-xl font-bold text-black tracking-tight">
                                                {formatMillions(item.current_total)}
                                            </span>
                                            <span className="text-xs font-normal text-[#5d5d5d] ml-1">백만</span>
                                        </div>
                                        <span className="text-[10px] text-[#5d5d5d] self-start">
                                            전월 {formatMillions(item.prev_total)}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end space-y-1">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-[#5d5d5d] font-normal">일평균 매출</span>
                                            <span className="text-[9px] text-black font-bold border border-[#c4c4c4] px-1 rounded-sm">{item.current_days}일 기준</span>
                                        </div>
                                        <div>
                                            <span className="text-lg font-bold text-black tracking-tight">
                                                {formatMillions(item.current_daily_avg)}
                                            </span>
                                            <span className="text-xs font-normal text-[#5d5d5d] ml-1">백만</span>
                                        </div>
                                        <span className="text-[10px] text-[#5d5d5d] self-end">
                                            전월 {formatMillions(item.prev_daily_avg)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* PC/Tablet View (Table) - Hidden on mobile */}
                <div className="hidden md:block overflow-x-auto border border-[#c4c4c4]">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#f5f5f5] text-xs text-[#5d5d5d] uppercase tracking-wider border-b border-[#c4c4c4]">
                                <th className="text-left py-4 pl-6 font-semibold w-[9%]">구분</th>
                                <th className="text-right py-4 font-semibold w-[9%]">당월 누적 <span className="text-[10px] normal-case text-[#5d5d5d]">(백만)</span></th>
                                <th className="text-right py-4 font-semibold w-[8%]">당일매출 <span className="text-[10px] normal-case text-[#5d5d5d]">(백만)</span></th>
                                <th className="text-right py-4 font-semibold w-[12%]">당월 일평균 <span className="text-[10px] normal-case text-[#5d5d5d]">(백만)</span></th>
                                <th className="text-center py-4 font-semibold w-[10%]">전월 대비</th>
                                <th className="text-right py-4 font-semibold w-[13%]">전월 <span className="text-[10px] normal-case text-[#5d5d5d]">(누적/일평균)</span></th>
                                <th className="text-right py-4 font-semibold w-[16%]">최근 3개월 <span className="text-[10px] normal-case text-[#5d5d5d]">(누적/일평균)</span></th>
                                <th className="text-right py-4 pr-6 font-semibold w-[13%]">전년 동월 <span className="text-[10px] normal-case text-[#5d5d5d]">(누적/일평균)</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e5e5] bg-white">
                            {categories.map((cat) => {
                                const item = data[cat.key];
                                if (!item) return null;

                                const isTotal = cat.type === 'total';
                                const isGrowth = item.growth_rate > 0;
                                const isDecline = item.growth_rate < 0;
                                const isZero = item.growth_rate === 0;

                                return (
                                    <tr key={cat.key} className={`group transition-colors hover:bg-[#f8f8f8] ${isTotal ? 'bg-[#f5f5f5]' : ''}`}>
                                        <td className="py-5 pl-6">
                                            <div className={`flex items-center gap-2 ${isTotal ? 'pl-2' : ''}`}>
                                                <span className="font-bold text-sm text-black">
                                                    {cat.label}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-4 text-right font-bold text-black text-base tabular-nums tracking-tight">
                                            {formatMillions(item.current_total)}
                                        </td>

                                        <td className="py-4 text-right font-bold text-black text-base tabular-nums tracking-tight">
                                            {formatMillions(item.latest_day_sales)}
                                        </td>

                                        <td className="py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-base font-bold text-black tabular-nums tracking-tight">
                                                        {formatMillions(item.current_daily_avg)}
                                                    </span>
                                                    <span className="text-[9px] text-black font-bold border border-[#c4c4c4] px-1 py-0.5 rounded-sm">
                                                        {item.current_days}일
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-4 text-center">
                                            <div className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-sm w-[90px] mx-auto border ${isGrowth ? 'border-[#ff0066] text-[#ff0066]' :
                                                isDecline ? 'border-black text-black' : 'border-[#c4c4c4] text-[#5d5d5d]'
                                                }`}>
                                                {isGrowth && <TrendingUp className="w-3 h-3" />}
                                                {isDecline && <TrendingDown className="w-3 h-3" />}
                                                {isZero && <Minus className="w-3 h-3" />}
                                                <span className="font-bold text-xs tabular-nums">{formatRate(item.growth_rate)}</span>
                                            </div>
                                        </td>

                                        <td className="py-4 text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-[#5d5d5d]">누적</span>
                                                    <span className="text-[#5d5d5d] text-sm font-medium tabular-nums">
                                                        {formatMillions(item.prev_total)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-[#5d5d5d]">일평균</span>
                                                    <span className="text-[#5d5d5d] text-sm tabular-nums">
                                                        {formatMillions(item.prev_daily_avg)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 새로 추가: 최근 3개월 */}
                                        <td className="py-4 text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-[#5d5d5d]">누적</span>
                                                    <span className="text-black text-sm font-bold tabular-nums">
                                                        {formatMillions(item.last_3months_total)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-[#5d5d5d]">{item.last_3months_days}일</span>
                                                    <span className="text-[#5d5d5d] text-sm tabular-nums">
                                                        {formatMillions(item.last_3months_daily_avg)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 새로 추가: 전년 동월 */}
                                        <td className="py-4 pr-6 text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-[#5d5d5d]">누적</span>
                                                    <span className="text-black text-sm font-bold tabular-nums">
                                                        {item.prev_year_total > 0 ? formatMillions(item.prev_year_total) : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-[#5d5d5d]">일평균</span>
                                                    <span className="text-[#5d5d5d] text-sm tabular-nums">
                                                        {item.prev_year_daily_avg > 0 ? formatMillions(item.prev_year_daily_avg) : '-'}
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
                    <p className="text-[10px] md:text-xs text-[#5d5d5d] flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        일평균 매출은 [당월 누적 매출]을 [해당 월의 실제 데이터가 존재하는 일수]로 나누어 계산됩니다.
                    </p>
                    <p className="text-[10px] md:text-xs text-[#5d5d5d]">
                        * 매출 단위: 백만 원, 소수점 반올림 처리
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SalesSummary;
