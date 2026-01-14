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
        if (ctx.startsWith('이커머스') || ctx === '해외') {
            targetGroup = ecommerceAlerts;
        }
        // Offline Logic
        else if (ctx.startsWith('오프라인') || ['이마트', '롯데마트', '다이소'].includes(ctx) || ctx.includes('대리점')) {
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
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                <div
                    className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        {title}
                        <span className="text-xs font-normal text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                            {count}건
                        </span>
                    </h4>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {isOpen && (
                    <div className="p-4 bg-slate-50/10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(data).map(([context, items]) => (
                            <AlertCard key={context} context={context} items={items} filename={filename} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-8 overflow-hidden transition-all duration-300">
            <div
                className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-100"
                onClick={() => setExpanded(!expanded)}
            >
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    성과 분석 알림
                    <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                        {alerts.length}건의 인사이트
                    </span>
                </h3>
                {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>

            {expanded && (
                <div className="p-6 bg-slate-50/30">
                    {/* 1. E-commerce Group */}
                    <AlertGroupSection title="이커머스" data={ecommerceAlerts} defaultOpen={true} />

                    {/* 2. Offline Group */}
                    <AlertGroupSection title="오프라인" data={offlineAlerts} defaultOpen={true} />

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
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <h4 className="font-bold text-slate-700 border-b border-slate-100 pb-2 mb-1 flex justify-between items-center">
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
                            }`} target="_blank" className="text-xs text-blue-500 hover:underline cursor-pointer">
                            상세 보기 ↗
                        </a>
                    )}
            </h4>
            <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-lg text-sm border-l-4 ${item.status === 'good' ? 'bg-green-50 border-green-400' :
                        item.status === 'bad' ? 'bg-rose-50 border-rose-400' : 'bg-slate-50 border-slate-300'
                        }`}>
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-slate-600 text-xs bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm">
                                vs {item.target}
                            </span>
                            {item.status === 'good' ? <TrendingUp className="w-4 h-4 text-green-500" /> :
                                item.status === 'bad' ? <TrendingDown className="w-4 h-4 text-rose-500" /> :
                                    <CheckCircle className="w-4 h-4 text-slate-400" />}
                        </div>
                        <p className={`font-bold mt-1 ${item.status === 'good' ? 'text-green-800' :
                            item.status === 'bad' ? 'text-rose-800' : 'text-slate-700'
                            }`}>
                            {item.message}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-white/60 p-2 rounded border border-slate-100">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-slate-400 font-medium">이번 달</span>
                                <span className="font-bold text-slate-700">₩{item.metrics.curr_sales.toLocaleString()}</span>
                                <span className={`font-medium ${item.metrics.curr_margin >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                    {item.metrics.curr_margin}%
                                </span>
                            </div>
                            <div className="flex flex-col gap-0.5 text-right border-l border-slate-200 pl-2">
                                <span className="text-slate-400 font-medium">{item.target}</span>
                                <span className="font-bold text-slate-500">₩{item.metrics.base_sales.toLocaleString()}</span>
                                <span className="font-medium text-slate-500">
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
