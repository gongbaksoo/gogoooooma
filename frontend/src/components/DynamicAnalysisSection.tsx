import React, { useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ComposedChart, Legend, LabelList
} from 'recharts';
import { getMultiSeriesStyle, getDataTypeSeriesStyle } from '@/lib/chartPalette';

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
        // Show year only for January or first item (공백 제거)
        if (index === 0 || month === 1) {
            return `${year}'${month}`;
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

    // avg(일평균+이익률) 모드: 일평균을 '판매액' 키로 매핑해 chartData(차트 레벨)에서 처리.
    // per-<Line> data prop으로 넘기면 Recharts가 X축 카테고리를 중복 concat해 도메인이 2배가 된다. (error.md §55)
    const chartData = isDaily
        ? ((startMonth || endMonth) ? filteredDaily : safeData.daily.slice(-180))
        : (mode === 'avg' ? filteredMonthly.map(d => ({ ...d, "판매액": (d as any).일평균매출 })) : filteredMonthly);

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
        <div className="bg-white p-4 md:p-8 border border-[#c4c4c4] mt-8">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                <h3 className="text-xl md:text-2xl font-bold text-black tracking-tight leading-tight">
                    {title} 동적 매출 분석
                </h3>

                <div className="flex flex-wrap gap-2">
                    {/* Channel Selector - Only show if dataOptions is provided */}
                    {dataOptions && (
                        <select
                            value={channel}
                            onChange={(e) => setChannel(e.target.value as any)}
                            className="px-3 py-2 rounded text-xs font-bold border border-[#c4c4c4] bg-white text-black focus:outline-none focus:border-black"
                        >
                            <option value="total">전체 (통합)</option>
                            <option value="ecommerce">이커머스</option>
                            <option value="offline">오프라인</option>
                        </select>
                    )}


                    <div className="flex flex-col sm:flex-row gap-2">
                        {/* Single View Buttons */}
                        <div className="flex border border-[#c4c4c4] rounded">
                            <button
                                onClick={() => setMode('sales_only')}
                                className={`px-3 py-2 text-xs font-bold transition-colors ${mode === 'sales_only' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                            >
                                매출액
                            </button>
                            <button
                                onClick={() => setMode('avg_only')}
                                className={`px-3 py-2 text-xs font-bold transition-colors ${mode === 'avg_only' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                            >
                                일평균
                            </button>
                            <button
                                onClick={() => setMode('profit_only')}
                                className={`px-3 py-2 text-xs font-bold transition-colors ${mode === 'profit_only' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                            >
                                이익률
                            </button>
                        </div>

                        {/* Combined View Buttons */}
                        <div className="flex border border-[#c4c4c4] rounded">
                            <button
                                onClick={() => setMode('total')}
                                className={`px-3 py-2 text-xs font-bold transition-colors ${mode === 'total' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                            >
                                월매출+이익률
                            </button>
                            <button
                                onClick={() => setMode('avg')}
                                className={`px-3 py-2 text-xs font-bold transition-colors ${mode === 'avg' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                            >
                                일평균+이익률
                            </button>
                            <button
                                onClick={() => setMode('daily')}
                                className={`px-3 py-2 text-xs font-bold transition-colors ${mode === 'daily' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                            >
                                일매출+이익률
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-[400px]">
                <div key={`${mode}-${channel}`} style={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mergedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                            dataKey={isDaily ? "Date" : "Month"}
                            tickFormatter={(val, index) => {
                                if (isDaily) {
                                    const parts = val.split('-');
                                    if (parts.length !== 3) return val;
                                    const [yyyy, mm, dd] = parts;
                                    if (dd !== '01') return '';
                                    return `${yyyy.slice(2)}/${parseInt(mm)}`;
                                }
                                return formatXAxisTick(val, index);
                            }}
                            stroke="#5d5d5d"
                            style={{ fontSize: '9px', fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis yAxisId="left" stroke="#5d5d5d" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={mode === 'profit_only' ? formatPercent : formatMillions} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#ff0066" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={formatPercent} axisLine={false} tickLine={false} hide={isSingleView} />
                        <Tooltip formatter={(val: any, name: any) => (name === '이익률' || mode === 'profit_only') ? [formatPercent(val), name] : [formatMillions(val), name]} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #c4c4c4', borderRadius: '2px', padding: '10px', fontSize: 12 }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="plainline" />

                        {isSingleView ? (
                            (() => {
                                // 이익률(profit_only)은 §8.5 데이터 종류 매핑(분홍) 유지,
                                // 매출/일평균/일매출은 B-6 다중 시리즈 팔레트
                                const seriesStyle = (i: number) =>
                                    mode === 'profit_only'
                                        ? getDataTypeSeriesStyle(i, 'profitRate')
                                        : getMultiSeriesStyle(i);

                                // 채널별 시리즈 매핑 (1번째=합계/메인, 이후 분해 순)
                                const totalSeries = [
                                    { key: 'val_total', name: '전체' },
                                    { key: 'val_ecom', name: '이커머스' },
                                    { key: 'val_offline', name: '오프라인' },
                                    { key: 'val_coupang', name: '쿠팡(로켓)' },
                                    { key: 'val_major', name: '주력(쿠팡제외)' },
                                ];
                                const ecomSeries = [
                                    { key: 'val_ecom', name: '이커머스' },
                                    { key: 'val_coupang', name: '쿠팡(로켓)' },
                                    { key: 'val_major', name: '주력(쿠팡제외)' },
                                ];
                                const offlineSeries = [
                                    { key: 'val_offline', name: '오프라인' },
                                ];
                                const series = channel === 'total' ? totalSeries
                                    : channel === 'ecommerce' ? ecomSeries
                                    : offlineSeries;

                                return series.map((s, i) => {
                                    const style = seriesStyle(i);
                                    return (
                                        <Line
                                            key={s.key}
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey={s.key}
                                            name={s.name}
                                            stroke={style.stroke}
                                            strokeWidth={style.strokeWidth}
                                            strokeDasharray={style.strokeDasharray}
                                            dot={{ fill: style.stroke, r: style.dotR }}
                                            activeDot={{ r: style.activeR }}
                                            animationDuration={1500}
                                            animationEasing="ease-out"
                                        />
                                    );
                                });
                            })()
                        ) : (
                            <>
                                {mode !== 'profit_only' && (
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="판매액"
                                        name={mode === 'total' || mode === 'sales_only' ? "월매출액" : (mode === 'daily' ? "일매출액" : "일평균 매출")}
                                        stroke="#000000"
                                        strokeWidth={2}
                                        dot={isDaily ? false : { fill: "#000000", r: 1.5 }}
                                        activeDot={{ r: 3.5 }}
                                        animationDuration={1500}
                                        animationEasing="ease-out"
                                    >
                                        <LabelList dataKey="판매액" position="top" content={<CustomLabel fill="#000000" formatter={formatMillions} lastIndex={chartData.length - 1} />} />
                                    </Line>
                                )}

                                {(mode === 'total' || mode === 'avg' || mode === 'daily' || mode === 'profit_only') && (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="이익률"
                                        name="이익률"
                                        stroke="#ff0066"
                                        strokeWidth={2}
                                        dot={isDaily ? false : { fill: "#ff0066", r: 1.5 }}
                                        activeDot={{ r: 3.5 }}
                                        animationDuration={1500}
                                        animationEasing="ease-out"
                                    >
                                        <LabelList dataKey="이익률" position="bottom" content={<CustomLabel fill="#ff0066" formatter={formatPercent} lastIndex={chartData.length - 1} />} />
                                    </Line>
                                )}
                            </>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default DynamicAnalysisSection;
