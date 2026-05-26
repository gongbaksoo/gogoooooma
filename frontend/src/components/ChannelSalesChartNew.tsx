'use client';

import React, { useEffect, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { loadDashboardDate, saveDashboardDate } from '@/lib/dashboardDateStorage';

const CHART_ID = 'channel';

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
    const { x, y, value, fill, formatter, index, lastIndex } = props;
    if (value === undefined || value === null) return null;
    if (typeof lastIndex === 'number' && index !== lastIndex) return null;
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
    const [viewMode, setViewMode] = useState<ViewMode>('sales');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Time unit state
    const [timeUnit, setTimeUnit] = useState<'month' | 'day'>('month');

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
            const endpoint = timeUnit === 'month'
                ? `${API_BASE_URL}/api/dashboard/channel-sales`
                : `${API_BASE_URL}/api/dashboard/daily-hierarchical-sales`;

            const response = await axios.get(endpoint, {
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

            let months: string[] = [];
            let sales: number[] = [];
            let profit: number[] = [];
            let days: number[] = [];

            if (timeUnit === 'month') {
                months = (response.data.months || []).map(String);
                sales = response.data.sales;
                profit = response.data.profit || [];
                days = response.data.days_list || [];
            } else {
                months = response.data.dates;
                sales = response.data.sales;
                profit = response.data.profit || [];
                days = new Array(sales.length).fill(1);
            }

            setDaysList(days);
            setCurrentLabel(response.data.label);

            // Transform data for chart
            const chartData: ChartData[] = months.map((month: string, index: number) => {
                const value = sales[index] || 0;
                const profitValue = profit[index] || 0;
                return {
                    month: timeUnit === 'month' ? formatMonth(month) : month,
                    value,
                    profit: profitValue,
                    rawMonth: month,
                    days: days[index] || (timeUnit === 'month' ? 30 : 1)
                };
            });

            // Initialize Date Range
            if (months.length > 0 && !startMonth && timeUnit === 'month') {
                // 월 모드: 저장된 기간이 유효하면 복원, 아니면 전체 범위
                const saved = await loadDashboardDate(CHART_ID);
                if (saved && months.includes(saved.start) && months.includes(saved.end) && saved.start <= saved.end) {
                    setStartMonth(saved.start);
                    setEndMonth(saved.end);
                } else {
                    setStartMonth(months[0]);
                    setEndMonth(months[months.length - 1]);
                }
            } else if (timeUnit === 'day' && !startMonth) {
                const uniqueMonths = Array.from(new Set(months.map(d => d.substring(0, 7).replace('-', ''))));
                if (uniqueMonths.length > 0) {
                    setStartMonth(uniqueMonths[0]);
                    setEndMonth(uniqueMonths[uniqueMonths.length - 1]);
                }
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

    // Refetch when timeUnit changes
    useEffect(() => {
        // Reset Date Filters when switching time unit
        setStartMonth('');
        setEndMonth('');

        if (filename && selectedPart) {
            fetchData();
        }
    }, [timeUnit]);

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
        if (timeUnit === 'day') {
            if (month.length >= 10) {
                return month.substring(5).replace('-', '.');
            }
            return month;
        }

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
        if (timeUnit === 'day') {
            if (!value) return value;
            const dateParts = value.split('-');
            if (dateParts.length === 3) {
                const [yyyy, mm, dd] = dateParts;
                if (dd !== '01') return '';
                return `${yyyy.slice(2)}/${parseInt(mm)}`;
            }
            return value;
        }

        if (!value || value.length !== 4) return value;
        const year = value.substring(0, 2);
        const month = parseInt(value.substring(2, 4));

        // 첫 번째 데이터이거나 1월인 경우에만 연도 표시 ("24'1" 형식 - 공백 제거)
        if (index === 0 || month === 1) {
            return `${year}'${month}`;
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

            let itemMonth = item.rawMonth;
            if (timeUnit === 'day') {
                // Extract "YYYYMM" from "YYYY-MM-DD"
                itemMonth = item.rawMonth.substring(0, 7).replace('-', '');
            }

            if (startMonth && itemMonth < startMonth) return false;
            if (endMonth && itemMonth > endMonth) return false;
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
        ? `${currentLabel} ${timeUnit === 'month' ? '월별' : '일별'} 매출 추이`
        : viewMode === 'daily'
            ? `${currentLabel} ${timeUnit === 'month' ? '월별 일평균' : '일별'} 매출`
            : viewMode === 'profitRate'
                ? `${currentLabel} ${timeUnit === 'month' ? '월별' : '일별'} 평균 이익률`
                : viewMode === 'salesProfitRate'
                    ? `${currentLabel} 매출액 + 이익률 분석`
                    : viewMode === 'dailyProfitRate'
                        ? `${currentLabel} 일평균 + 이익률 분석`
                        : `${currentLabel} ${timeUnit === 'month' ? '월별' : '일별'} 증감율 (전기 대비)`;

    const yAxisLabel = isCombination
        ? (viewMode === 'salesProfitRate' ? '매출액' : '일평균 매출')
        : (viewMode === 'sales' ? '매출액' : viewMode === 'daily' ? '일평균 매출' : viewMode === 'profitRate' ? '이익률 (%)' : '증감율 (%)');

    // YAxis formatter selection
    const yAxisFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? formatPercent : formatMillions;

    // Label formatter selection
    const labelFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? (val: any) => typeof val === 'number' ? val.toFixed(1) + '%' : String(val) : formatMillions;

    return (
        <div className="bg-white p-4 md:p-8 border border-[#c4c4c4] mt-12">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                        채널별 매출 상세 분석
                    </h3>
                    <p className="text-[#5d5d5d] text-sm mt-1 font-normal">{currentLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                    {/* Time Unit Toggle */}
                    <div className="flex border border-[#c4c4c4] rounded mr-2">
                        <button
                            onClick={() => setTimeUnit('month')}
                            className={`px-3 py-1.5 text-xs font-bold transition-colors ${timeUnit === 'month'
                                ? 'bg-black text-white'
                                : 'text-[#5d5d5d] hover:text-black'
                                }`}
                        >
                            월간
                        </button>
                        <button
                            onClick={() => setTimeUnit('day')}
                            className={`px-3 py-1.5 text-xs font-bold transition-colors ${timeUnit === 'day'
                                ? 'bg-black text-white'
                                : 'text-[#5d5d5d] hover:text-black'
                                }`}
                        >
                            일간
                        </button>
                    </div>

                    {/* Date Range Selectors */}
                    {data.length > 0 && (
                        <div className="flex items-center gap-1 bg-white p-1 rounded border border-[#c4c4c4] w-full sm:w-auto justify-between">
                            <select
                                value={startMonth}
                                onChange={(e) => { setStartMonth(e.target.value); if (timeUnit === 'month') saveDashboardDate(CHART_ID, e.target.value, endMonth); }}
                                className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none p-1.5"
                            >
                                {timeUnit === 'month'
                                    ? data.map(d => (
                                        <option key={`start-${d.rawMonth}`} value={d.rawMonth}>{d.month}</option>
                                    ))
                                    : Array.from(new Set(data.map(d => {
                                        const m = d.rawMonth?.substring(0, 7).replace('-', '');
                                        return m;
                                    }))).sort().map(m => {
                                        if (!m) return null;
                                        const year = m.substring(0, 4);
                                        const month = parseInt(m.substring(4, 6));
                                        return <option key={`start-${m}`} value={m}>{`${year}년 ${month}월`}</option>
                                    })
                                }
                            </select>
                            <span className="text-slate-300">~</span>
                            <select
                                value={endMonth}
                                onChange={(e) => { setEndMonth(e.target.value); if (timeUnit === 'month') saveDashboardDate(CHART_ID, startMonth, e.target.value); }}
                                className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none p-1.5"
                            >
                                {timeUnit === 'month'
                                    ? data.map(d => (
                                        <option key={`end-${d.rawMonth}`} value={d.rawMonth}>{d.month}</option>
                                    ))
                                    : Array.from(new Set(data.map(d => {
                                        const m = d.rawMonth?.substring(0, 7).replace('-', '');
                                        return m;
                                    }))).sort().map(m => {
                                        if (!m) return null;
                                        const year = m.substring(0, 4);
                                        const month = parseInt(m.substring(4, 6));
                                        return <option key={`end-${m}`} value={m}>{`${year}년 ${month}월`}</option>
                                    })
                                }
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
                    <div className="h-10 w-px bg-slate-200 mx-1 hidden sm:block" />
                    <button
                        onClick={() => setViewMode('salesProfitRate')}
                        className={`px-4 py-2.5 rounded text-xs font-bold transition-colors border grow sm:grow-0 ${viewMode === 'salesProfitRate'
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-[#c4c4c4] hover:border-black'
                            }`}
                    >
                        매출+이익률
                    </button>
                    <button
                        onClick={() => setViewMode('dailyProfitRate')}
                        className={`px-4 py-2.5 rounded text-xs font-bold transition-colors border grow sm:grow-0 ${viewMode === 'dailyProfitRate'
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-[#c4c4c4] hover:border-black'
                            }`}
                    >
                        일평균+이익률
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-4 mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-white rounded border border-[#c4c4c4]">
                    {/* Left: Channel Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 파트구분 Select */}
                        <select
                            value={selectedPart}
                            onChange={(e) => handlePartChange(e.target.value)}
                            className="px-3 py-2 rounded text-[11px] font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black"
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
                            className="px-3 py-2 rounded text-[11px] font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black"
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
                            className="px-3 py-2 rounded text-[11px] font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black"
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
                            className="px-3 py-2 rounded text-[11px] font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black"
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
                            className="px-3 py-2 rounded text-[11px] font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black"
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
                            className="px-3 py-2 rounded text-[11px] font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black"
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
                        className="bg-black hover:bg-[#222] text-white px-8 py-3 rounded-sm flex items-center gap-2 text-sm font-bold transition-colors active:scale-95 disabled:opacity-50"
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
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent"></div>
                </div>
            ) : error ? (
                <div className="h-80 flex items-center justify-center text-red-500">
                    {error}
                </div>
            ) : (
                <>
                    <h4 className="text-md font-semibold text-gray-600 mb-2 text-center">{chartTitle}</h4>
                    <div key={`${viewMode}-${timeUnit}-${selectedChannel}`}>
                    <ResponsiveContainer width="100%" height={400}>
                        <ComposedChart data={displayData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                                yAxisId="left"
                                stroke="#5d5d5d"
                                style={{ fontSize: '9px', fontWeight: 600 }}
                                tickFormatter={yAxisFormatter}
                                axisLine={false}
                                tickLine={false}
                            />
                            {isCombination && (
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#ff0066"
                                    style={{ fontSize: '9px', fontWeight: 600 }}
                                    tickFormatter={formatPercent}
                                    axisLine={false}
                                    tickLine={false}
                                />
                            )}
                            <Tooltip
                                formatter={(value: any, name: any, props: any) => {
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
                                    border: '1px solid #c4c4c4',
                                    borderRadius: '2px',
                                    padding: '10px', fontSize: 12
                                }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            {(() => {
                                // 데이터 종류별 베이스 색 (메인 라인의 1단계 진함)
                                const mainColor = viewMode === 'profitRate' ? '#ff0066'
                                    : viewMode === 'growth' ? '#065f46'
                                    : '#000000'; // sales/daily/salesProfitRate/dailyProfitRate

                                return (
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey={viewMode === 'growth' ? "growth" : "value"}
                                        name={viewMode === 'growth' ? "증감율" : (viewMode === 'daily' || viewMode === 'dailyProfitRate' ? "일평균 매출" : "매출액")}
                                        stroke={mainColor}
                                        strokeWidth={2}
                                        dot={timeUnit === 'day' ? false : { fill: mainColor, r: 1.5 }}
                                        activeDot={{ r: 3.5 }}
                                        animationDuration={1500}
                                        animationEasing="ease-out"
                                    >
                                        <LabelList
                                            dataKey={viewMode === 'growth' ? "growth" : "value"}
                                            content={
                                                <CustomLabel
                                                    fill={mainColor}
                                                    formatter={labelFormatter}
                                                    lastIndex={displayData.length - 1}
                                                />
                                            }
                                        />
                                    </Line>
                                );
                            })()}
                            {isCombination && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="profitRate"
                                    name="이익률"
                                    stroke="#ff0066"
                                    strokeWidth={2}
                                    dot={timeUnit === 'day' ? false : { fill: "#ff0066", r: 1.5 }}
                                    activeDot={{ r: 3.5 }}
                                    animationDuration={1500}
                                    animationEasing="ease-out"
                                >
                                    <LabelList
                                        dataKey="profitRate"
                                        content={
                                            <CustomLabel
                                                fill="#ff0066"
                                                formatter={formatPercent}
                                                lastIndex={displayData.length - 1}
                                            />
                                        }
                                    />
                                </Line>
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                    </div>
                </>
            )}
        </div>
    );
};

export default ChannelSalesChartNew;
