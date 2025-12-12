"use client";

import { useState, useCallback } from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface FileUploadProps {
    onUploadSuccess: (data: any) => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        const file = files[0];
        if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".csv")) {
            setError("엑셀(.xlsx) 또는 CSV 파일만 업로드 가능합니다.");
            return;
        }

        await uploadFile(file);
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await uploadFile(e.target.files[0]);
        }
    };

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await api.post("/upload/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            console.log("Analyze Response:", response.data);
            onUploadSuccess(response.data);
        } catch (err: any) {
            console.error(err);
            setError("파일 업로드/분석 실패: " + (err.response?.data?.detail || err.message));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div>
            <div
                className={cn(
                    "border-2 border-dashed rounded-2xl p-16 md:p-24 text-center transition-all cursor-pointer",
                    isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-white",
                    isUploading && "opacity-50 pointer-events-none"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload")?.click()}
            >
                <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".xlsx,.csv"
                    onChange={handleFileSelect}
                />
                <div className="flex flex-col items-center gap-6">
                    {isUploading ? (
                        <>
                            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                            <div>
                                <div className="text-xl font-medium text-gray-900 mb-2">업로드 중...</div>
                                <div className="text-sm text-gray-600">잠시만 기다려주세요</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                <Upload className="w-8 h-8 text-gray-600" />
                            </div>
                            <div>
                                <div className="text-xl font-medium text-gray-900 mb-2">
                                    파일을 드래그하거나 클릭하여 선택하세요
                                </div>
                                <div className="text-sm text-gray-600">
                                    엑셀(.xlsx) 또는 CSV 파일
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-600 text-center">{error}</p>
                </div>
            )}
        </div>
    );
}
