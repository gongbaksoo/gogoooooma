'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart, Legend, LabelList } from 'recharts';

interface CategoryData {
    monthly: { Month: string; 판매액: number; 이익률: number; 일평균매출: number }[];
    daily: { Date: string; 판매액: number; 이익률: number }[];
}

interface ComprehensiveData {
    ecommerce: CategoryData;
    offline: CategoryData;
    ecommerce_myb: CategoryData;
    ecommerce_nubi: CategoryData;
    ecommerce_sonreve: CategoryData;
    offline_myb: CategoryData;
    offline_nubi: CategoryData;
    offline_sonreve: CategoryData;
    main_overall: CategoryData;
    main_myb: CategoryData;
    main_nubi: CategoryData;
    main_sonreve: CategoryData;
    stain_ecommerce: CategoryData;
    stain_offline: CategoryData;
    stain_main: CategoryData;
    // Nubi
    nubi_longhandle_ecommerce: CategoryData; nubi_longhandle_offline: CategoryData; nubi_longhandle_main: CategoryData;
    nubi_stainless_ecommerce: CategoryData; nubi_stainless_offline: CategoryData; nubi_stainless_main: CategoryData;
    nubi_jungle_ecommerce: CategoryData; nubi_jungle_offline: CategoryData; nubi_jungle_main: CategoryData;
    nubi_spoon_ecommerce: CategoryData; nubi_spoon_offline: CategoryData; nubi_spoon_main: CategoryData;
    nubi_2in1_ecommerce: CategoryData; nubi_2in1_offline: CategoryData; nubi_2in1_main: CategoryData;
    nubi_ladybug_ecommerce: CategoryData; nubi_ladybug_offline: CategoryData; nubi_ladybug_main: CategoryData;
    nubi_pacifier_ecommerce: CategoryData; nubi_pacifier_offline: CategoryData; nubi_pacifier_main: CategoryData;
    // Sonreve
    sonreve_toneup_ecommerce: CategoryData; sonreve_toneup_offline: CategoryData; sonreve_toneup_main: CategoryData;
    sonreve_shampoo_ecommerce: CategoryData; sonreve_shampoo_offline: CategoryData; sonreve_shampoo_main: CategoryData;
    sonreve_cleanser_ecommerce: CategoryData; sonreve_cleanser_offline: CategoryData; sonreve_cleanser_main: CategoryData;
    sonreve_lotion_ecommerce: CategoryData; sonreve_lotion_offline: CategoryData; sonreve_lotion_main: CategoryData;
    [key: string]: CategoryData; // Allow dynamic category keys (mild_ecommerce, etc.)
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
    // Daily format YYYY-MM-DD: 각 월의 1일에만 'YY/M' 표시
    if (value.length === 10) {
        const dd = value.substring(8, 10);
        if (dd !== '01') return '';
        const yy = value.substring(2, 4);
        const m = parseInt(value.substring(5, 7));
        return `${yy}/${m}`;
    }
    return value;
};

