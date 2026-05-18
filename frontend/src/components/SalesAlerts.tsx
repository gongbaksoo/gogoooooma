'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface AlertData {
    context: string;
    target: string;
    status: 'good' | 'bad' | 'mixed';
    message: string;
    metrics: {
        curr_sales: number;
        curr_margin: number;
        base_sales: number;
        base_margin: number;
    };
}

interface SalesAlertsProps {
    filename: string | null;
}

const SalesAlerts: React.FC<SalesAlertsProps> = ({ filename }) => {
    const [alerts, setAlerts] = useState<AlertData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [expanded, setExpanded] = useState<boolean>(true);

    useEffect(() => {
        if (!filename) return;

        const fetchAlerts = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/alerts`, {
                    params: { filename }
                });
                setAlerts(response.data);
            } catch (err) {
                console.error("Failed to fetch alerts:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAlerts();
    }, [filename]);

    if (!filename || alerts.length === 0) return null;

    // --- Grouping Logic ---
    const ecommerceAlerts: Record<string, AlertData[]> = {};
    const offlineAlerts: Record<string, AlertData[]> = {};
    const otherAlerts: Record<string, AlertData[]> = {};

    alerts.forEach(alert => {
        const ctx = alert.context;
        let targetGroup = otherAlerts;

        // E-commerce Logic
        // Checks for '이커머스' prefix or '해외' (handling potential date suffix like '해외 (25.12)')
        if (ctx.startsWith('이커머스') || ctx.startsWith('해외')) {
            targetGroup = ecommerceAlerts;
        }
        // Offline Logic
        // Checks for '오프라인' prefix, or specific offline marts/agencies (handling suffixes)
        else if (ctx.startsWith('오프라인') ||
            ctx.startsWith('이마트') ||
            ctx.startsWith('롯데마트') ||
            ctx.includes('다이소') ||
            ctx.includes('대리점')) {
            targetGroup = offlineAlerts;
        }

        if (!targetGroup[ctx]) targetGroup[ctx] = [];
        targetGroup[ctx].push(alert);
    });

    // Helper Component for Group Rendering
    const AlertGroupSection = ({ title, data, defaultOpen = false }: { title: string, data: Record<string, AlertData[]>, defaultOpen?: boolean }) => {
        const [isOpen, setIsOpen] = useState(defaultOpen);
        const count = Object.values(data).reduce((acc, curr) => acc + curr.length, 0);

        if (count === 0) return null;

        return (
            <div className="bg-white border border-[#c4c4c4] overflow-hidden mb-4">
                <div
                    className="px-5 py-3 bg-[#f5f5f5] border-b border-[#c4c4c4] flex justify-between items-center cursor-pointer hover:bg-[#ececec] transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <h4 className="font-bold text-black flex items-center gap-2">
                        {title}
                        <span className="text-xs font-normal text-black bg-white border border-[#c4c4c4] px-2 py-0.5 rounded-sm">
                            {count}건
                        </span>
                    </h4>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-black" /> : <ChevronDown className="w-4 h-4 text-black" />}
                </div>

                {isOpen && (
                    <div className="p-4 bg-white grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(data).map(([context, items]) => (
                            <AlertCard key={context} context={context} items={items} filename={filename} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white border border-[#c4c4c4] mb-8 overflow-hidden">
            <div
                className="bg-[#f5f5f5] px-6 py-4 border-b border-[#c4c4c4] flex justify-between items-center cursor-pointer hover:bg-[#ececec]"
                onClick={() => setExpanded(!expanded)}
            >
                <h3 className="text-lg font-bold text-black flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-black" />
                    성과 분석 알림
                    <span className="border border-[#c4c4c4] text-black text-xs px-2 py-0.5 rounded-sm">
                        {alerts.length}건의 인사이트
                    </span>
                </h3>
                {expanded ? <ChevronUp className="w-5 h-5 text-black" /> : <ChevronDown className="w-5 h-5 text-black" />}
            </div>

            {expanded && (
                <div className="p-6 bg-white">
                    {/* 1. E-commerce Group */}
                    <AlertGroupSection title="이커머스" data={ecommerceAlerts} defaultOpen={false} />

                    {/* 2. Offline Group */}
                    <AlertGroupSection title="오프라인" data={offlineAlerts} defaultOpen={false} />

                    {/* 3. Others (Rendered directly or as group) */}
                    {Object.keys(otherAlerts).length > 0 && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(otherAlerts).map(([context, items]) => (
                                <AlertCard key={context} context={context} items={items} filename={filename} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Subcomponent for individual alert blocks
const AlertCard = ({ context, items, filename }: { context: string, items: AlertData[], filename: string }) => {
    return (
        <div className="bg-white p-4 border border-[#c4c4c4] flex flex-col gap-3">
            <h4 className="font-bold text-black border-b border-[#e5e5e5] pb-2 mb-1 flex justify-between items-center">
                {context}
                {(context === '이커머스 - 전체' || context === '오프라인' || context === '이커머스 - 주력 채널 (쿠팡 제외)' ||
                    ['이커머스 - 쿠팡(로켓)', '이커머스 - 스팜(제제지크)', '이커머스 - 스팜(쏭레브)', '이커머스 - 11st', '이커머스 - 이베이', '이커머스 - 카카오', '이커머스 - CJ', '이커머스 - 베이비빌리(주식회사 빌리지베이비)',
                        '해외', '이마트', '롯데마트', '다이소', '오프라인 대리점'].includes(context)) && (
                        <a href={`/custom-dashboard/details?filename=${filename}&type=${context === '오프라인' ? 'offline' :
                            context === '이커머스 - 주력 채널 (쿠팡 제외)' ? 'main' :
                                context === '이커머스 - 쿠팡(로켓)' ? 'coupang' :
                                    context === '이커머스 - 스팜(제제지크)' ? 'naver_zeze' :
                                        context === '이커머스 - 스팜(쏭레브)' ? 'naver_sonreve' :
                                            context === '이커머스 - 11st' ? '11st' :
                                                context === '이커머스 - 이베이' ? 'ebay' :
                                                    context === '이커머스 - 카카오' ? 'kakao' :
                                                        context === '이커머스 - CJ' ? 'cj' :
                                                            context === '이커머스 - 베이비빌리(주식회사 빌리지베이비)' ? 'babybilly' :
                                                                context === '해외' ? 'overseas' :
                                                                    context === '이마트' ? 'emart' :
                                                                        context === '롯데마트' ? 'lotte' :
                                                                            context === '다이소' ? 'daiso' :
                                                                                context === '오프라인 대리점' ? 'agency' :
                                                                                    'ecommerce'
                            }`} target="_blank" className="text-xs text-black hover:underline cursor-pointer">
                            상세 보기 ↗
                        </a>
                    )}
            </h4>
            <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-sm text-sm border-l-4 ${item.status === 'good' ? 'bg-white border-[#ff0066]' :
                        item.status === 'bad' ? 'bg-white border-black' : 'bg-[#f5f5f5] border-[#c4c4c4]'
                        }`}>
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-black text-xs bg-white px-1.5 py-0.5 rounded-sm border border-[#c4c4c4]">
                                vs {item.target}
                            </span>
                            {item.status === 'good' ? <TrendingUp className="w-4 h-4 text-[#ff0066]" /> :
                                item.status === 'bad' ? <TrendingDown className="w-4 h-4 text-black" /> :
                                    <CheckCircle className="w-4 h-4 text-[#5d5d5d]" />}
                        </div>
                        <p className={`font-bold mt-1 ${item.status === 'good' ? 'text-[#ff0066]' :
                            item.status === 'bad' ? 'text-black' : 'text-[#5d5d5d]'
                            }`}>
                            {item.message}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-white p-2 rounded-sm border border-[#c4c4c4]">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[#5d5d5d] font-normal">이번 달</span>
                                <span className="font-bold text-black">₩{item.metrics.curr_sales.toLocaleString()}</span>
                                <span className={`font-medium ${item.metrics.curr_margin >= 0 ? 'text-black' : 'text-[#ff0066]'}`}>
                                    {item.metrics.curr_margin}%
                                </span>
                            </div>
                            <div className="flex flex-col gap-0.5 text-right border-l border-[#c4c4c4] pl-2">
                                <span className="text-[#5d5d5d] font-normal">{item.target}</span>
                                <span className="font-bold text-[#5d5d5d]">₩{item.metrics.base_sales.toLocaleString()}</span>
                                <span className="font-medium text-[#5d5d5d]">
                                    {item.metrics.base_margin}%
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default SalesAlerts;
