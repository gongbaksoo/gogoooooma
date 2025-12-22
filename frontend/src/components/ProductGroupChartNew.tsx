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
    [key: string]: number | string | undefined; // 동적 품목그룹 데이터
    rawMonth?: string;
    days?: number;
}


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

type ViewMode = 'sales' | 'growth' | 'daily' | 'profitRate';

const ProductGroupChartNew: React.FC<ProductGroupChartProps> = ({ filename }) => {
    const [data, setData] = useState<ChartData[]>([]);
    const [groups, setGroups] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('sales');
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [daysList, setDaysList] = useState<number[]>([]);

    // Date Range Filter State
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');

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
                const profitGroupsData = response.data.profit_groups || {};
                const groupNames = Object.keys(groupsData);
                setDaysList(response.data.days_list || []);

                // Transform data for chart
                const chartData: ChartData[] = months.map((month: string, index: number) => {
                    const dataPoint: ChartData = {
                        month: formatMonth(month),
                        rawMonth: month,
                        days: response.data.days_list ? response.data.days_list[index] : 30
                    };

                    // Add each group's data (Sales and Profit)
                    groupNames.forEach((group: string) => {
                        dataPoint[group] = groupsData[group][index];
                        dataPoint[`${group}_profit`] = profitGroupsData[group] ? profitGroupsData[group][index] : 0;
                    });

                    // Add combined data for 마이비+누비+쏭레브
                    const combinedSales =
                        (groupsData['마이비']?.[index] || 0) +
                        (groupsData['누비']?.[index] || 0) +
                        (groupsData['쏭레브']?.[index] || 0);

                    const combinedProfit =
                        (profitGroupsData['마이비']?.[index] || 0) +
                        (profitGroupsData['누비']?.[index] || 0) +
                        (profitGroupsData['쏭레브']?.[index] || 0);

                    dataPoint['마이비+누비+쏭레브'] = combinedSales;
                    dataPoint['마이비+누비+쏭레브_profit'] = combinedProfit;

                    return dataPoint;
                });

                setData(chartData);

                // Initialize Date Range
                if (months.length > 0) {
                    setStartMonth(months[0]);
                    setEndMonth(months[months.length - 1]);
                }

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
        // Filter by Date Range
        const filteredData = data.filter(item => {
            if (!item.rawMonth) return true;
            if (startMonth && item.rawMonth < startMonth) return false;
            if (endMonth && item.rawMonth > endMonth) return false;
            return true;
        });

        if (viewMode === 'sales') {
            return filteredData;
        }

        if (viewMode === 'profitRate') {
            return filteredData.map(item => {
                const rateData: ChartData = { month: item.month, rawMonth: item.rawMonth };
                groups.forEach(group => {
                    const sales = (item[group] as number) || 0;
                    const profit = (item[`${group}_profit`] as number) || 0;
                    const rate = sales === 0 ? 0 : (profit / sales) * 100;
                    rateData[group] = rate;
                });
                return rateData;
            });
        }

        if (viewMode === 'daily') {
            return filteredData.map((item) => {
                const days = item.days || 30;
                const dailyData: ChartData = { month: item.month, days: days, rawMonth: item.rawMonth };

                Object.keys(item).forEach(key => {
                    if (key !== 'month' && key !== 'days' && key !== 'rawMonth' && !key.endsWith('_profit') && typeof item[key] === 'number') {
                        dailyData[key] = (item[key] as number) / days;
                    }
                });
                return dailyData;
            });
        }

        // Growth rate mode - exclude first month
        if (filteredData.length <= 1) return [];

        return filteredData.slice(1).map((item, index) => {
            const prevItem = filteredData[index];
            const growthData: ChartData = {
                month: item.month,
                rawMonth: item.rawMonth
            };

            groups.forEach((group) => {
                const current = item[group] as number || 0;
                const previous = prevItem[group] as number || 0;
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
        if (viewMode === 'growth' || viewMode === 'profitRate') {
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
            : viewMode === 'profitRate'
                ? '📦 품목그룹별 월별 평균 이익률'
                : '📈 품목그룹별 월별 증감율 (전월 대비)';
    const yAxisLabel = viewMode === 'sales' ? '매출액' : viewMode === 'daily' ? '일평균 매출' : viewMode === 'profitRate' ? '이익률 (%)' : '증감율 (%)';

    return (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-4 md:p-8 border border-slate-100 transition-all hover:shadow-2xl hover:shadow-slate-200/60 mt-12 last:mb-12">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                        📦 품목그룹별 월별 매출
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 font-medium">Performance by brand group</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    {/* Date Range Selectors */}
                    {data.length > 0 && (
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 w-full sm:w-auto justify-between">
                            <select
                                value={startMonth}
                                onChange={(e) => setStartMonth(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none p-1.5"
                            >
                                {data.map(d => (
                                    <option key={`start-${d.rawMonth}`} value={d.rawMonth}>{d.month}</option>
                                ))}
                            </select>
                            <span className="text-slate-300">~</span>
                            <select
                                value={endMonth}
                                onChange={(e) => setEndMonth(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none p-1.5"
                            >
                                {data.map(d => (
                                    <option key={`end-${d.rawMonth}`} value={d.rawMonth}>{d.month}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button
                        onClick={() => setViewMode('sales')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'sales'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        매출액
                    </button>
                    <button
                        onClick={() => setViewMode('daily')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'daily'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        일평균
                    </button>
                    <button
                        onClick={() => setViewMode('profitRate')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'profitRate'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        이익률
                    </button>
                    <button
                        onClick={() => setViewMode('growth')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'growth'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
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
                        className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all focus:outline-none shadow-sm grow sm:grow-0"
                    >
                        <option value="all">전체 브랜드</option>
                        <option value="combined">주요 3사 합계</option>
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
                        stroke="#94a3b8"
                        style={{ fontSize: '10px', fontWeight: 500 }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis
                        stroke="#94a3b8"
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
