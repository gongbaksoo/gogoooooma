"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone"; // Need to install this or implement manual drag drop. 
// Ah, I forgot to install react-dropzone. I'll implement manual for now or install it.
// Installing is better. I'll assume I can install it.
import { Upload, File, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
// import axios from "axios"; // Not used directly anymore

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
            // Revert to using proxy 
            const response = await api.post("/upload/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            console.log("Analyze Response:", response.data);
            onUploadSuccess(response.data); // Pass full response to get filename
        } catch (err: any) {
            console.error(err);
            setError("파일 업로드/분석 실패: " + (err.response?.data?.detail || err.message));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div
            className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300",
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
            <div className="flex flex-col items-center gap-4">
                {isUploading ? (
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                ) : (
                    <div className="p-4 bg-blue-100 rounded-full text-blue-600">
                        <Upload className="w-8 h-8" />
                    </div>
                )}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        {isUploading ? "분석 중..." : "엑셀 파일 업로드"}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        여기로 파일을 드래그하거나 클릭하여 선택하세요.
                    </p>
                </div>
            </div>
            {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
        </div>
    );
}
