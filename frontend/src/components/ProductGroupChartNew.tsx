'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { getMultiSeriesStyle, getDataTypeSeriesStyle } from '@/lib/chartPalette';
import { loadDashboardDate, saveDashboardDate } from '@/lib/dashboardDateStorage';

const CHART_ID = 'product-group';

interface ProductGroupChartProps {
    filename: string | null;
}

interface ChartData {
    month: string;
    [key: string]: number | string | undefined; // 동적 품목그룹 데이터
    rawMonth?: string;
    days?: number;
}


type ViewMode = 'sales' | 'growth' | 'daily' | 'profitRate';

// 시리즈 i번째 스타일 — sales/daily는 B-6 다중 hue 팔레트, 의미색(이익률/증감률)은 데이터 종류 매핑 유지
const seriesStyleForMode = (i: number, mode: ViewMode) => {
    if (mode === 'sales' || mode === 'daily') return getMultiSeriesStyle(i);
    if (mode === 'profitRate') return getDataTypeSeriesStyle(i, 'profitRate');
    return getDataTypeSeriesStyle(i, 'growth');
};

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

                // Initialize Date Range: 저장된 기간이 유효하면 복원, 아니면 전체 범위
                if (months.length > 0) {
                    const saved = await loadDashboardDate(CHART_ID);
                    if (saved && months.includes(saved.start) && months.includes(saved.end) && saved.start <= saved.end) {
                        setStartMonth(saved.start);
                        setEndMonth(saved.end);
                    } else {
                        setStartMonth(months[0]);
                        setEndMonth(months[months.length - 1]);
                    }
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
                    // Calculate profit rate and cap extreme values (-1000% to 1000%)
                    let rate = sales === 0 ? 0 : (profit / sales) * 100;
                    rate = Math.max(-1000, Math.min(1000, rate));
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

    const handleBrandSelection = (value: string) => {
        if (value === 'all') {
            setSelectedGroups(groups);
        } else if (value === 'combined') {
            // "주요 브랜드" 선택 시 합계와 개별 브랜드를 모두 표시
            setSelectedGroups(['마이비+누비+쏭레브', '마이비', '누비', '쏭레브']);
        } else {
            setSelectedGroups([value]);
        }
    };

    if (!filename) {
        return (
            <div className="bg-white p-6 border border-[#c4c4c4]">
                <h3 className="text-lg font-bold text-gray-700 mb-4">브랜드별 월별 매출</h3>
                <div className="h-80 flex items-center justify-center text-gray-500">
                    파일을 업로드하거나 선택해주세요
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white p-6 border border-[#c4c4c4]">
                <h3 className="text-lg font-bold text-gray-700 mb-4">브랜드별 월별 매출</h3>
                <div className="h-80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white p-6 border border-[#c4c4c4]">
                <h3 className="text-lg font-bold text-gray-700 mb-4">브랜드별 월별 매출</h3>
                <div className="h-80 flex items-center justify-center text-red-500">
                    {error}
                </div>
            </div>
        );
    }

    const chartData = getChartData();
    const tooltipFormatter = (value: any, name: any, props: any) => {
        if (viewMode === 'growth' || viewMode === 'profitRate') {
            return [value.toFixed(1) + '%', ''];
        } else {
            const days = props.payload.days;
            const suffix = viewMode === 'daily' ? ` (기준: ${days}일)` : '';
            return [formatCurrency(value) + (viewMode === 'daily' ? '' : '원'), (name || '') + suffix];
        }
    };
    const chartTitle = viewMode === 'sales'
        ? '브랜드별 월별 매출 추이'
        : viewMode === 'daily'
            ? '브랜드별 월별 일평균 매출'
            : viewMode === 'profitRate'
                ? '브랜드별 월별 평균 이익률'
                : '브랜드별 월별 증감율 (전월 대비)';
    const yAxisLabel = viewMode === 'sales' ? '매출액' : viewMode === 'daily' ? '일평균 매출' : viewMode === 'profitRate' ? '이익률 (%)' : '증감율 (%)';

    return (
        <div className="bg-white p-4 md:p-8 border border-[#c4c4c4] mt-12 last:mb-12">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                        브랜드별 월별매출
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 font-medium">Monthly performance by brand</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    {/* Date Range Selectors */}
                    {data.length > 0 && (
                        <div className="flex items-center gap-1 bg-white p-1 rounded border border-[#c4c4c4] w-full sm:w-auto justify-between">
                            <select
                                value={startMonth}
                                onChange={(e) => { setStartMonth(e.target.value); saveDashboardDate(CHART_ID, e.target.value, endMonth); }}
                                className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none p-1.5"
                            >
                                {data.map(d => (
                                    <option key={`start-${d.rawMonth}`} value={d.rawMonth}>{d.month}</option>
                                ))}
                            </select>
                            <span className="text-slate-300">~</span>
                            <select
                                value={endMonth}
                                onChange={(e) => { setEndMonth(e.target.value); saveDashboardDate(CHART_ID, startMonth, e.target.value); }}
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
                        value={selectedGroups.length === groups.length ? 'all' : selectedGroups.includes('마이비+누비+쏭레브') && selectedGroups.includes('마이비') ? 'combined' : selectedGroups[0] || ''}
                        onChange={(e) => handleBrandSelection(e.target.value)}
                        className="px-4 py-2.5 rounded text-xs font-bold border border-[#c4c4c4] bg-white text-black hover:border-black transition-colors focus:outline-none focus:border-black grow sm:grow-0"
                    >
                        <option value="all">전체 브랜드</option>
                        <option value="combined">주요 브랜드</option>
                        {groups.filter(g => g !== '마이비+누비+쏭레브').map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div key={`${viewMode}-${[...selectedGroups].sort().join('|')}`}>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                            border: '1px solid #c4c4c4',
                            borderRadius: '2px',
                            padding: '10px', fontSize: 12
                        }}
                    />
                    <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="plainline"
                    />
                    {(() => {
                        // 합계가 1번째(메인), 나머지는 정의 순서대로 2~N번째
                        const visibleGroups = groups.filter(g => selectedGroups.includes(g));
                        const combinedGroup = visibleGroups.find(g => g === '마이비+누비+쏭레브');
                        const otherGroups = visibleGroups.filter(g => g !== '마이비+누비+쏭레브');
                        const ordered = combinedGroup ? [combinedGroup, ...otherGroups] : otherGroups;
                        const lastIdx = chartData.length - 1;
                        const labelFormatter = viewMode === 'growth' || viewMode === 'profitRate' ? formatPercent : formatMillions;
                        return ordered.map((group, i) => {
                            const style = seriesStyleForMode(i, viewMode);
                            return (
                                <Line
                                    key={group}
                                    type="monotone"
                                    dataKey={group}
                                    stroke={style.stroke}
                                    strokeWidth={style.strokeWidth}
                                    strokeDasharray={style.strokeDasharray}
                                    dot={{ fill: style.stroke, r: style.dotR }}
                                    activeDot={{ r: style.activeR }}
                                    animationDuration={1500}
                                    animationEasing="ease-out"
                                >
                                    <LabelList
                                        dataKey={group}
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
                                                    fontWeight={i === 0 ? 'bold' : 'normal'}
                                                >
                                                    {labelFormatter(value)}
                                                </text>
                                            );
                                        }}
                                    />
                                </Line>
                            );
                        });
                    })()}
                </LineChart>
            </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ProductGroupChartNew;
