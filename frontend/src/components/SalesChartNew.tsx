'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
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
}

type ViewMode = 'sales' | 'growth' | 'daily';
type ChannelFilter = 'all' | 'total' | 'ecommerce' | 'offline';

const SalesChartNew: React.FC<SalesChartProps> = ({ filename }) => {
    const [data, setData] = useState<{
        months: string[];
        ecommerce: number[];
        offline: number[];
        total: number[];
    } | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('sales');
    const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [daysList, setDaysList] = useState<number[]>([]);

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
                setData(response.data);
                setDaysList(response.data.days_list || []);
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

        const transformedData = data.months.map((month, index) => {
            // 원본 데이터가 없는 경우 0 처리
            const ecommerce = data.ecommerce[index] || 0;
            const offline = data.offline[index] || 0;
            const total = data.total[index] || 0;

            // 일수 정보가 없으면 30일로 가정 (예외 처리)
            const days = daysList[index] || 30;

            let ecommerceVal = ecommerce;
            let offlineVal = offline;
            let totalVal = total;

            if (viewMode === 'growth') {
                const prevEcommerce = index > 0 ? data.ecommerce[index - 1] : 0;
                const prevOffline = index > 0 ? data.offline[index - 1] : 0;
                const prevTotal = index > 0 ? data.total[index - 1] : 0;

                ecommerceVal = calculateGrowth(ecommerce, prevEcommerce);
                offlineVal = calculateGrowth(offline, prevOffline);
                totalVal = calculateGrowth(total, prevTotal);
            } else if (viewMode === 'daily') {
                ecommerceVal = ecommerce / days;
                offlineVal = offline / days;
                totalVal = total / days;
            }

            return {
                month: formatMonth(month),
                이커머스: ecommerceVal,
                오프라인: offlineVal,
                총매출: totalVal // ChartData 인터페이스에 맞춰 '총매출' 사용 (기존에 정의됨)
            };
        });

        // 증감율 모드일 때는 첫 달 제외
        return transformedData.slice(viewMode === 'growth' ? 1 : 0);
    };

    if (!filename) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-4">📊 월별 매출 추이</h3>
                <div className="h-80 flex items-center justify-center text-gray-500">
                    파일을 업로드하거나 선택해주세요
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-4">📊 월별 매출 추이</h3>
                <div className="h-80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-4">📊 월별 매출 추이</h3>
                <div className="h-80 flex items-center justify-center text-red-500">
                    {error}
                </div>
            </div>
        );
    }

    const chartData = getChartData();
    const yAxisFormatter = viewMode === 'growth' ? formatPercent : formatMillions;
    const tooltipFormatter = (value: number) => {
        if (viewMode === 'growth') {
            return [formatPercent(value), ''];
        } else {
            return [formatCurrency(value) + (viewMode === 'daily' ? '' : '원'), ''];
        }
    };

    const chartTitle = viewMode === 'sales'
        ? '월별 매출 추이 (이커머스 vs 오프라인)'
        : viewMode === 'daily'
            ? '월별 일평균 매출 (이커머스 vs 오프라인)'
            : '월별 매출 증감율 (전월 대비)';

    const yAxisLabel = viewMode === 'sales' ? '매출 (백만원)' : viewMode === 'daily' ? '일평균 매출 (백만원)' : '증감율 (%)';

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">📊 {chartTitle}</h3>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => setViewMode('sales')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'sales'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        매출액
                    </button>
                    <button
                        onClick={() => setViewMode('daily')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'daily'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        일평균 (New)
                    </button>
                    <button
                        onClick={() => setViewMode('growth')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'growth'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        증감율
                    </button>
                    <select
                        value={channelFilter}
                        onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">전체</option>
                        <option value="total">총매출</option>
                        <option value="ecommerce">이커머스</option>
                        <option value="offline">오프라인</option>
                    </select>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="month"
                        stroke="#666"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="#666"
                        style={{ fontSize: '12px' }}
                        tickFormatter={yAxisFormatter}
                        label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: '#666' } }}
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
                    <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="line"
                    />
                    {(channelFilter === 'all' || channelFilter === 'ecommerce') && (
                        <Line
                            type="monotone"
                            dataKey="이커머스"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', r: 4 }}
                            activeDot={{ r: 6 }}
                            label={{
                                position: 'top',
                                formatter: yAxisFormatter,
                                style: { fontSize: '10px', fill: '#3b82f6', fontWeight: 'bold' }
                            }}
                        />
                    )}
                    {(channelFilter === 'all' || channelFilter === 'offline') && (
                        <Line
                            type="monotone"
                            dataKey="오프라인"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ fill: '#10b981', r: 4 }}
                            activeDot={{ r: 6 }}
                            label={{
                                position: 'bottom',
                                formatter: yAxisFormatter,
                                style: { fontSize: '10px', fill: '#10b981', fontWeight: 'bold' }
                            }}
                        />
                    )}
                    {(channelFilter === 'all' || channelFilter === 'total') && (
                        <Line
                            type="monotone"
                            dataKey="총매출"
                            stroke="#f59e0b"
                            strokeWidth={4}
                            strokeDasharray="5 5"
                            dot={{ fill: '#f59e0b', r: 5 }}
                            activeDot={{ r: 7 }}
                            label={{
                                position: 'top',
                                formatter: yAxisFormatter,
                                style: { fontSize: '11px', fill: '#f59e0b', fontWeight: 'bold' }
                            }}
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SalesChartNew;
