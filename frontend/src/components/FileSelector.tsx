"use client";

import { useState, useEffect } from "react";
import { File, Trash2, RefreshCw } from "lucide-react";
import { getFileList, deleteFile } from "@/lib/api";

interface FileInfo {
    filename: string;
    size: number;
    modified: number;
}

interface FileSelectorProps {
    selectedFile: string | null;
    onFileSelect: (filename: string) => void;
}

export default function FileSelector({ selectedFile, onFileSelect }: FileSelectorProps) {
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [fileCount, setFileCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const loadFiles = async () => {
        setIsLoading(true);
        try {
            const data = await getFileList();
            setFiles(data.files);
            setFileCount(data.count);
        } catch (error) {
            console.error("Failed to load files:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

    const handleDelete = async (filename: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm(`"${filename}" 파일을 삭제하시겠습니까?`)) return;

        try {
            await deleteFile(filename);
            await loadFiles();

            if (selectedFile === filename) {
                onFileSelect("");
            }
        } catch (error: any) {
            alert("삭제 실패: " + (error.response?.data?.detail || error.message));
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">저장된 파일</h3>
                    <p className="text-sm text-gray-600 mt-1">{fileCount}/50 파일</p>
                </div>
                <button
                    onClick={loadFiles}
                    disabled={isLoading}
                    className="p-2 text-gray-400 hover:text-gray-900 transition"
                    title="새로고침"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {files.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    업로드된 파일이 없습니다
                </div>
            ) : (
                <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                    {files.map((file) => (
                        <div
                            key={file.filename}
                            onClick={() => onFileSelect(file.filename)}
                            className={`
                                p-6 cursor-pointer transition
                                ${selectedFile === file.filename
                                    ? "bg-blue-50"
                                    : "hover:bg-gray-50"
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        {selectedFile === file.filename && (
                                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                        )}
                                        <p className="font-medium text-gray-900 truncate">
                                            {file.filename}
                                        </p>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        {formatFileSize(file.size)} · {formatDate(file.modified)}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(file.filename, e)}
                                    className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="삭제"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
