"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, ShoppingCart, RefreshCw, Box, Package, AlertCircle } from "lucide-react";
import api from "@/lib/api";

interface Order {
    orderId: string;
    vendorItemId: string;
    productName: string;
    orderQuantity: number;
    salePrice: number;
    paidAt: string;
    status: string;
}

export default function CoupangOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(7); // Default 7 days

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/api/coupang/orders?days=${days}`);
            if (response.data.success) {
                setOrders(response.data.orders);
            } else {
                setError(response.data.error?.message || "데이터를 불러오는데 실패했습니다.");
            }
        } catch (err: any) {
            console.error("Failed to fetch orders:", err);
            setError(err.response?.data?.detail || "서버 통신 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [days]);

    // Calculate Stats
    const totalOrders = orders.length;
    const totalQuantity = orders.reduce((sum, order) => sum + order.orderQuantity, 0);
    const totalRevenue = orders.reduce((sum, order) => sum + (order.salePrice * order.orderQuantity), 0);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-orange-500" />
                                쿠팡 발주 현황 (Rocket Growth)
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white"
                            >
                                <option value={1}>오늘</option>
                                <option value={3}>최근 3일</option>
                                <option value={7}>최근 7일</option>
                                <option value={30}>최근 30일</option>
                            </select>
                            <button
                                onClick={fetchOrders}
                                disabled={loading}
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Portal */}
            <div className="container mx-auto px-4 py-8 max-w-7xl">

                {error && (
                    <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100">
                        <AlertCircle className="w-5 h-5" />
                        <div>
                            <p className="font-bold">오류 발생</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Stat Card 1 */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="text-slate-500 text-sm font-medium mb-2">총 주문 건수</div>
                        <div className="text-3xl font-bold text-slate-800">{totalOrders} 건</div>
                        <div className="text-xs text-slate-400 mt-2">기간: 최근 {days}일</div>
                    </div>
                    {/* Stat Card 2 */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="text-slate-500 text-sm font-medium mb-2">총 주문 수량</div>
                        <div className="text-3xl font-bold text-orange-600">{totalQuantity} 개</div>
                        <div className="text-xs text-slate-400 mt-2">발주 필요 수량 확인</div>
                    </div>
                    {/* Stat Card 3 */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="text-slate-500 text-sm font-medium mb-2">추정 매출액</div>
                        <div className="text-3xl font-bold text-blue-600">{totalRevenue.toLocaleString()} 원</div>
                        <div className="text-xs text-slate-400 mt-2">판매가 기준</div>
                    </div>
                </div>

                {/* Orders List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800">주문 리스트</h2>
                        <span className="text-xs text-slate-400">상위 100건 표시</span>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                            <p className="text-slate-500">주문 정보를 불러오는 중입니다...</p>
                        </div>
                    ) : orders.length === 0 && !error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Box className="w-12 h-12 mb-4 opacity-50" />
                            <p>해당 기간에 주문이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">주문일시</th>
                                        <th className="px-6 py-4">주문번호</th>
                                        <th className="px-6 py-4">상품명</th>
                                        <th className="px-6 py-4">SKU ID</th>
                                        <th className="px-6 py-4 text-right">수량</th>
                                        <th className="px-6 py-4 text-right">판매가</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {orders.map((order) => (
                                        <tr key={order.orderId} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-600">
                                                {new Date(order.paidAt).toLocaleDateString('ko-KR')} <br />
                                                <span className="text-xs text-slate-400">
                                                    {new Date(order.paidAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                                {order.orderId}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-800 max-w-xs truncate" title={order.productName || "상품명 없음"}>
                                                {order.productName || "상품명 없음"}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs">
                                                {order.vendorItemId}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-800">
                                                {order.orderQuantity}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-600">
                                                {order.salePrice.toLocaleString()}원
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
