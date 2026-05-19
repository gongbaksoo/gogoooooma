'use client';

import React, { useEffect, useState } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface SalesChartProps {
    filename: string | null;
}

interface ChartData {
    month: string;
    이커머스: number;
    오프라인: number;
    총매출: number;
    days?: number;
    rawMonth?: string;
    // Profit data
    ecommerceProfit?: number;
    offlineProfit?: number;
    totalProfit?: number;
    profitRate?: number;
    ecommerceRate?: number;
    offlineRate?: number;
    totalRate?: number;
}

type ViewMode = 'sales' | 'growth' | 'daily' | 'profitRate';
type ChannelFilter = 'all' | 'total' | 'ecommerce' | 'offline';

const SalesChartNew: React.FC<SalesChartProps> = ({ filename }) => {
    const [data, setData] = useState<{
        months: string[];
        ecommerce: number[];
        offline: number[];
        total: number[];
        ecommerceProfit: number[];
        offlineProfit: number[];
        totalProfit: number[];
    } | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('sales');
    const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [daysList, setDaysList] = useState<number[]>([]);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    // Date Range Filter State
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');

    useEffect(() => {
        const fetchData = async () => {
            if (!filename) {
                setData(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/monthly-sales`, {
                    params: { filename }
                });

                const { months, ecommerce, offline, total, days_list, debug_logs, ecommerce_profit, offline_profit, total_profit } = response.data;

                setData({
                    months: months || [],
                    ecommerce: ecommerce || [],
                    offline: offline || [],
                    total: total || [],
                    ecommerceProfit: ecommerce_profit || [],
                    offlineProfit: offline_profit || [],
                    totalProfit: total_profit || []
                });
                setDaysList(days_list || []);
                setDebugLogs(debug_logs || []);

                // Initialize Date Range to full range
                if (months && months.length > 0) {
                    setStartMonth(months[0]);
                    setEndMonth(months[months.length - 1]);
                }
            } catch (err) {
                console.error('Failed to fetch sales data:', err);
                setError('데이터를 불러오는데 실패했습니다');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [filename]);

    const formatMonth = (month: string): string => {
        if (month.length === 4) {
            const year = month.substring(0, 2);
            const mon = parseInt(month.substring(2, 4));
            return `${year}년 ${mon}월`;
        }
        return month;
    };

    const formatMillions = (value: any): string => {
        if (typeof value !== 'number') return String(value);
        if (value >= 100000000) {
            return `${(value / 100000000).toFixed(1)}억`;
        } else if (value >= 10000) {
            return `${(value / 10000).toFixed(0)}만`;
        }
        return value.toLocaleString();
    };

    const formatXAxisTick = (value: string, index: number) => {
        if (!value || value.length !== 4) return value;
        const year = value.substring(0, 2);
        const month = parseInt(value.substring(2, 4));

        // 첫 번째 데이터이거나 1월인 경우에만 연도 표시 ("24'1" 형식 - 공백 제거)
        if (index === 0 || month === 1) {
            return `${year}'${month}`;
        }
        return `${month}`;
    };

    const formatCurrency = (value: any): string => {
        if (typeof value !== 'number') return String(value);
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
    };

    const formatPercent = (value: any): string => {
        if (typeof value !== 'number') return String(value);
        return `${value.toFixed(1)}%`;
    };

    const calculateGrowth = (current: number, previous: number): number => {
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    };

    const getChartData = (): ChartData[] => {
        if (!data) return [];

        const { months, ecommerce, offline, total, ecommerceProfit, offlineProfit, totalProfit } = data;

        // Transform raw data into ChartData objects
        const transformedData = months.map((month: string, index: number) => ({
            month: formatMonth(month),
            이커머스: ecommerce[index] || 0,
            오프라인: offline[index] || 0,
            총매출: total[index] || 0,
            rawMonth: month,
            days: daysList[index] || 30,
            ecommerceProfit: ecommerceProfit[index] || 0,
            offlineProfit: offlineProfit[index] || 0,
            totalProfit: totalProfit[index] || 0
        }));

        // Filter by Date Range
        let filteredData = transformedData.filter(item => {
            if (!item.rawMonth) return true;
            if (startMonth && item.rawMonth < startMonth) return false;
            if (endMonth && item.rawMonth > endMonth) return false;
            return true;
        });

        // Apply view mode specific calculations
        if (viewMode === 'growth') {
            const growthData: ChartData[] = [];
            for (let i = 1; i < filteredData.length; i++) {
                const current = filteredData[i];
                const previous = filteredData[i - 1];

                growthData.push({
                    ...current,
                    이커머스: calculateGrowth(current.이커머스, previous.이커머스),
                    오프라인: calculateGrowth(current.오프라인, previous.오프라인),
                    총매출: calculateGrowth(current.총매출, previous.총매출),
                });
            }
            return growthData;
        }

        if (viewMode === 'daily') {
            return filteredData.map(item => {
                const days = item.days || 30;
                return {
                    ...item,
                    이커머스: item.이커머스 / days,
                    오프라인: item.오프라인 / days,
                    총매출: item.총매출 / days
                };
            });
        }

        if (viewMode === 'profitRate') {
            return filteredData.map(item => {
                const eSales = item.이커머스 || 0;
                const eProfit = item.ecommerceProfit || 0;
                const eRate = eSales === 0 ? 0 : (eProfit / eSales) * 100;

                const oSales = item.오프라인 || 0;
                const oProfit = item.offlineProfit || 0;
                const oRate = oSales === 0 ? 0 : (oProfit / oSales) * 100;

                const tSales = item.총매출 || 0;
                const tProfit = item.totalProfit || 0;
                const tRate = tSales === 0 ? 0 : (tProfit / tSales) * 100;

                return {
                    ...item,
                    ecommerceRate: eRate,
                    offlineRate: oRate,
                    totalRate: tRate,
                    profitRate: tRate // for backward compatibility/default
                };
            });
        }

        // Default 'sales' view mode
        return filteredData;
    };

    if (!filename) {
        return (
            <div className="bg-white p-6 border border-[#c4c4c4]">
                <h3 className="text-lg font-bold text-black mb-4">월별 매출 추이</h3>
                <div className="h-80 flex items-center justify-center text-[#5d5d5d]">
                    파일을 업로드하거나 선택해주세요
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white p-6 border border-[#c4c4c4]">
                <h3 className="text-lg font-bold text-black mb-4">월별 매출 추이</h3>
                <div className="h-80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white p-6 border border-[#c4c4c4]">
                <h3 className="text-lg font-bold text-black mb-4">월별 매출 추이</h3>
                <div className="h-80 flex items-center justify-center text-red-500">
                    {error}
                </div>
            </div>
        );
    }

    const chartData = getChartData();
    const tooltipFormatter = (value: any, name: any, props: any) => {
        if (viewMode === 'growth' || viewMode === 'profitRate') {
            return [formatPercent(value), name];
        } else {
            const days = props.payload.days;
            const suffix = viewMode === 'daily' ? ` (기준: ${days}일)` : '';
            return [formatCurrency(value) + (viewMode === 'daily' ? '' : '원'), name + suffix];
        }
    };

    const chartTitle = viewMode === 'sales'
        ? '월별 이커머스 vs 오프라인 매출 추이'
        : viewMode === 'daily'
            ? '월별 일평균 매출 (이커머스 vs 오프라인)'
            : viewMode === 'profitRate'
                ? '월별 평균 이익률 (%)'
                : '월별 매출 증감율 (전월 대비)';

    const yAxisLabel = viewMode === 'sales'
        ? '매출액'
        : viewMode === 'daily'
            ? '일평균 매출'
            : viewMode === 'profitRate'
                ? '이익률 (%)'
                : '증감율 (%)';

    // YAxis formatter selection
    const yAxisFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? formatPercent : formatMillions;

    // Label formatter selection
    const labelFormatter = (val: any) => {
        if (typeof val !== 'number') return String(val);
        if (viewMode === 'growth' || viewMode === 'profitRate') {
            return val.toFixed(1) + '%';
        }
        return formatMillions(val);
    };

    return (
        <div className="bg-white p-4 md:p-8 border border-[#c4c4c4] mt-12 first:mt-0">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                <div>
                    <h3 className="text-xl md:text-2xl font-bold text-black tracking-tight leading-tight">
                        {chartTitle}
                    </h3>
                    <p className="text-[#5d5d5d] text-sm mt-1 font-normal">Monthly performance overview</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    {/* Date Range Selectors */}
                    {data && data.months && (
                        <div className="flex items-center gap-1 bg-white p-1 rounded border border-[#c4c4c4] w-full sm:w-auto justify-between">
                            <select
                                value={startMonth}
                                onChange={(e) => setStartMonth(e.target.value)}
                                className="bg-transparent text-sm font-medium text-black focus:outline-none p-1"
                            >
                                {data.months.map(m => (
                                    <option key={`start-${m}`} value={m}>{formatMonth(m)}</option>
                                ))}
                            </select>
                            <span className="text-[#c4c4c4]">~</span>
                            <select
                                value={endMonth}
                                onChange={(e) => setEndMonth(e.target.value)}
                                className="bg-transparent text-sm font-medium text-black focus:outline-none p-1"
                            >
                                {data.months.map(m => (
                                    <option key={`end-${m}`} value={m}>{formatMonth(m)}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={() => setViewMode('sales')}
                        className={`px-4 py-2.5 rounded text-xs font-bold transition-colors border grow sm:grow-0 ${viewMode === 'sales'
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-[#c4c4c4] hover:border-black'
                            }`}
                    >
                        매출액
                    </button>
                    <button
                        onClick={() => setViewMode('daily')}
                        className={`px-4 py-2.5 rounded text-xs font-bold transition-colors border grow sm:grow-0 ${viewMode === 'daily'
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-[#c4c4c4] hover:border-black'
                            }`}
                    >
                        일평균
                    </button>
                    <button
                        onClick={() => setViewMode('profitRate')}
                        className={`px-4 py-2.5 rounded text-xs font-bold transition-colors border grow sm:grow-0 ${viewMode === 'profitRate'
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-[#c4c4c4] hover:border-black'
                            }`}
                    >
                        이익률
                    </button>
                    <button
                        onClick={() => setViewMode('growth')}
                        className={`px-4 py-2.5 rounded text-xs font-bold transition-colors border grow sm:grow-0 ${viewMode === 'growth'
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-[#c4c4c4] hover:border-black'
                            }`}
                    >
                        증감율
                    </button>
                    <select
                        value={channelFilter}
                        onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
                        className="px-4 py-2.5 rounded text-xs font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black grow sm:grow-0"
                    >
                        <option value="all">전체 채널</option>
                        <option value="total">총매출만</option>
                        <option value="ecommerce">이커머스</option>
                        <option value="offline">오프라인</option>
                    </select>
                </div>
            </div>
            <div className="h-[350px] md:h-[450px] w-full mt-4">
                <div key={`${viewMode}-${channelFilter}`} style={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="rawMonth"
                            tickFormatter={formatXAxisTick}
                            stroke="#5d5d5d"
                            style={{ fontSize: '9px', fontWeight: 500 }}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis
                            stroke="#5d5d5d"
                            style={{ fontSize: '9px', fontWeight: 600 }}
                            tickFormatter={viewMode === 'growth' || viewMode === 'profitRate' ? formatPercent : formatMillions}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            formatter={tooltipFormatter}
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                padding: '10px'
                            }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />

                        {/* Sales & Daily Mode */}
                        {/* 데이터 종류별 8-pattern 매핑
                            sales/daily = 검정 계열, growth = 녹색 계열, profitRate = 분홍 계열
                            시리즈 순서: 1=총매출(메인 진함 실선), 2=이커머스(진함 점선), 3=오프라인(중간 실선)
                        */}
                        {(() => {
                            const palette = viewMode === 'growth' ? ['#065f46', '#10b981', '#34d399', '#6ee7b7']
                                : viewMode === 'profitRate' ? ['#ff0066', '#ff3385', '#ff66a3', '#ff99c1']
                                : ['#000000', '#5d5d5d', '#7d7d7d', '#b8b8b8'];
                            const seriesStyle = (i: number) => ({
                                stroke: palette[Math.floor(i / 2)] || palette[palette.length - 1],
                                strokeDasharray: (i % 2 === 1) ? '4 4' : undefined,
                                strokeWidth: i === 0 ? 2.5 : 1.5,
                                dotR: i === 0 ? 4 : 3,
                                activeR: i === 0 ? 6 : 5,
                            });
                            // 시리즈 정의 — 순서: 총매출(1) / 이커머스(2) / 오프라인(3)
                            const seriesDefs = viewMode === 'profitRate'
                                ? [
                                    { idx: 0, key: 'totalRate', name: '전체 이익률', channel: 'total' },
                                    { idx: 1, key: 'ecommerceRate', name: '이커머스 이익률', channel: 'ecommerce' },
                                    { idx: 2, key: 'offlineRate', name: '오프라인 이익률', channel: 'offline' },
                                ]
                                : viewMode === 'growth'
                                ? [
                                    { idx: 0, key: '총매출', name: '전체 증감율', channel: 'total' },
                                    { idx: 1, key: '이커머스', name: '이커머스 증감율', channel: 'ecommerce' },
                                    { idx: 2, key: '오프라인', name: '오프라인 증감율', channel: 'offline' },
                                ]
                                : [
                                    { idx: 0, key: '총매출', name: '전체 합계', channel: 'total' },
                                    { idx: 1, key: '이커머스', name: '이커머스', channel: 'ecommerce' },
                                    { idx: 2, key: '오프라인', name: '오프라인', channel: 'offline' },
                                ];
                            return seriesDefs
                                .filter(s => channelFilter === 'all' || channelFilter === s.channel)
                                .map(s => {
                                    const style = seriesStyle(s.idx);
                                    const showLabel = viewMode !== 'sales' && viewMode !== 'daily';
                                    const lastIdx = chartData.length - 1;
                                    return (
                                        <Line
                                            key={s.key}
                                            type="monotone"
                                            dataKey={s.key}
                                            name={s.name}
                                            stroke={style.stroke}
                                            strokeWidth={style.strokeWidth}
                                            strokeDasharray={style.strokeDasharray}
                                            dot={{ r: style.dotR, fill: style.stroke }}
                                            activeDot={{ r: style.activeR }}
                                            animationDuration={1500}
                                            animationEasing="ease-out"
                                        >
                                            {showLabel && (
                                                <LabelList
                                                    dataKey={s.key}
                                                    position="top"
                                                    content={(p: any) => {
                                                        const { x, y, value, index } = p;
                                                        if (index !== lastIdx) return null;
                                                        if (value === undefined || value === null) return null;
                                                        return (
                                                            <text
                                                                x={x}
                                                                y={y}
                                                                dy={-8}
                                                                fill={style.stroke}
                                                                fontSize={10}
                                                                textAnchor="middle"
                                                                fontWeight={s.idx === 0 ? 'bold' : 'normal'}
                                                            >
                                                                {yAxisFormatter(value)}
                                                            </text>
                                                        );
                                                    }}
                                                />
                                            )}
                                        </Line>
                                    );
                                });
                        })()}
                    </ComposedChart>
                </ResponsiveContainer>
                </div>

                {/* Debug Info Section - Only visible in development */}
                {process.env.NODE_ENV === 'development' && debugLogs.length > 0 && (
                    <details className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-600">
                        <summary className="cursor-pointer font-bold mb-2 select-none hover:text-slate-900">
                            Calculation Debug Info (Click to expand)
                        </summary>
                        <div className="max-h-60 overflow-y-auto whitespace-pre-wrap">
                            {debugLogs.map((log, i) => (
                                <div key={i} className="py-0.5 border-b border-slate-100 last:border-0">
                                    {log}
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
};

export default SalesChartNew;
