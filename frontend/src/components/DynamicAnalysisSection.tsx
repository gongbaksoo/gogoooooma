import React, { useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ComposedChart, Legend, LabelList
} from 'recharts';

export interface CategoryData {
    monthly: { Month: string; 판매액: number; 이익률: number; 일평균매출: number }[];
    daily: { Date: string; 판매액: number; 이익률: number }[];
}

interface DynamicAnalysisSectionProps {
    title: string;
    emoji: string;
    data?: CategoryData;
    dataOptions?: {
        total: CategoryData;
        ecommerce: CategoryData;
        offline: CategoryData;
        coupang?: CategoryData;
        major?: CategoryData;
    };
    defaultMode?: 'total' | 'avg' | 'daily' | 'sales_only' | 'avg_only' | 'profit_only';
    defaultChannel?: 'total' | 'ecommerce' | 'offline';
    startMonth?: string;
    endMonth?: string;
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

const formatMillions = (value: any): string => {
    if (typeof value !== 'number') return String(value);
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return value.toLocaleString();
};

const formatPercent = (value: any): string => {
    if (typeof value !== 'number') return String(value);
    return `${value.toFixed(1)}%`;
};

const formatXAxisTick = (value: string, index: number) => {
    // YYYY-MM format (e.g., "2024-01")
    if (value.length === 7) {
        const year = value.substring(2, 4);
        const month = parseInt(value.substring(5, 7));
        // Show year only for January or first item
        if (index === 0 || month === 1) {
            return `${year}' ${month}`;
        }
        return `${month}`;
    }
    // Daily format YYYY-MM-DD
    if (value.length === 10) {
        return `${value.substring(5, 7)}.${value.substring(8, 10)}`;
    }
    return value;
};

const DynamicAnalysisSection: React.FC<DynamicAnalysisSectionProps> = ({
    title,
    emoji,
    data,
    dataOptions,
    defaultMode = 'total',
    defaultChannel = 'total',
    startMonth,
    endMonth
}) => {
    const [mode, setMode] = useState<'total' | 'avg' | 'daily' | 'sales_only' | 'avg_only' | 'profit_only'>(defaultMode);
    const [channel, setChannel] = useState<'total' | 'ecommerce' | 'offline'>(defaultChannel);

    // Determine which dataset to use
    let activeData: CategoryData;

    if (dataOptions) {
        activeData = dataOptions[channel] || { monthly: [], daily: [] };
    } else {
        activeData = data || { monthly: [], daily: [] };
    }

    const safeData = activeData || { monthly: [], daily: [] };

    const isDaily = mode === 'daily';

    // Filter logic
    let filteredDaily = safeData.daily;
    let filteredMonthly = safeData.monthly;

    if (startMonth || endMonth) {
        if (isDaily) {
            filteredDaily = safeData.daily.filter(item => {
                const itemMonth = item.Date.substring(0, 7); // YYYY-MM
                if (startMonth && itemMonth < startMonth) return false;
                if (endMonth && itemMonth > endMonth) return false;
                return true;
            });
        } else {
            filteredMonthly = safeData.monthly.filter(item => {
                const itemMonth = item.Month; // YYYY-MM
                if (startMonth && itemMonth < startMonth) return false;
                if (endMonth && itemMonth > endMonth) return false;
                return true;
            });
        }
    }

    // Use filtered data. For daily mode, if no filter applies, fallback to slice logic?
    // User requested "Date Search", implies if they set a range, they want that range.
    // If NO range is set (initial state?), maybe keep existing logic.
    // If startMonth/endMonth provided, use them.

    // Use filtered data. For daily mode, if no filter applies, fallback to slice logic?
    // User requested "Date Search", implies if they set a range, they want that range.
    // If NO range is set (initial state?), maybe keep existing logic.
    // If startMonth/endMonth provided, use them.

    const chartData = isDaily
        ? ((startMonth || endMonth) ? filteredDaily : safeData.daily.slice(-180))
        : filteredMonthly;

    // --- Multi-Channel Data Merging for Single View Modes ---
    let mergedChartData: any[] = [];
    const isSingleView = ['sales_only', 'avg_only', 'profit_only'].includes(mode);

    if (isSingleView && dataOptions) {
        // Collect all unique months from all datasets
        const allMonths = new Set<string>();
        [dataOptions.total, dataOptions.ecommerce, dataOptions.offline, dataOptions.coupang, dataOptions.major].forEach(d => {
            d?.monthly.forEach(m => allMonths.add(m.Month));
        });

        const sortedMonths = Array.from(allMonths).sort();

        // Filter months based on range
        const validMonths = sortedMonths.filter(m => {
            if (startMonth && m < startMonth) return false;
            if (endMonth && m > endMonth) return false;
            return true;
        });

        // Create merged data points
        mergedChartData = validMonths.map(month => {
            const getMetric = (d?: CategoryData) => {
                const mData = d?.monthly.find(x => x.Month === month);
                if (!mData) return 0;
                if (mode === 'sales_only') return mData.판매액;
                if (mode === 'avg_only') return mData.일평균매출;
                if (mode === 'profit_only') return mData.이익률;
                return 0;
            };

            return {
                Month: month,
                val_total: getMetric(dataOptions.total),
                val_ecom: getMetric(dataOptions.ecommerce),
                val_offline: getMetric(dataOptions.offline),
                val_coupang: getMetric(dataOptions.coupang),
                val_major: getMetric(dataOptions.major)
            };
        });
    } else {
        // Fallback for combined modes: use standard processed chartData
        mergedChartData = chartData;
    }

    return (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-4 md:p-8 border border-slate-100 transition-all hover:shadow-2xl hover:shadow-slate-200/60 mt-8">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                    {emoji} {title} 동적 매출 분석
                </h3>

                <div className="flex flex-wrap gap-2">
                    {/* Channel Selector - Only show if dataOptions is provided */}
                    {dataOptions && (
                        <select
                            value={channel}
                            onChange={(e) => setChannel(e.target.value as any)}
                            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="total">전체 (통합)</option>
                            <option value="ecommerce">이커머스</option>
                            <option value="offline">오프라인</option>
                        </select>
                    )}


                    <div className="flex flex-col sm:flex-row gap-2">
                        {/* Single View Buttons */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl">
                            <button
                                onClick={() => setMode('sales_only')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'sales_only' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                매출액
                            </button>
                            <button
                                onClick={() => setMode('avg_only')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'avg_only' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                일평균
                            </button>
                            <button
                                onClick={() => setMode('profit_only')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'profit_only' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                이익률
                            </button>
                        </div>

                        {/* Combined View Buttons */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl">
                            <button
                                onClick={() => setMode('total')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'total' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                월매출+이익률
                            </button>
                            <button
                                onClick={() => setMode('avg')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'avg' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                일평균+이익률
                            </button>
                            <button
                                onClick={() => setMode('daily')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'daily' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                일매출+이익률
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mergedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                            dataKey={isDaily ? "Date" : "Month"}
                            tickFormatter={(val, index) => isDaily ? val.split('-').slice(1).join('/') : formatXAxisTick(val, index)}
                            stroke="#94a3b8"
                            style={{ fontSize: '10px', fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis yAxisId="left" stroke="#94a3b8" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={mode === 'profit_only' ? formatPercent : formatMillions} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#ec4899" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={formatPercent} axisLine={false} tickLine={false} hide={isSingleView} />
                        <Tooltip formatter={(val: any, name: any) => (name === '이익률' || mode === 'profit_only') ? [formatPercent(val), name] : [formatMillions(val), name]} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        {isSingleView ? (
                            <>
                                {(channel === 'total') && (
                                    <>
                                        <Line yAxisId="left" type="monotone" dataKey="val_total" name="전체" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
                                        <Line yAxisId="left" type="monotone" dataKey="val_ecom" name="이커머스" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                        <Line yAxisId="left" type="monotone" dataKey="val_offline" name="오프라인" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                        <Line yAxisId="left" type="monotone" dataKey="val_coupang" name="쿠팡(로켓)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                                        <Line yAxisId="left" type="monotone" dataKey="val_major" name="주력(쿠팡제외)" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
                                    </>
                                )}
                                {(channel === 'ecommerce') && (
                                    <>
                                        <Line yAxisId="left" type="monotone" dataKey="val_ecom" name="이커머스" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                                        <Line yAxisId="left" type="monotone" dataKey="val_coupang" name="쿠팡(로켓)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                                        <Line yAxisId="left" type="monotone" dataKey="val_major" name="주력(쿠팡제외)" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
                                    </>
                                )}
                                {(channel === 'offline') && (
                                    <>
                                        <Line yAxisId="left" type="monotone" dataKey="val_offline" name="오프라인" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {mode !== 'profit_only' && (
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="판매액"
                                        name={mode === 'total' || mode === 'sales_only' ? "월매출액" : (mode === 'daily' ? "일매출액" : "일평균 매출")}
                                        data={isDaily ? undefined : ((mode === 'avg' || mode === 'avg_only') ? chartData.map(d => ({ ...d, "판매액": (d as any).일평균매출 })) : undefined)}
                                        stroke="#8b5cf6"
                                        strokeWidth={isDaily ? 2 : 3}
                                        dot={isDaily ? false : { fill: "#8b5cf6", r: 4 }}
                                        activeDot={{ r: 6 }}
                                    >
                                        {!isDaily && <LabelList dataKey={mode === 'total' || mode === 'sales_only' ? "판매액" : "일평균매출"} position="top" content={<CustomLabel fill="#8b5cf6" formatter={formatMillions} />} />}
                                    </Line>
                                )}

                                {(mode === 'total' || mode === 'avg' || mode === 'daily' || mode === 'profit_only') && (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="이익률"
                                        name="이익률"
                                        stroke="#ec4899"
                                        strokeWidth={isDaily ? 2 : 3}
                                        dot={isDaily ? false : { fill: "#ec4899", r: 4 }}
                                        activeDot={{ r: 6 }}
                                        strokeDasharray={mode === 'profit_only' ? undefined : "5 5"}
                                    >
                                        {!isDaily && <LabelList dataKey="이익률" position="bottom" content={<CustomLabel fill="#ec4899" formatter={formatPercent} />} />}
                                    </Line>
                                )}
                            </>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DynamicAnalysisSection;
