'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface ProductGroupChartProps {
    filename: string | null;
}

interface ChartData {
    month: string;
    [key: string]: number | string; // 동적 품목그룹 데이터
}

type ViewMode = 'sales' | 'growth';

const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
    '#84cc16', // lime
];

const ProductGroupChartNew: React.FC<ProductGroupChartProps> = ({ filename }) => {
    const [data, setData] = useState<ChartData[]>([]);
    const [groups, setGroups] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode | 'daily'>('sales');
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [daysList, setDaysList] = useState<number[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!filename) {
                setData([]);
                setGroups([]);
                setSelectedGroups([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/product-group-sales`, {
                    params: { filename }
                });

                const months = response.data.months;
                const groupsData = response.data.groups;
                const groupNames = Object.keys(groupsData);
                setDaysList(response.data.days_list || []);

                // Transform data for chart
                const chartData: ChartData[] = months.map((month: string, index: number) => {
                    const dataPoint: ChartData = {
                        month: formatMonth(month)
                    };

                    // Add each group's data
                    groupNames.forEach((group: string) => {
                        dataPoint[group] = groupsData[group][index];
                    });

                    // Add combined data for 마이비+누비+쏭레브
                    const combinedValue =
                        (groupsData['마이비']?.[index] || 0) +
                        (groupsData['누비']?.[index] || 0) +
                        (groupsData['쏭레브']?.[index] || 0);
                    dataPoint['마이비+누비+쏭레브'] = combinedValue;

                    return dataPoint;
                });

                setData(chartData);
                // Add combined group to the list
                setGroups([...groupNames, '마이비+누비+쏭레브']);
                setSelectedGroups([...groupNames, '마이비+누비+쏭레브']); // 초기에는 모든 그룹 선택
            } catch (err) {
                console.error('Failed to fetch product group sales data:', err);
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

    const formatCurrency = (value: number): string => {
        return value.toLocaleString();
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

    const formatPercent = (value: any): string => {
        if (typeof value !== 'number') return String(value);
        return `${value.toFixed(1)}%`;
    };

    const calculateGrowthRate = (current: number, previous: number): number => {
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    };

    const getChartData = (): ChartData[] => {
        if (viewMode === 'sales') {
            return data;
        }

        if (viewMode === 'daily') {
            return data.map((item, index) => {
                const days = daysList[index] || 30;
                const dailyData: ChartData = { month: item.month, days: days };

                Object.keys(item).forEach(key => {
                    if (key !== 'month' && typeof item[key] === 'number') {
                        dailyData[key] = (item[key] as number) / days;
                    }
                });
                return dailyData;
            });
        }

        // Growth rate mode - exclude first month
        if (data.length <= 1) return [];

        return data.slice(1).map((item, index) => {
            const prevItem = data[index];
            const growthData: ChartData = {
                month: item.month
            };

            groups.forEach((group) => {
                const current = item[group] as number;
                const previous = prevItem[group] as number;
                growthData[group] = calculateGrowthRate(current, previous);
            });

            return growthData;
        });
    };

    const toggleGroup = (group: string) => {
        setSelectedGroups(prev =>
            prev.includes(group)
                ? prev.filter(g => g !== group)
                : [...prev, group]
        );
    };

    const toggleAllGroups = () => {
        if (selectedGroups.length === groups.length) {
            setSelectedGroups([]);
        } else {
            setSelectedGroups(groups);
        }
    };

    if (!filename) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-4">📦 품목그룹별 월별 매출</h3>
                <div className="h-80 flex items-center justify-center text-gray-500">
                    파일을 업로드하거나 선택해주세요
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-4">📦 품목그룹별 월별 매출</h3>
                <div className="h-80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-4">📦 품목그룹별 월별 매출</h3>
                <div className="h-80 flex items-center justify-center text-red-500">
                    {error}
                </div>
            </div>
        );
    }

    const chartData = getChartData();
    const tooltipFormatter = (value: number, name: string, props: any) => {
        if (viewMode === 'growth') {
            return [value.toFixed(1) + '%', ''];
        } else {
            const days = props.payload.days;
            const suffix = viewMode === 'daily' ? ` (기준: ${days}일)` : '';
            return [formatCurrency(value) + (viewMode === 'daily' ? '' : '원'), (name || '') + suffix];
        }
    };
    const chartTitle = viewMode === 'sales'
        ? '📦 품목그룹별 월별 매출 추이'
        : viewMode === 'daily'
            ? '📦 품목그룹별 월별 일평균 매출'
            : '📈 품목그룹별 월별 증감율 (전월 대비)';
    const yAxisLabel = viewMode === 'sales' ? '매출액' : viewMode === 'daily' ? '일평균 매출' : '증감율 (%)';

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
                        value={selectedGroups.length === groups.length ? 'all' : selectedGroups[0] || ''}
                        onChange={(e) => {
                            if (e.target.value === 'all') {
                                toggleAllGroups();
                            } else if (e.target.value === 'combined') {
                                setSelectedGroups(['마이비+누비+쏭레브']);
                            } else {
                                setSelectedGroups([e.target.value]);
                            }
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">전체 ({groups.length}개)</option>
                        <option value="combined">마이비+누비+쏭레브</option>
                        {groups.filter(g => g !== '마이비+누비+쏭레브').map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="month"
                        stroke="#666"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="#666"
                        style={{ fontSize: '12px' }}
                        tickFormatter={viewMode === 'growth' ? formatPercent : formatMillions}
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
                    {groups.map((group, index) => (
                        selectedGroups.includes(group) && (
                            <Line
                                key={group}
                                type="monotone"
                                dataKey={group}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={2}
                                dot={{ fill: COLORS[index % COLORS.length], r: 3 }}
                                activeDot={{ r: 5 }}
                                label={{
                                    position: 'top',
                                    formatter: viewMode === 'growth' ? formatPercent : formatMillions,
                                    style: { fontSize: '10px', fill: COLORS[index % COLORS.length], fontWeight: 'bold' }
                                }}
                            />
                        )
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ProductGroupChartNew;