// Reusable Dynamic Section Component (page-local)
const DynamicAnalysisSection = ({ title, data, emoji, defaultMode = 'total' }: { title: string, data: CategoryData, emoji: string, defaultMode?: 'total' | 'avg' | 'daily' }) => {
    const [mode, setMode] = useState<'total' | 'avg' | 'daily'>(defaultMode as any);

    // Ensure data is not null/undefined to prevent crashes, but allow empty arrays
    const safeData = data || { monthly: [], daily: [] };

    const isDaily = mode === 'daily';
    // Use last 180 days for daily mode
    const chartData = isDaily ? safeData.daily.slice(-180) : safeData.monthly;

    return (
        <div className="bg-white p-4 md:p-8 border border-[#c4c4c4] mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                <h3 className="text-xl md:text-2xl font-bold text-black tracking-tight leading-tight">
                    {title} 동적 매출 분석
                </h3>
                <div className="flex border border-[#c4c4c4] rounded">
                    <button
                        onClick={() => setMode('total')}
                        className={`px-4 py-2 text-xs font-bold transition-colors ${mode === 'total' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                    >
                        월매출 (꺾은선)
                    </button>
                    <button
                        onClick={() => setMode('avg')}
                        className={`px-4 py-2 text-xs font-bold transition-colors ${mode === 'avg' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                    >
                        일평균 (꺾은선)
                    </button>
                    <button
                        onClick={() => setMode('daily')}
                        className={`px-4 py-2 text-xs font-bold transition-colors ${mode === 'daily' ? 'bg-black text-white' : 'text-[#5d5d5d] hover:text-black'}`}
                    >
                        일매출 (꺾은선)
                    </button>
                </div>
            </div>

            <div className="h-[400px]">
                <div key={mode} style={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                        <YAxis yAxisId="left" stroke="#5d5d5d" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={formatMillions} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#ff0066" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={formatPercent} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(val: any, name: any) => name === '이익률' ? [formatPercent(val), name] : [formatMillions(val), name]} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #c4c4c4', borderRadius: '2px', padding: '10px' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="판매액"
                            name={mode === 'total' ? "월매출액" : (mode === 'daily' ? "일매출액" : "일평균 매출")}
                            data={isDaily ? undefined : (mode === 'avg' ? chartData.map(d => ({ ...d, "판매액": (d as any).일평균매출 })) : undefined)}
                            stroke="#000000"
                            strokeWidth={isDaily ? 1.5 : 2.5}
                            dot={isDaily ? false : { fill: "#000000", r: 4 }}
                            activeDot={{ r: 6 }}
                            animationDuration={1500}
                            animationEasing="ease-out"
                        >
                            <LabelList dataKey={mode === 'total' ? "판매액" : "일평균매출"} position="top" content={<CustomLabel fill="#000000" formatter={formatMillions} lastIndex={chartData.length - 1} />} />
                        </Line>

                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="이익률"
                            name="이익률"
                            stroke="#ff0066"
                            strokeWidth={1.5}
                            dot={isDaily ? false : { fill: "#ff0066", r: 3 }}
                            activeDot={{ r: 5 }}
                            animationDuration={1500}
                            animationEasing="ease-out"
                        >
                            <LabelList dataKey="이익률" position="bottom" content={<CustomLabel fill="#ff0066" formatter={formatPercent} lastIndex={chartData.length - 1} />} />
                        </Line>
                    </ComposedChart>
                </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

function DetailsContent() {
    const searchParams = useSearchParams();
    const filename = searchParams.get('filename');
    const [data, setData] = useState<ComprehensiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProductAnalysisExpanded, setIsProductAnalysisExpanded] = useState(false);
    const [isNubiExpanded, setIsNubiExpanded] = useState(false);
    const [isSonreveExpanded, setIsSonreveExpanded] = useState(false);
    const type = searchParams.get('type') || 'ecommerce';
    const isOffline = type === 'offline';
    const isMain = type === 'main';

    useEffect(() => {
        if (!filename) return;
        const fetchData = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/ecommerce-details`, { params: { filename } });
                setData(response.data);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchData();
    }, [filename]);

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent"></div>
        </div>
    );

    if (!data) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="text-xl font-bold text-black">데이터를 불러올 수 없습니다.</div>
        </div>
    );

    const mainData = isOffline ? data.offline : (isMain ? data.main_overall : (data[type] || data.ecommerce));

    // Dynamic Title Logic
    let typeLabel = "이커머스";
    if (isOffline) typeLabel = "오프라인";
    else if (isMain) typeLabel = "이커머스 주력채널(쿠팡 제외)";
    else {
        const typeMap: Record<string, string> = {
            'coupang': '쿠팡(로켓)',
            'naver_zeze': '스팜(제제지크)',
            'naver_sonreve': '스팜(쏭레브)',
            '11st': '11st',
            'ebay': '이베이',
            'kakao': '카카오',
            'cj': 'CJ',
            'babybilly': '베이비빌리',
            // New Accounts
            'overseas': '해외',
            'emart': '이마트',
            'lotte': '롯데마트',
            'daiso': '다이소',
            'agency': '오프라인 대리점'
        };
        if (typeMap[type]) typeLabel = typeMap[type];
    }

    const brandPrefix = isMain ? "주력채널" : (isOffline ? "오프라인" : (type && type !== 'ecommerce' ? typeLabel : "이커머스"));

    // Function to get brand data dynamically
    const getBrandData = (brand: 'myb' | 'nubi' | 'sonreve') => {
        if (isOffline) return (data as any)[`offline_${brand}`];
        if (isMain) return (data as any)[`main_${brand}`];
        if (type && type !== 'ecommerce' && (data as any)[`${type}_${brand}`]) return (data as any)[`${type}_${brand}`];
        return (data as any)[`ecommerce_${brand}`]; // Default
    };

    // Prepare Merged Data for Brand Comparison Chart
    const comparisonData = mainData.monthly.map((m: any) => {
        const month = m.Month;
        const myb = getBrandData('myb')?.monthly.find((d: any) => d.Month === month)?.판매액 || 0;
        const nubi = getBrandData('nubi')?.monthly.find((d: any) => d.Month === month)?.판매액 || 0;
        const sonreve = getBrandData('sonreve')?.monthly.find((d: any) => d.Month === month)?.판매액 || 0;
        return {
            Month: month,
            [`${brandPrefix} 전체`]: m.판매액,
            "마이비": myb,
            "누비": nubi,
            "쏭레브": sonreve
        };

    });

    return (
        <div className="min-h-screen bg-white p-8 pb-32">
            <div className="max-w-7xl mx-auto space-y-12">
                <header className="flex justify-between items-center">
                    <div>
                        <h1 className="text-[30px] leading-[1.13] font-bold text-black tracking-normal">{typeLabel} 및 채널별 상세 분석 리포트</h1>
                        <p className="mt-3 text-[15px] leading-[1.5] font-normal text-[#5d5d5d]">데이터 기반 심층 성과 대시보드</p>
                    </div>
                    <button
                        onClick={() => window.close()}
                        className="inline-flex items-center justify-center gap-2 bg-white text-black text-[14px] font-bold border border-solid h-[44px] px-4 transition-colors hover:border-black"
                        style={{ borderColor: '#c4c4c4', borderRadius: 4 }}
                    >
                        닫기
                    </button>
                </header>

                {/* 1. Dynamic Overall Analysis (Monthly/Daily) */}
                <DynamicAnalysisSection
                    title={`${typeLabel} 전체 매출 분석`}
                    emoji=""
                    data={mainData}
                    defaultMode="total"
                />

                {/* 2. Brand Monthly Comparison (Line) */}
                <div className="bg-white p-4 md:p-8 border border-[#c4c4c4]">
                    <h3 className="text-xl md:text-2xl font-bold text-black tracking-tight leading-tight mb-8">
                        {typeLabel} 브랜드별 월별 매출추이
                    </h3>
                    <div className="h-[400px]">
                        <div key={`brand-compare-${typeLabel}-${comparisonData.length}`} style={{ width: '100%', height: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="Month" tickFormatter={formatXAxisTick} stroke="#5d5d5d" style={{ fontSize: '9px', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} interval={0} angle={-45} textAnchor="end" height={60} />
                                <YAxis stroke="#5d5d5d" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={formatMillions} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(val: any) => [formatMillions(val), '매출액']} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #c4c4c4', borderRadius: '2px', padding: '10px' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                {/* 8-pattern: 1=전체 진함실선, 2=마이비 진함점선, 3=누비 중간실선, 4=쏭레브 중간점선 — 모두 매출 데이터 (검정 계열) */}
                                <Line type="monotone" dataKey={`${isMain ? "주력채널" : typeLabel} 전체`} stroke="#000000" strokeWidth={2.5} dot={{ fill: "#000000", r: 4 }} activeDot={{ r: 6 }} animationDuration={1500} animationEasing="ease-out">
                                    <LabelList dataKey={`${isMain ? "주력채널" : typeLabel} 전체`} position="top" content={<CustomLabel fill="#000000" formatter={formatMillions} lastIndex={comparisonData.length - 1} />} />
                                </Line>
                                <Line type="monotone" dataKey="마이비" stroke="#000000" strokeWidth={1.5} strokeDasharray="4 4" dot={{ fill: "#000000", r: 3 }} activeDot={{ r: 5 }} animationDuration={1500} animationEasing="ease-out">
                                    <LabelList dataKey="마이비" position="top" content={<CustomLabel fill="#000000" formatter={formatMillions} lastIndex={comparisonData.length - 1} />} />
                                </Line>
                                <Line type="monotone" dataKey="누비" stroke="#5d5d5d" strokeWidth={1.5} dot={{ fill: "#5d5d5d", r: 3 }} activeDot={{ r: 5 }} animationDuration={1500} animationEasing="ease-out">
                                    <LabelList dataKey="누비" position="top" content={<CustomLabel fill="#5d5d5d" formatter={formatMillions} lastIndex={comparisonData.length - 1} />} />
                                </Line>
                                <Line type="monotone" dataKey="쏭레브" stroke="#5d5d5d" strokeWidth={1.5} strokeDasharray="4 4" dot={{ fill: "#5d5d5d", r: 3 }} activeDot={{ r: 5 }} animationDuration={1500} animationEasing="ease-out">
                                    <LabelList dataKey="쏭레브" position="top" content={<CustomLabel fill="#5d5d5d" formatter={formatMillions} lastIndex={comparisonData.length - 1} />} />
                                </Line>
                            </LineChart>
                        </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* 3. Deep Analysis Section */}
                <div className="space-y-12">
                    <h2 className="text-[22px] leading-[29.92px] font-bold text-black tracking-tight">
                        채널 및 브랜드별 성과 분석
                    </h2>

                    <DynamicAnalysisSection title={`${brandPrefix} 마이비`} emoji="" data={getBrandData('myb') || mainData} />
                    <DynamicAnalysisSection title={`${brandPrefix} 누비`} emoji="" data={getBrandData('nubi') || mainData} />
                    <DynamicAnalysisSection title={`${brandPrefix} 쏭레브`} emoji="" data={getBrandData('sonreve') || mainData} />
                </div>

                <div className="pt-12 border-t border-[#c4c4c4] mt-12">
                    <button
                        onClick={() => setIsProductAnalysisExpanded(!isProductAnalysisExpanded)}
                        className="w-full flex items-center justify-between p-6 bg-white border border-[#c4c4c4] hover:border-black transition-colors group"
                    >
                        <h2 className="text-2xl font-bold text-black flex items-center gap-4">
                            마이비 품목별 분석
                            <span className="text-sm font-normal text-[#5d5d5d] ml-4">
                                {isProductAnalysisExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                            </span>
                        </h2>
                    </button>

                    {isProductAnalysisExpanded && (
                        <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 얼룩제거제`}
                                emoji=""
                                data={(isOffline ? (data as any).stain_offline : (isMain ? (data as any).stain_main : (data as any)[`stain_${type || 'ecommerce'}`] || (data as any).stain_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 순한라인`}
                                emoji=""
                                data={(isOffline ? (data as any).mild_offline : (isMain ? (data as any).mild_main : (data as any)[`mild_${type || 'ecommerce'}`] || (data as any).mild_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 삶기세제`}
                                emoji=""
                                data={(isOffline ? (data as any).boil_offline : (isMain ? (data as any).boil_main : (data as any)[`boil_${type || 'ecommerce'}`] || (data as any).boil_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 건조기시트`}
                                emoji=""
                                data={(isOffline ? (data as any).dryer_offline : (isMain ? (data as any).dryer_main : (data as any)[`dryer_${type || 'ecommerce'}`] || (data as any).dryer_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 캡슐세제`}
                                emoji=""
                                data={(isOffline ? (data as any).capsule_offline : (isMain ? (data as any).capsule_main : (data as any)[`capsule_${type || 'ecommerce'}`] || (data as any).capsule_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 비건 고불소 치약`}
                                emoji=""
                                data={(isOffline ? (data as any).fluoride_offline : (isMain ? (data as any).fluoride_main : (data as any)[`fluoride_${type || 'ecommerce'}`] || (data as any).fluoride_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 구강티슈`}
                                emoji=""
                                data={(isOffline ? (data as any).oral_offline : (isMain ? (data as any).oral_main : (data as any)[`oral_${type || 'ecommerce'}`] || (data as any).oral_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 수유패드`}
                                emoji=""
                                data={(isOffline ? (data as any).pad_offline : (isMain ? (data as any).pad_main : (data as any)[`pad_${type || 'ecommerce'}`] || (data as any).pad_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 욕조클리너`}
                                emoji=""
                                data={(isOffline ? (data as any).bath_offline : (isMain ? (data as any).bath_main : (data as any)[`bath_${type || 'ecommerce'}`] || (data as any).bath_ecommerce)) || mainData}
                            />
                        </div>
                    )}
                </div>

                <div className="pt-12 border-t border-[#c4c4c4] mt-12">
                    <button
                        onClick={() => setIsNubiExpanded(!isNubiExpanded)}
                        className="w-full flex items-center justify-between p-6 bg-white border border-[#c4c4c4] hover:border-black transition-colors group"
                    >
                        <h2 className="text-2xl font-bold text-black flex items-center gap-4">
                            누비 품목별 분석
                            <span className="text-sm font-normal text-[#5d5d5d] ml-4">
                                {isNubiExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                            </span>
                        </h2>
                    </button>

                    {isNubiExpanded && (
                        <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                            <DynamicAnalysisSection title={`${typeLabel} 롱핸들`} emoji="" data={(isOffline ? (data as any).nubi_longhandle_offline : (isMain ? (data as any).nubi_longhandle_main : (data as any)[`nubi_longhandle_${type || 'ecommerce'}`] || (data as any).nubi_longhandle_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 스텐 물병`} emoji="" data={(isOffline ? (data as any).nubi_stainless_offline : (isMain ? (data as any).nubi_stainless_main : (data as any)[`nubi_stainless_${type || 'ecommerce'}`] || (data as any).nubi_stainless_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 정글 물병`} emoji="" data={(isOffline ? (data as any).nubi_jungle_offline : (isMain ? (data as any).nubi_jungle_main : (data as any)[`nubi_jungle_${type || 'ecommerce'}`] || (data as any).nubi_jungle_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 3스텝 스푼`} emoji="" data={(isOffline ? (data as any).nubi_spoon_offline : (isMain ? (data as any).nubi_spoon_main : (data as any)[`nubi_spoon_${type || 'ecommerce'}`] || (data as any).nubi_spoon_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 2in1 컵`} emoji="" data={(isOffline ? (data as any).nubi_2in1_offline : (isMain ? (data as any).nubi_2in1_main : (data as any)[`nubi_2in1_${type || 'ecommerce'}`] || (data as any).nubi_2in1_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 무당벌레 빨대컵`} emoji="" data={(isOffline ? (data as any).nubi_ladybug_offline : (isMain ? (data as any).nubi_ladybug_main : (data as any)[`nubi_ladybug_${type || 'ecommerce'}`] || (data as any).nubi_ladybug_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 실리콘노리개`} emoji="" data={(isOffline ? (data as any).nubi_pacifier_offline : (isMain ? (data as any).nubi_pacifier_main : (data as any)[`nubi_pacifier_${type || 'ecommerce'}`] || (data as any).nubi_pacifier_ecommerce)) || mainData} />
                        </div>
                    )}
                </div>

                <div className="pt-12 border-t border-[#c4c4c4] mt-12">
                    <button
                        onClick={() => setIsSonreveExpanded(!isSonreveExpanded)}
                        className="w-full flex items-center justify-between p-6 bg-white border border-[#c4c4c4] hover:border-black transition-colors group"
                    >
                        <h2 className="text-2xl font-bold text-black flex items-center gap-4">
                            쏭레브 품목별 분석
                            <span className="text-sm font-normal text-[#5d5d5d] ml-4">
                                {isSonreveExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                            </span>
                        </h2>
                    </button>

                    {isSonreveExpanded && (
                        <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                            <DynamicAnalysisSection title={`${typeLabel} 톤업 크림`} emoji="" data={(isOffline ? (data as any).sonreve_toneup_offline : (isMain ? (data as any).sonreve_toneup_main : (data as any)[`sonreve_toneup_${type || 'ecommerce'}`] || (data as any).sonreve_toneup_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 키즈 샴푸`} emoji="" data={(isOffline ? (data as any).sonreve_shampoo_offline : (isMain ? (data as any).sonreve_shampoo_main : (data as any)[`sonreve_shampoo_${type || 'ecommerce'}`] || (data as any).sonreve_shampoo_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 키즈 페이셜클렌저`} emoji="" data={(isOffline ? (data as any).sonreve_cleanser_offline : (isMain ? (data as any).sonreve_cleanser_main : (data as any)[`sonreve_cleanser_${type || 'ecommerce'}`] || (data as any).sonreve_cleanser_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 키즈 페이셜로션`} emoji="" data={(isOffline ? (data as any).sonreve_lotion_offline : (isMain ? (data as any).sonreve_lotion_main : (data as any)[`sonreve_lotion_${type || 'ecommerce'}`] || (data as any).sonreve_lotion_ecommerce)) || mainData} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ComprehensiveDetailsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent"></div>
            </div>
        }>
            <DetailsContent />
        </Suspense>
    );
}
