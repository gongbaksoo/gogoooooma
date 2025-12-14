"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Trash2, RefreshCw, Clock } from "lucide-react";

interface ChatHistoryItem {
    id: string;
    filename: string;
    title: string;
    created_at: number;
    updated_at: number;
    message_count: number;
}

interface ChatHistoryListProps {
    onChatSelect?: (chatId: string) => void;
}

export default function ChatHistoryList({ onChatSelect }: ChatHistoryListProps) {
    const [chats, setChats] = useState<ChatHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadChats = async () => {
        setIsLoading(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${API_URL}/chat/list`);
            const data = await response.json();
            setChats(data.chats || []);
        } catch (error) {
            console.error("Failed to load chat history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadChats();
    }, []);

    const handleDelete = async (chatId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm("이 대화를 삭제하시겠습니까?")) return;

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            await fetch(`${API_URL}/chat/${chatId}`, {
                method: "DELETE",
            });
            await loadChats();
        } catch (error) {
            console.error("Failed to delete chat:", error);
            alert("대화 삭제에 실패했습니다.");
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (hours < 1) return "방금 전";
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;

        return date.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    저장된 대화 ({chats.length})
                </h3>
                <button
                    onClick={loadChats}
                    disabled={isLoading}
                    className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
                    title="새로고침"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {chats.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    저장된 대화가 없습니다.
                </div>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {chats.map((chat) => (
                        <div
                            key={chat.id}
                            onClick={() => onChatSelect?.(chat.id)}
                            className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 truncate">
                                        {chat.title}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="w-3 h-3" />
                                            {chat.message_count}개 메시지
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(chat.updated_at)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        📄 {chat.filename}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(chat.id, e)}
                                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                                    title="삭제"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
