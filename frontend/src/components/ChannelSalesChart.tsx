'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface ChannelSalesChartProps {
    filename: string | null;
}

interface ChartData {
    month: string;
    value: number;
    growth?: number;
}

type ViewMode = 'sales' | 'growth';

interface OptionsTree {
    [part: string]: {
        [channel: string]: string[];
    };
}

const ChannelSalesChart: React.FC<ChannelSalesChartProps> = ({ filename }) => {
    const [data, setData] = useState<ChartData[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('sales');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [options, setOptions] = useState<OptionsTree>({});
    const [selectedPart, setSelectedPart] = useState<string>('');
    const [selectedChannel, setSelectedChannel] = useState<string>('');
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [currentLabel, setCurrentLabel] = useState<string>('전체 채널');

    // Load options on file change
    useEffect(() => {
        const fetchOptions = async () => {
            if (!filename) {
                setOptions({});
                return;
            }

            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/channel-options`, {
                    params: { filename }
                });
                setOptions(response.data);

                // Set default to first part if available (e.g. 이커머스)
                const parts = Object.keys(response.data);
                if (parts.length > 0) {
                    setSelectedPart(parts[0]);
                }
            } catch (err) {
                console.error('Failed to fetch channel options:', err);
                setError('옵션 데이터를 불러오는데 실패했습니다');
            }
        };

        fetchOptions();
    }, [filename]);

    // Load sales data when filters change
    useEffect(() => {
        const fetchData = async () => {
            if (!filename || !selectedPart) {
                setData([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/channel-sales`, {
                    params: {
                        filename,
                        part: selectedPart,
                        channel: selectedChannel || 'all',
                        account: selectedAccount || 'all'
                    }
                });

                const months = response.data.months;
                const sales = response.data.sales;

                setCurrentLabel(response.data.label);

                // Transform data for chart
                const chartData: ChartData[] = months.map((month: string, index: number) => {
                    const value = sales[index] || 0;
                    return {
                        month: formatMonth(month),
                        value
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
            } catch (err) {
                console.error('Failed to fetch channel sales data:', err);
                setError('데이터를 불러오는데 실패했습니다');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [filename, selectedPart, selectedChannel, selectedAccount]);

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
        return null;
    }

    const availableChannels = selectedPart && options[selectedPart] ? Object.keys(options[selectedPart]) : [];
    const availableAccounts = selectedPart && selectedChannel && options[selectedPart][selectedChannel]
        ? options[selectedPart][selectedChannel]
        : [];

    const displayData = data.slice(viewMode === 'growth' ? 1 : 0);
    const chartTitle = viewMode === 'sales'
        ? `🏢 ${currentLabel} 월별 매출 추이`
        : `📈 ${currentLabel} 월별 증감율 (전월 대비)`;
    const yAxisLabel = viewMode === 'sales' ? '매출액' : '증감율 (%)';

    // YAxis formatter selection
    const yAxisFormatter = viewMode === 'sales' ? formatMillions : formatPercent;

    // Label formatter selection
    const labelFormatter = viewMode === 'sales' ? formatMillions : (val: any) => typeof val === 'number' ? val.toFixed(1) + '%' : String(val);

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-700">🏢 채널별 매출 상세 분석</h3>
                    <div className="flex gap-2">
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
                    {/* 파트구분 Select */}
                    <select
                        value={selectedPart}
                        onChange={(e) => handlePartChange(e.target.value)}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                    >
                        <option value="" disabled>파트구분 선택</option>
                        {Object.keys(options).map((part) => (
                            <option key={part} value={part}>{part}</option>
                        ))}
                    </select>

                    {/* 채널구분 Select */}
                    <select
                        value={selectedChannel}
                        onChange={(e) => handleChannelChange(e.target.value)}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
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
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                        disabled={!selectedChannel}
                    >
                        <option value="">전체 (거래처)</option>
                        {availableAccounts.map((account) => (
                            <option key={account} value={account}>{account}</option>
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
                                formatter={(value: number) => {
                                    if (viewMode === 'sales') return [formatMillions(value), '매출액'];
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
                                dataKey={viewMode === 'sales' ? "value" : "growth"}
                                name={currentLabel}
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={{ fill: "#10b981", r: 4 }}
                                activeDot={{ r: 6 }}
                                label={{
                                    position: 'top',
                                    formatter: labelFormatter,
                                    style: { fontSize: '10px', fill: '#10b981', fontWeight: 'bold' }
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </>
            )}
        </div>
    );
};

export default ChannelSalesChart;
