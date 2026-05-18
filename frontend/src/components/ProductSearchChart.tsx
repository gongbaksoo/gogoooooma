'use client';

import React, { useEffect, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { Search } from 'lucide-react';

interface ProductSearchChartProps {
    filename: string | null;
}

interface ChartData {
    month: string;
    value: number;
    profit?: number;
    profitRate?: number;
    rawMonth?: string;
    days?: number;
    growth?: number;
}

interface MatchedProduct {
    code: string;
    name: string;
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

const ProductSearchChart: React.FC<ProductSearchChartProps> = ({ filename }) => {
    const [data, setData] = useState<ChartData[]>([]);
    const [daysList, setDaysList] = useState<number[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('sales');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search keyword state
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Date Range Filter State
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');

    // Time unit state
    const [timeUnit, setTimeUnit] = useState<'month' | 'day'>('month');

    // Channel filter states
    const [channelOptions, setChannelOptions] = useState<OptionsTree>({});
    const [selectedPart, setSelectedPart] = useState<string>('');
    const [selectedChannel, setSelectedChannel] = useState<string>('');
    const [selectedAccount, setSelectedAccount] = useState<string>('');

    // Matched products
    const [matchedProducts, setMatchedProducts] = useState<MatchedProduct[]>([]);
    const [showProducts, setShowProducts] = useState(false);

    // Selected products for checkbox filtering
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [filteredData, setFilteredData] = useState<ChartData[]>([]);

    const [currentLabel, setCurrentLabel] = useState<string>('검색어를 입력하세요');

    // Load channel options on file change
    useEffect(() => {
        const fetchChannelOptions = async () => {
            if (!filename) {
                setChannelOptions({});
                setStartMonth('');
                setEndMonth('');
                setData([]);
                setMatchedProducts([]);
                return;
            }

            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/channel-options`, {
                    params: { filename }
                });
                setChannelOptions(response.data);
            } catch (err) {
                console.error('Failed to fetch channel options:', err);
            }
        };

        fetchChannelOptions();
    }, [filename]);

    const fetchData = async () => {
        if (!filename) return;

        setLoading(true);
        setError(null);

        try {
            const endpoint = timeUnit === 'month'
                ? `${API_BASE_URL}/api/dashboard/product-search-sales`
                : `${API_BASE_URL}/api/dashboard/daily-product-search-sales`;

            const response = await axios.get(endpoint, {
                params: {
                    filename,
                    keyword: searchKeyword,
                    part: selectedPart || 'all',
                    channel: selectedChannel || 'all',
                    account: selectedAccount || 'all'
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
            const products = response.data.matched_products || [];
            setMatchedProducts(products);

            // Initialize all products as selected
            setSelectedProducts(new Set(products.map((p: MatchedProduct) => p.code)));

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
                setStartMonth(months[0]);
                setEndMonth(months[months.length - 1]);
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
        } catch (err: any) {
            console.error('Product search chart error:', err);
            const errorMessage = err.response?.data?.detail || err.message || '데이터를 불러오는데 실패했습니다';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data with selected product codes only (for checkbox filtering)
    const fetchFilteredData = async () => {
        if (!filename || selectedProducts.size === 0) return;

        setLoading(true);
        setError(null);

        try {
            const productCodesParam = Array.from(selectedProducts).join(',');
            const endpoint = timeUnit === 'month'
                ? `${API_BASE_URL}/api/dashboard/product-search-sales`
                : `${API_BASE_URL}/api/dashboard/daily-product-search-sales`;

            const response = await axios.get(endpoint, {
                params: {
                    filename,
                    keyword: searchKeyword,
                    part: selectedPart || 'all',
                    channel: selectedChannel || 'all',
                    account: selectedAccount || 'all',
                    product_codes: productCodesParam
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
            // NOTE: Do NOT update matchedProducts or selectedProducts here
            // to preserve the checkbox state

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

            // Calculate growth rates
            const chartDataWithGrowth = chartData.map((item, index) => {
                if (index === 0) return { ...item, growth: 0 };
                const prevValue = chartData[index - 1].value;
                const growth = prevValue === 0 ? 0 : ((item.value - prevValue) / prevValue) * 100;
                return { ...item, growth };
            });

            setData(chartDataWithGrowth);
        } catch (err: any) {
            console.error('Filtered data fetch error:', err);
            const errorMessage = err.response?.data?.detail || err.message || '선택 항목 데이터 조회 실패';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Refetch when timeUnit changes
    useEffect(() => {
        setStartMonth('');
        setEndMonth('');
        if (filename && searchKeyword) {
            fetchData();
        }
    }, [timeUnit]);

    const handlePartChange = (part: string) => {
        setSelectedPart(part);
        setSelectedChannel('');
        setSelectedAccount('');
    };

    const handleChannelChange = (channel: string) => {
        setSelectedChannel(channel);
        setSelectedAccount('');
    };

    const formatMonth = (month: string): string => {
        if (!month) return '';
        const s = String(month);
        if (s.length === 4) {
            const year = s.slice(0, 2);
            const m = s.slice(2);
            return `${year}'${m}`;
        } else if (s.length === 5 || s.length === 6) {
            const year = s.slice(0, -2);
            const m = s.slice(-2);
            const shortYear = year.length === 4 ? year.slice(-2) : year;
            return `${shortYear}'${m}`;
        }
        return s;
    };

    const formatMillions = (value: any): string => {
        if (typeof value !== 'number') return '';
        if (Math.abs(value) >= 100000000) {
            return (value / 100000000).toFixed(1) + '억';
        }
        return (value / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '만';
    };

    const formatXAxisTick = (value: string, index: number) => {
        if (!value) return '';
        if (timeUnit === 'day') {
            const dateParts = value.split('-');
            if (dateParts.length === 3) {
                const month = dateParts[1];
                const day = dateParts[2];
                return `${month}.${day}`;
            }
            return value;
        }

        // Monthly format: Same as other charts - show year only for first data or January
        if (!value || value.length !== 4) return value;
        const year = value.substring(0, 2);
        const month = parseInt(value.substring(2, 4));

        // 첫 번째 데이터이거나 1월인 경우에만 연도 표시 (\"24'1\" 형식)
        if (index === 0 || month === 1) {
            return `${year}'${month}`;
        }
        return `${month}`;
    };

    const formatPercent = (value: any): string => {
        if (typeof value !== 'number') return '';
        return value.toFixed(1) + '%';
    };

    // Available options based on current selection
    const availableChannels = selectedPart && channelOptions[selectedPart]
        ? Object.keys(channelOptions[selectedPart])
        : [];
    const availableAccounts = selectedPart && selectedChannel && channelOptions[selectedPart]?.[selectedChannel]
        ? channelOptions[selectedPart][selectedChannel]
        : [];

    // Filter data by date range
    const getDisplayData = () => {
        if (!data.length) return [];

        let filtered = data;

        if (timeUnit === 'month' && startMonth && endMonth) {
            filtered = data.filter(d => {
                const raw = d.rawMonth || '';
                return raw >= startMonth && raw <= endMonth;
            });
        } else if (timeUnit === 'day' && startMonth && endMonth) {
            const startYYYYMM = startMonth;
            const endYYYYMM = endMonth;
            filtered = data.filter(d => {
                const raw = d.rawMonth || '';
                const monthOfDay = raw.substring(0, 7).replace('-', '');
                return monthOfDay >= startYYYYMM && monthOfDay <= endYYYYMM;
            });
        }

        // Calculate profitRate for display
        return filtered.map(d => ({
            ...d,
            profitRate: d.value > 0 && d.profit !== undefined ? (d.profit / d.value) * 100 : 0,
            value: (viewMode === 'daily' || viewMode === 'dailyProfitRate') ? (d.value / (d.days || 30)) : d.value
        }));
    };

    const displayData = getDisplayData();
    const isCombination = viewMode === 'salesProfitRate' || viewMode === 'dailyProfitRate';
    const chartTitle = viewMode === 'sales'
        ? `${currentLabel} 월별 매출 추이`
        : viewMode === 'daily'
            ? `${currentLabel} 월별 일평균 매출`
            : viewMode === 'profitRate'
                ? `${currentLabel} 월별 평균 이익률`
                : viewMode === 'salesProfitRate'
                    ? `${currentLabel} 매출액 + 이익률 분석`
                    : viewMode === 'dailyProfitRate'
                        ? `${currentLabel} 일평균 + 이익률 분석`
                        : `${currentLabel} 월별 증감율 (전월 대비)`;

    const yAxisFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? formatPercent : formatMillions;
    const labelFormatter = (viewMode === 'growth' || viewMode === 'profitRate') ? (val: any) => typeof val === 'number' ? val.toFixed(1) + '%' : String(val) : formatMillions;

    return (
        <div className="bg-white p-4 md:p-8 border border-[#c4c4c4] mt-12">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                        상품명 검색 분석
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
                                onChange={(e) => setStartMonth(e.target.value)}
                                className="bg-transparent text-xs font-bold text-black focus:outline-none p-1.5"
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
                            <span className="text-[#c4c4c4]">~</span>
                            <select
                                value={endMonth}
                                onChange={(e) => setEndMonth(e.target.value)}
                                className="bg-transparent text-xs font-bold text-black focus:outline-none p-1.5"
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
                </div>
            </div>

            {/* View Mode Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
                {[
                    { key: 'sales', label: '매출액' },
                    { key: 'daily', label: '일평균 매출' },
                    { key: 'profitRate', label: '이익률' },
                    { key: 'salesProfitRate', label: '매출+이익률' },
                    { key: 'dailyProfitRate', label: '일평균+이익률' },
                    { key: 'growth', label: '증감율' },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setViewMode(key as ViewMode)}
                        className={`px-4 py-2 rounded text-xs font-bold transition-colors border ${viewMode === key
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-[#c4c4c4] hover:border-black'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white p-6 rounded mb-8 border border-[#c4c4c4]">
                <div className="flex flex-col lg:flex-row gap-4 mb-4">
                    {/* Search Input */}
                    <div className="flex-grow">
                        <label className="block text-xs font-bold text-slate-500 mb-2">상품명 검색</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                                placeholder="상품명을 입력하세요 (예: 치약, 세제)"
                                className="w-full pl-10 pr-4 py-3 rounded text-sm font-medium border border-[#c4c4c4] bg-white text-black placeholder:text-[#5d5d5d] hover:border-black transition-colors focus:outline-none focus:border-black"
                            />
                        </div>
                    </div>

                    {/* Channel Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 파트구분 Select */}
                        <select
                            value={selectedPart}
                            onChange={(e) => handlePartChange(e.target.value)}
                            className="px-3 py-2 rounded text-[11px] font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black"
                        >
                            <option value="">전체 (파트구분)</option>
                            {Object.keys(channelOptions).map((part) => (
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
                            <option value="">전체 (채널구분)</option>
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
                            <Search className="w-4 h-4" />
                        )}
                        조회
                    </button>
                </div>
            </div>

            {/* Matched Products Table with Checkboxes */}
            {matchedProducts.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => setShowProducts(!showProducts)}
                            className="flex items-center gap-2 text-sm font-bold text-black hover:opacity-70"
                        >
                            <span>검색된 상품 목록 ({matchedProducts.length}건)</span>
                            <span className={`transform transition-transform ${showProducts ? 'rotate-180' : ''}`}>▼</span>
                        </button>
                        {showProducts && (
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-black border border-[#c4c4c4] px-3 py-1 rounded-sm">
                                    {selectedProducts.size}개 선택됨
                                </span>
                                <button
                                    onClick={() => {
                                        // Filter chart data based on selected products
                                        if (selectedProducts.size === 0) {
                                            alert('최소 1개 이상의 상품을 선택해주세요.');
                                            return;
                                        }
                                        // Re-fetch with only selected product codes
                                        fetchFilteredData();
                                    }}
                                    className="bg-black hover:bg-[#222] text-white px-4 py-1.5 rounded-sm text-xs font-bold transition-colors active:scale-95"
                                >
                                    선택 항목 조회
                                </button>
                            </div>
                        )}
                    </div>
                    {showProducts && (
                        <div className="max-h-60 overflow-y-auto border border-[#c4c4c4] rounded-sm">
                            <table className="w-full text-xs">
                                <thead className="bg-[#f5f5f5] sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-center font-bold text-black w-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedProducts.size === matchedProducts.length && matchedProducts.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedProducts(new Set(matchedProducts.map(p => p.code)));
                                                    } else {
                                                        setSelectedProducts(new Set());
                                                    }
                                                }}
                                                className="w-4 h-4 rounded-sm border-[#c4c4c4] text-black focus:ring-black cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-4 py-2 text-left font-bold text-black">품목코드</th>
                                        <th className="px-4 py-2 text-left font-bold text-black">품목명[규격]</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matchedProducts.map((product, idx) => (
                                        <tr
                                            key={idx}
                                            className={`border-t border-[#e5e5e5] hover:bg-[#f8f8f8] cursor-pointer ${selectedProducts.has(product.code) ? 'bg-[#f5f5f5]' : ''}`}
                                            onClick={() => {
                                                const newSelected = new Set(selectedProducts);
                                                if (newSelected.has(product.code)) {
                                                    newSelected.delete(product.code);
                                                } else {
                                                    newSelected.add(product.code);
                                                }
                                                setSelectedProducts(newSelected);
                                            }}
                                        >
                                            <td className="px-3 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProducts.has(product.code)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const newSelected = new Set(selectedProducts);
                                                        if (e.target.checked) {
                                                            newSelected.add(product.code);
                                                        } else {
                                                            newSelected.delete(product.code);
                                                        }
                                                        setSelectedProducts(newSelected);
                                                    }}
                                                    className="w-4 h-4 rounded-sm border-[#c4c4c4] text-black focus:ring-black cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-black font-mono">{product.code}</td>
                                            <td className="px-4 py-2 text-black">{product.name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="h-80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent"></div>
                </div>
            ) : error ? (
                <div className="h-80 flex items-center justify-center text-red-500">
                    {error}
                </div>
            ) : data.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center text-slate-400">
                    <Search className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg font-bold">상품명을 검색하세요</p>
                    <p className="text-sm mt-1">검색어를 입력하고 조회 버튼을 클릭하세요</p>
                </div>
            ) : (
                <>
                    <h4 className="text-md font-semibold text-gray-600 mb-2 text-center">{chartTitle}</h4>
                    <div key={`${viewMode}-${timeUnit}-${searchKeyword}-${selectedChannel}-${selectedAccount}-${Array.from(selectedProducts).sort().join('|')}`}>
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
                                    padding: '10px'
                                }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            {(() => {
                                const mainColor = viewMode === 'profitRate' ? '#ff0066'
                                    : viewMode === 'growth' ? '#065f46'
                                    : '#000000';
                                return (
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey={viewMode === 'growth' ? "growth" : "value"}
                                name={viewMode === 'growth' ? "증감율" : (viewMode === 'daily' || viewMode === 'dailyProfitRate' ? "일평균 매출" : "매출액")}
                                stroke={mainColor}
                                strokeWidth={timeUnit === 'day' ? 1.5 : 2.5}
                                dot={timeUnit === 'day' ? false : { fill: mainColor, r: 4 }}
                                activeDot={{ r: 6 }}
                                animationDuration={1500}
                                animationEasing="ease-out"
                            >
                                {timeUnit === 'month' && (
                                    <LabelList
                                        dataKey={viewMode === 'growth' ? "growth" : "value"}
                                        content={
                                            <CustomLabel
                                                fill={mainColor}
                                                formatter={labelFormatter}
                                            />
                                        }
                                    />
                                )}
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
                                    strokeWidth={1.5}
                                    dot={timeUnit === 'day' ? false : { fill: "#ff0066", r: 3 }}
                                    activeDot={{ r: 5 }}
                                    animationDuration={1500}
                                    animationEasing="ease-out"
                                >
                                    {timeUnit === 'month' && (
                                        <LabelList
                                            dataKey="profitRate"
                                            content={
                                                <CustomLabel
                                                    fill="#ff0066"
                                                    formatter={formatPercent}
                                                />
                                            }
                                        />
                                    )}
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

export default ProductSearchChart;
