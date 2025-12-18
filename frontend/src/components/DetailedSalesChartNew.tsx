'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface DetailedSalesChartProps {
    filename: string | null;
}

interface ChartData {
    month: string;
    value: number;
    profit?: number;
    profitRate?: number;
    rawMonth?: string; // Add rawMonth to ChartData for filtering
    days?: number; // Add days to ChartData for daily average calculation
    growth?: number; // Add growth to ChartData
}

type ViewMode = 'sales' | 'growth' | 'daily' | 'profitRate';

interface OptionsTree {
    [group: string]: {
        [category: string]: string[];
    };
}

const DetailedSalesChartNew: React.FC<DetailedSalesChartProps> = ({ filename }) => {
    const [data, setData] = useState<ChartData[]>([]);
    const [daysList, setDaysList] = useState<number[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('sales');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Date Range Filter State
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');

    // Filter states
    const [options, setOptions] = useState<OptionsTree>({});
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
    const [currentLabel, setCurrentLabel] = useState<string>('전체');

    // Load options on file change
    useEffect(() => {
        const fetchOptions = async () => {
            if (!filename) {
                setOptions({});
                return;
            }

            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/options`, {
                    params: { filename }
                });
                setOptions(response.data);

                // Set default to first group if available
                const groups = Object.keys(response.data);
                if (groups.length > 0) {
                    setSelectedGroup(groups[0]);
                }
            } catch (err) {
                console.error('Failed to fetch options:', err);
                setError('옵션 데이터를 불러오는데 실패했습니다');
            }
        };

        fetchOptions();
    }, [filename]);

    // Load sales data when filters change
    useEffect(() => {
        const fetchData = async () => {
            if (!filename || !selectedGroup) {
                setData([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/hierarchical-sales`, {
                    params: {
                        filename,
                        group: selectedGroup,
                        category: selectedCategory || 'all',
                        sub_category: selectedSubCategory || 'all'
                    }
                });

                const months = response.data.months;
                const sales = response.data.sales;
                const profit = response.data.profit || [];
                const days = response.data.days_list || [];
                setDaysList(days);

                setCurrentLabel(response.data.label);

                // Transform data for chart
                const chartData: ChartData[] = months.map((month: string, index: number) => {
                    const value = sales[index] || 0;
                    const profitValue = profit[index] || 0;
                    return {
                        month: formatMonth(month),
                        value,
                        profit: profitValue,
                        rawMonth: month,
                        days: days[index] || 30
                    };
                });

                // Initialize Date Range
                if (months.length > 0) {
                    setStartMonth(months[0]);
                    setEndMonth(months[months.length - 1]);
                }

                // Calculate growth rates
                const chartDataWithGrowth = chartData.map((item, index) => {
                    if (index === 0) return { ...item, growth: 0 };
                    const prevValue = chartData[index - 1].value;
                    const growth = prevValue === 0 ? 0 : ((item.value - prevValue) / prevValue) * 100;
                    return { ...item, growth };
                });

                setData(chartDataWithGrowth);
            } catch (err) {
                console.error('Failed to fetch hierarchical sales data:', err);
                setError('데이터를 불러오는데 실패했습니다');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [filename, selectedGroup, selectedCategory, selectedSubCategory]);

    // Reset child filters when parent changes
    const handleGroupChange = (group: string) => {
        setSelectedGroup(group);
        setSelectedCategory('');
        setSelectedSubCategory('');
    };

    const handleCategoryChange = (category: string) => {
        setSelectedCategory(category);
        setSelectedSubCategory('');
    };

    const formatMonth = (month: string): string => {
        if (month.length === 4) {
            const year = month.substring(0, 2);
            const monthNum = parseInt(month.substring(2, 4));
            return `${year}년 ${monthNum}월`;
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

    const formatPercent = (value: any): string => {
        if (typeof value !== 'number') return String(value);
        return `${value.toFixed(1)}%`;
    };

    if (!filename) {
        return null; // Or placeholder
    }

    const availableCategories = selectedGroup && options[selectedGroup] ? Object.keys(options[selectedGroup]) : [];
    const availableSubCategories = selectedGroup && selectedCategory && options[selectedGroup][selectedCategory]
        ? options[selectedGroup][selectedCategory]
        : [];

    const getDisplayData = () => {
        // Filter by Date Range
        const filteredData = data.filter(item => {
            if (!item.rawMonth) return true;
            if (startMonth && item.rawMonth < startMonth) return false;
            if (endMonth && item.rawMonth > endMonth) return false;
            return true;
        });

        if (viewMode === 'sales') return filteredData;
        if (viewMode === 'growth') return filteredData.slice(1);
        if (viewMode === 'daily') {
            return filteredData.map(item => {
                const days = item.days || 30;
                return {
                    ...item,
                    value: item.value / days,
                    days: days
                };
            });
        }

        if (viewMode === 'profitRate') {
            return filteredData.map(item => {
                const sales = item.value || 0;
                const profit = item.profit || 0;
                const rate = sales === 0 ? 0 : (profit / sales) * 100;
                return {
                    ...item,
                    value: rate,
                    profitRate: rate
                };
            });
        }

        return filteredData;
    };

    const displayData = getDisplayData();
    const chartTitle = viewMode === 'sales'
        ? `🔍 ${currentLabel} 월별 매출 추이`
        : viewMode === 'daily'
            ? `🔍 ${currentLabel} 월별 일평균 매출`
            : viewMode === 'profitRate'
                ? `🔍 ${currentLabel} 월별 평균 이익률`
                : `📈 ${currentLabel} 월별 증감율 (전월 대비)`;
    const yAxisLabel = viewMode === 'sales' ? '매출액' : viewMode === 'daily' ? '일평균 매출' : viewMode === 'profitRate' ? '이익률 (%)' : '증감율 (%)';

    // YAxis formatter selection
    const yAxisFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? formatPercent : formatMillions;

    // Label formatter selection
    const labelFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? (val: any) => typeof val === 'number' ? val.toFixed(1) + '%' : String(val) : formatMillions;

    const tooltipFormatter = (value: number, name: string, props: any) => {
        if (viewMode === 'growth' || viewMode === 'profitRate') {
            return [value.toFixed(1) + '%', name];
        }
        const days = props.payload.days;
        const suffix = viewMode === 'daily' ? ` (기준: ${days}일)` : '';
        return [formatMillions(value) + (viewMode === 'daily' ? '' : '원'), name + suffix];
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-700">🔍 상세 품목 매출 분석</h3>
                    <div className="flex gap-2">
                        {/* Date Range Selectors */}
                        {data.length > 0 && (
                            <div className="flex items-center gap-1 mr-4 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                <select
                                    value={startMonth}
                                    onChange={(e) => setStartMonth(e.target.value)}
                                    className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none p-1"
                                >
                                    {data.map(d => (
                                        <option key={`start-${d.rawMonth}`} value={d.rawMonth}>{d.month}</option>
                                    ))}
                                </select>
                                <span className="text-gray-400">~</span>
                                <select
                                    value={endMonth}
                                    onChange={(e) => setEndMonth(e.target.value)}
                                    className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none p-1"
                                >
                                    {data.map(d => (
                                        <option key={`end-${d.rawMonth}`} value={d.rawMonth}>{d.month}</option>
                                    ))}
                                </select>
                            </div>
                        )}
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
                            일평균
                        </button>
                        <button
                            onClick={() => setViewMode('profitRate')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'profitRate'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            이익률
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
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {/* 품목그룹 Select */}
                    <select
                        value={selectedGroup}
                        onChange={(e) => handleGroupChange(e.target.value)}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                    >
                        <option value="" disabled>품목그룹 선택</option>
                        {Object.keys(options).map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>

                    {/* 품목 구분 Select */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                        disabled={!selectedGroup}
                    >
                        <option value="">전체 (품목 구분)</option>
                        {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    {/* 품목 구분_2 Select */}
                    <select
                        value={selectedSubCategory}
                        onChange={(e) => setSelectedSubCategory(e.target.value)}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                        disabled={!selectedCategory}
                    >
                        <option value="">전체 (세부 구분)</option>
                        {availableSubCategories.map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="h-80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : error ? (
                <div className="h-80 flex items-center justify-center text-red-500">
                    {error}
                </div>
            ) : (
                <>
                    <h4 className="text-md font-semibold text-gray-600 mb-2 text-center">{chartTitle}</h4>
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={displayData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                                formatter={(value: number, name: string, props: any) => {
                                    if (viewMode === 'sales') return [formatMillions(value), '매출액'];
                                    if (viewMode === 'daily') {
                                        const days = props.payload.days;
                                        return [formatMillions(value), `일평균 매출 (기준: ${days}일)`];
                                    }
                                    return [value.toFixed(1) + '%', '증감율'];
                                }}
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    padding: '10px'
                                }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Line
                                type="monotone"
                                dataKey={viewMode === 'growth' ? "growth" : "value"}
                                name={currentLabel}
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                dot={{ fill: "#8b5cf6", r: 4 }}
                                activeDot={{ r: 6 }}
                                label={{
                                    position: 'top',
                                    formatter: labelFormatter,
                                    style: { fontSize: '10px', fill: '#8b5cf6', fontWeight: 'bold' }
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </>
            )}
        </div>
    );
};

export default DetailedSalesChartNew;
