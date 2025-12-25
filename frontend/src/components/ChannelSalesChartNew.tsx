'use client';

import React, { useEffect, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface ChannelSalesChartProps {
    filename: string | null;
}

interface ChartData {
    month: string;
    value: number;
    growth?: number;
    rawMonth?: string;
    days?: number;
    // Profit data
    profit?: number;
    profitRate?: number;
}

type ViewMode = 'sales' | 'growth' | 'daily' | 'profitRate' | 'salesProfitRate' | 'dailyProfitRate';

interface OptionsTree {
    [part: string]: {
        [channel: string]: string[];
    };
}

const CustomLabel = (props: any) => {
    const { x, y, value, fill, formatter } = props;
    if (value === undefined || value === null) return null;
    return (
        <text
            x={x}
            y={y}
            dy={-10}
            fill={fill}
            fontSize={10}
            textAnchor="middle"
            fontWeight="bold"
        >
            {formatter ? formatter(value) : value}
        </text>
    );
};

const ChannelSalesChartNew: React.FC<ChannelSalesChartProps> = ({ filename }) => {
    const [data, setData] = useState<ChartData[]>([]);
    const [daysList, setDaysList] = useState<number[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode | 'daily'>('sales');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Date Range Filter State
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');

    // Channel filter states
    const [options, setOptions] = useState<OptionsTree>({});
    const [selectedPart, setSelectedPart] = useState<string>('');
    const [selectedChannel, setSelectedChannel] = useState<string>('');
    const [selectedAccount, setSelectedAccount] = useState<string>('');

    // Product filter states
    const [productOptions, setProductOptions] = useState<OptionsTree>({});
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');

    const [currentLabel, setCurrentLabel] = useState<string>('전체 채널');

    // Load options on file change
    useEffect(() => {
        const fetchAllOptions = async () => {
            if (!filename) {
                setOptions({});
                setProductOptions({});
                return;
            }

            try {
                // Fetch channel options
                const channelResponse = await axios.get(`${API_BASE_URL}/api/dashboard/channel-options`, {
                    params: { filename }
                });
                setOptions(channelResponse.data);

                // Fetch product options
                const prodResponse = await axios.get(`${API_BASE_URL}/api/dashboard/options`, {
                    params: { filename }
                });
                setProductOptions(prodResponse.data);

                // Set default to first part if available
                const parts = Object.keys(channelResponse.data);
                if (parts.length > 0) {
                    setSelectedPart(parts[0]);
                }
            } catch (err) {
                console.error('Failed to fetch options:', err);
                setError('옵션 데이터를 불러오는데 실패했습니다');
            }
        };

        fetchAllOptions();
    }, [filename]);

    const fetchData = async () => {
        if (!filename) return;

        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${API_BASE_URL}/api/dashboard/channel-sales`, {
                params: {
                    filename,
                    part: selectedPart || 'all',
                    channel: selectedChannel || 'all',
                    account: selectedAccount || 'all',
                    group: selectedGroup || 'all',
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
            if (months.length > 0 && !startMonth) {
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
            console.error('Failed to fetch channel sales data:', err);
            setError('데이터를 불러오는데 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    // Load initial data once selectedPart is set
    useEffect(() => {
        if (filename && selectedPart && !data.length) {
            fetchData();
        }
    }, [filename, selectedPart]);

    // Reset child filters when parent changes
    const handlePartChange = (part: string) => {
        setSelectedPart(part);
        setSelectedChannel('');
        setSelectedAccount('');
    };

    const handleChannelChange = (channel: string) => {
        setSelectedChannel(channel);
        setSelectedAccount('');
    };

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

    const formatXAxisTick = (value: string, index: number) => {
        if (!value || value.length !== 4) return value;
        const year = value.substring(0, 2);
        const month = parseInt(value.substring(2, 4));

        // 첫 번째 데이터이거나 1월인 경우에만 연도 표시 ("24' 1" 형식)
        if (index === 0 || month === 1) {
            return `${year}' ${month}`;
        }
        return `${month}`;
    };

    const formatPercent = (value: any): string => {
        if (typeof value !== 'number') return String(value);
        return `${value.toFixed(1)}%`;
    };

    if (!filename) {
        return null;
    }

    const availableChannels = selectedPart && options[selectedPart] ? Object.keys(options[selectedPart]) : [];
    const availableAccounts = selectedPart && selectedChannel && options[selectedPart][selectedChannel]
        ? options[selectedPart][selectedChannel]
        : [];

    const availableCategories = selectedGroup && productOptions[selectedGroup] ? Object.keys(productOptions[selectedGroup]) : [];
    const availableSubCategories = selectedGroup && selectedCategory && productOptions[selectedGroup][selectedCategory]
        ? productOptions[selectedGroup][selectedCategory]
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

        if (viewMode === 'salesProfitRate') {
            return filteredData.map(item => {
                const sales = item.value || 0;
                const profit = item.profit || 0;
                const rate = sales === 0 ? 0 : (profit / sales) * 100;
                return {
                    ...item,
                    value: sales,
                    profitRate: rate
                };
            });
        }

        if (viewMode === 'dailyProfitRate') {
            return filteredData.map(item => {
                const sales = item.value || 0;
                const profit = item.profit || 0;
                const days = item.days || 30;
                const dailyAvg = sales / days;
                const rate = sales === 0 ? 0 : (profit / sales) * 100;
                return {
                    ...item,
                    value: dailyAvg,
                    profitRate: rate
                };
            });
        }
        return filteredData;
    };

    const displayData = getDisplayData();
    const isCombination = viewMode === 'salesProfitRate' || viewMode === 'dailyProfitRate';

    const chartTitle = viewMode === 'sales'
        ? `🏢 ${currentLabel} 월별 매출 추이`
        : viewMode === 'daily'
            ? `🏢 ${currentLabel} 월별 일평균 매출`
            : viewMode === 'profitRate'
                ? `🏢 ${currentLabel} 월별 평균 이익률`
                : viewMode === 'salesProfitRate'
                    ? `💰 ${currentLabel} 매출액 + 이익률 분석`
                    : viewMode === 'dailyProfitRate'
                        ? `⏱️ ${currentLabel} 일평균 + 이익률 분석`
                        : `📈 ${currentLabel} 월별 증감율 (전월 대비)`;

    const yAxisLabel = isCombination
        ? (viewMode === 'salesProfitRate' ? '매출액' : '일평균 매출')
        : (viewMode === 'sales' ? '매출액' : viewMode === 'daily' ? '일평균 매출' : viewMode === 'profitRate' ? '이익률 (%)' : '증감율 (%)');

    // YAxis formatter selection
    const yAxisFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? formatPercent : formatMillions;

    // Label formatter selection
    const labelFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? (val: any) => typeof val === 'number' ? val.toFixed(1) + '%' : String(val) : formatMillions;

    return (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-4 md:p-8 border border-slate-100 transition-all hover:shadow-2xl hover:shadow-slate-200/60 mt-12">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                        🏢 채널별 매출 상세 분석
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 font-medium italic">{currentLabel}</p>
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
                            ? 'bg-blue-600 text-white shadow-blue-200'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        매출액
                    </button>
                    <button
                        onClick={() => setViewMode('daily')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'daily'
                            ? 'bg-blue-600 text-white shadow-blue-200'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        일평균
                    </button>
                    <button
                        onClick={() => setViewMode('profitRate')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'profitRate'
                            ? 'bg-blue-600 text-white shadow-blue-200'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        이익률
                    </button>
                    <button
                        onClick={() => setViewMode('growth')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'growth'
                            ? 'bg-blue-600 text-white shadow-blue-200'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        증감율
                    </button>
                    <div className="h-10 w-px bg-slate-200 mx-1 hidden sm:block" />
                    <button
                        onClick={() => setViewMode('salesProfitRate')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'salesProfitRate'
                            ? 'bg-emerald-600 text-white shadow-emerald-200'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        매출+이익률
                    </button>
                    <button
                        onClick={() => setViewMode('dailyProfitRate')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm grow sm:grow-0 ${viewMode === 'dailyProfitRate'
                            ? 'bg-emerald-600 text-white shadow-emerald-200'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        일평균+이익률
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-4 mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    {/* Left: Channel Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 파트구분 Select */}
                        <select
                            value={selectedPart}
                            onChange={(e) => handlePartChange(e.target.value)}
                            className="px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-200 bg-white text-slate-700 hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="">전체 (파트구분)</option>
                            {Object.keys(options).map((part) => (
                                <option key={part} value={part}>{part}</option>
                            ))}
                        </select>

                        {/* 채널구분 Select */}
                        <select
                            value={selectedChannel}
                            onChange={(e) => handleChannelChange(e.target.value)}
                            className="px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-200 bg-white text-slate-700 hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            disabled={!selectedPart}
                        >
                            <option value="">전체 (채널 구분)</option>
                            {availableChannels.map((channel) => (
                                <option key={channel} value={channel}>{channel}</option>
                            ))}
                        </select>

                        {/* 거래처명 Select */}
                        <select
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-200 bg-white text-slate-700 hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            disabled={!selectedChannel}
                        >
                            <option value="">전체 (거래처)</option>
                            {availableAccounts.map((account) => (
                                <option key={account} value={account}>{account}</option>
                            ))}
                        </select>
                    </div>

                    {/* Right: Product Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 품목그룹 Select */}
                        <select
                            value={selectedGroup}
                            onChange={(e) => handleGroupChange(e.target.value)}
                            className="px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-200 bg-white text-slate-700 hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="">전체 (브랜드)</option>
                            {Object.keys(productOptions).map((group) => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>

                        {/* 품목 구분 Select */}
                        <select
                            value={selectedCategory}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-200 bg-white text-slate-700 hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                            className="px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-200 bg-white text-slate-700 hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            disabled={!selectedCategory}
                        >
                            <option value="">전체 (세부 구분)</option>
                            {availableSubCategories.map((sub) => (
                                <option key={sub} value={sub}>{sub}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        )}
                        조회
                    </button>
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
                        <ComposedChart data={displayData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="rawMonth"
                                tickFormatter={formatXAxisTick}
                                stroke="#94a3b8"
                                style={{ fontSize: '10px', fontWeight: 500 }}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="#94a3b8"
                                style={{ fontSize: '9px', fontWeight: 600 }}
                                tickFormatter={yAxisFormatter}
                                axisLine={false}
                                tickLine={false}
                            />
                            {isCombination && (
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#ec4899"
                                    style={{ fontSize: '9px', fontWeight: 600 }}
                                    tickFormatter={formatPercent}
                                    axisLine={false}
                                    tickLine={false}
                                />
                            )}
                            <Tooltip
                                formatter={(value: number, name: string, props: any) => {
                                    if (name === '이익률') return [formatPercent(value), name];
                                    if (viewMode === 'sales' || viewMode === 'salesProfitRate') return [formatMillions(value) + '원', '매출액'];
                                    if (viewMode === 'daily' || viewMode === 'dailyProfitRate') {
                                        const days = props.payload.days;
                                        return [formatMillions(value) + '원', `일평균 매출 (기준: ${days}일)`];
                                    }
                                    if (viewMode === 'profitRate') return [formatPercent(value), '이익률'];
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
                                yAxisId="left"
                                type="monotone"
                                dataKey={viewMode === 'growth' ? "growth" : "value"}
                                name={viewMode === 'growth' ? "증감율" : (viewMode === 'daily' || viewMode === 'dailyProfitRate' ? "일평균 매출" : "매출액")}
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={{ fill: "#10b981", r: 4 }}
                                activeDot={{ r: 6 }}
                                isAnimationActive={false}
                            >
                                <LabelList
                                    dataKey={viewMode === 'growth' ? "growth" : "value"}
                                    content={
                                        <CustomLabel
                                            fill="#10b981"
                                            formatter={labelFormatter}
                                        />
                                    }
                                />
                            </Line>
                            {isCombination && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="profitRate"
                                    name="이익률"
                                    stroke="#ec4899"
                                    strokeWidth={3}
                                    dot={{ fill: "#ec4899", r: 4 }}
                                    activeDot={{ r: 6 }}
                                    isAnimationActive={false}
                                >
                                    <LabelList
                                        dataKey="profitRate"
                                        content={
                                            <CustomLabel
                                                fill="#ec4899"
                                                formatter={formatPercent}
                                            />
                                        }
                                    />
                                </Line>
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </>
            )}
        </div>
    );
};

export default ChannelSalesChartNew;
