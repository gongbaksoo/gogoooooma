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

type ViewMode = 'sales' | 'growth';
type ChannelFilter = 'all' | 'total' | 'ecommerce' | 'offline';

const SalesChart: React.FC<SalesChartProps> = ({ filename }) => {
    const [data, setData] = useState<ChartData[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('sales');
    const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!filename) {
                setData([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/monthly-sales`, {
                    params: { filename }
                });

                // Transform data for chart
                const chartData: ChartData[] = response.data.months.map((month: string, index: number) => ({
                    month: formatMonth(month),
                    이커머스: response.data.ecommerce[index],
                    오프라인: response.data.offline[index],
                    총매출: response.data.total[index]
                }));

                setData(chartData);
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
        // Convert YYMM to readable format (e.g., "2511" -> "25년 11월")
        if (month.length === 4) {
            const year = month.substring(0, 2);
            const monthNum = parseInt(month.substring(2, 4)); // Remove leading zero
            return `${year}년 ${monthNum}월`;
        }
        return month;
    };

    const formatMillions = (value: any): string => {
        // Convert to 억 and format
        if (typeof value === 'number') {
            if (value >= 100000000) {
                return `${(value / 100000000).toFixed(1)}억`;
            } else if (value >= 10000) {
                return `${(value / 10000).toFixed(0)}만`;
            }
            return value.toLocaleString();
        }
        return String(value);
    };

    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('ko-KR').format(value);
    };

    const formatPercent = (value: any): string => {
        if (typeof value === 'number') {
            return value.toFixed(1) + '%';
        }
        return String(value);
    };

    const calculateGrowthRate = (current: number, previous: number): number => {
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    };

    const getChartData = (): ChartData[] => {
        if (viewMode === 'sales') {
            return data;
        }

        // Growth rate mode - exclude first month
        if (data.length <= 1) return [];

        return data.slice(1).map((item, index) => {
            const prevItem = data[index]; // index in original array is index+1, so prevItem is at index
            return {
                month: item.month,
                이커머스: calculateGrowthRate(item.이커머스, prevItem.이커머스),
                오프라인: calculateGrowthRate(item.오프라인, prevItem.오프라인),
                총매출: calculateGrowthRate(item.총매출, prevItem.총매출)
            };
        });
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
    const yAxisFormatter = viewMode === 'sales' ? formatMillions : formatPercent;
    const tooltipFormatter = viewMode === 'sales'
        ? (value: number) => [formatCurrency(value) + '원', '']
        : (value: number) => [value.toFixed(1) + '%', ''];
    const chartTitle = viewMode === 'sales'
        ? '📊 월별 매출 추이 (이커머스 vs 오프라인)'
        : '📈 월별 증감율 추이 (전월 대비)';
    const yAxisLabel = viewMode === 'sales' ? '매출 (백만원)' : '증감율 (%)';

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">{chartTitle}</h3>
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

export default SalesChart;
