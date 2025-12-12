"use client";

import { useState } from "react";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import { getLogs } from "@/lib/api";
import ChatInterface from "@/components/ChatInterface";
import FileSelector from "@/components/FileSelector";
import { ArrowRight } from "lucide-react";

export default function Home() {
    const [data, setData] = useState<any>(null);
    const [filename, setFilename] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<any>(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const handleUploadSuccess = (responseData: any) => {
        setData(responseData.data);
        const uploadedFilename = responseData.filename;
        setFilename(uploadedFilename);
        setSelectedFile(uploadedFilename);
    };

    const handleShowLogs = async () => {
        setShowLogs(true);
        setIsLoadingLogs(true);
        try {
            const logData = await getLogs();
            setLogs(logData);
        } catch (error) {
            console.error("Failed to load logs:", error);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="border-b border-gray-200">
                <div className="max-w-[980px] mx-auto px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-medium text-gray-900">Sales Analytics</h2>
                    <div className="flex gap-6">
                        <Link
                            href="/custom-dashboard"
                            className="text-sm text-gray-600 hover:text-gray-900 transition"
                        >
                            대시보드
                        </Link>
                        <button
                            onClick={handleShowLogs}
                            className="text-sm text-gray-600 hover:text-gray-900 transition"
                        >
                            개발자 로그
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="py-20 md:py-32">
                <div className="max-w-[980px] mx-auto px-6 text-center">
                    <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-gray-900 mb-6">
                        매출 분석의
                        <br />
                        새로운 기준
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-600 font-light max-w-2xl mx-auto mb-12">
                        엑셀 파일을 업로드하고 AI 기반 인사이트를 즉시 확인하세요
                    </p>
                    <Link
                        href="/custom-dashboard"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-lg font-medium transition"
                    >
                        대시보드 둘러보기
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>

            {/* Upload Section */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-[980px] mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-4">
                            시작하기
                        </h2>
                        <p className="text-lg text-gray-600 font-light">
                            파일을 업로드하여 분석을 시작하세요
                        </p>
                    </div>

                    <div className="max-w-2xl mx-auto">
                        <FileUpload onUploadSuccess={handleUploadSuccess} />
                    </div>
                </div>
            </section>

            {/* File Selector Section */}
            {selectedFile && (
                <section className="py-20">
                    <div className="max-w-[980px] mx-auto px-6">
                        <div className="mb-12">
                            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
                                저장된 파일
                            </h2>
                            <p className="text-lg text-gray-600 font-light">
                                이전에 업로드한 파일을 선택하세요
                            </p>
                        </div>
                        <FileSelector selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                    </div>
                </section>
            )}

            {/* Chat Section */}
            {selectedFile && (
                <section className="py-20 bg-gray-50">
                    <div className="max-w-[980px] mx-auto px-6">
                        <div className="mb-12">
                            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
                                AI 분석
                            </h2>
                            <p className="text-lg text-gray-600 font-light">
                                {selectedFile}에 대해 무엇이든 물어보세요
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <ChatInterface filename={selectedFile} />
                        </div>
                    </div>
                </section>
            )}

            {/* Data Preview Section */}
            {data && (
                <section className="py-20">
                    <div className="max-w-[980px] mx-auto px-6">
                        <div className="mb-12">
                            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
                                데이터 개요
                            </h2>
                            <p className="text-lg text-gray-600 font-light">
                                업로드된 데이터의 기본 정보
                            </p>
                        </div>

                        {/* Total Rows */}
                        <div className="mb-12 p-8 bg-gray-50 rounded-2xl">
                            <div className="text-sm text-gray-600 mb-2">총 데이터 행</div>
                            <div className="text-5xl font-semibold text-gray-900">{data.total_rows.toLocaleString()}</div>
                        </div>

                        {/* Data Preview */}
                        <div className="mb-12">
                            <h3 className="text-2xl font-semibold text-gray-900 mb-6">데이터 미리보기</h3>
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                {data.columns?.slice(0, 8).map((col: string) => (
                                                    <th key={col} className="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {data.preview?.map((row: any, i: number) => (
                                                <tr key={i} className="hover:bg-gray-50 transition">
                                                    {data.columns?.slice(0, 8).map((col: string) => (
                                                        <td key={col} className="px-6 py-4 text-sm text-gray-600">
                                                            {row[col]}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Statistics */}
                        <div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-6">기본 통계</h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                {data.statistics && typeof data.statistics === 'object' ? (
                                    Object.entries(data.statistics).map(([key, stats]: [string, any]) => {
                                        if (!stats || typeof stats !== 'object') return null;
                                        return (
                                            <div key={key} className="p-6 bg-gray-50 rounded-2xl">
                                                <h4 className="text-lg font-semibold text-gray-900 mb-4">{key}</h4>
                                                <div className="space-y-2 text-sm text-gray-600">
                                                    <div className="flex justify-between">
                                                        <span>평균</span>
                                                        <span className="font-medium text-gray-900">
                                                            {typeof stats.mean === 'number' ? stats.mean.toFixed(2) : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>최소</span>
                                                        <span className="font-medium text-gray-900">{stats.min ?? '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>최대</span>
                                                        <span className="font-medium text-gray-900">{stats.max ?? '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-gray-500">통계 데이터가 없습니다.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="py-12 border-t border-gray-200">
                <div className="max-w-[980px] mx-auto px-6 text-center">
                    <p className="text-sm text-gray-600">
                        © 2025 Sales Analytics. All rights reserved.
                    </p>
                </div>
            </footer>

            {/* Developer Logs Modal */}
            {showLogs && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-200">
                            <h3 className="text-xl font-semibold text-gray-900">시스템 로그</h3>
                            <button
                                onClick={() => setShowLogs(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-gray-900 text-green-400 font-mono text-xs">
                            {isLoadingLogs ? (
                                <div className="text-center p-10">로그를 불러오는 중...</div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1">
                                            🤖 AI 디버그
                                        </h4>
                                        <pre className="whitespace-pre-wrap">{logs?.["chat_debug.log"] || "Empty"}</pre>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1 mt-6">
                                            🚨 시스템 에러
                                        </h4>
                                        <pre className="whitespace-pre-wrap text-red-300">{logs?.["error.log"] || "Empty"}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setShowLogs(false)}
                                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-900 transition"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
