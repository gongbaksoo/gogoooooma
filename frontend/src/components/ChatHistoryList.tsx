"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Trash2, RefreshCw, Clock, X, User, Bot } from "lucide-react";

interface ChatHistoryItem {
    id: string;
    filename: string;
    title: string;
    created_at: number;
    updated_at: number;
    message_count: number;
}

interface Message {
    role: "user" | "bot";
    content: string;
}

interface ChatDetail {
    id: string;
    filename: string;
    title: string;
    messages: Message[];
    created_at: number;
    updated_at: number;
}

interface ChatHistoryListProps {
    onChatSelect?: (chatId: string) => void;
}

export default function ChatHistoryList({ onChatSelect }: ChatHistoryListProps) {
    const [chats, setChats] = useState<ChatHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedChat, setSelectedChat] = useState<ChatDetail | null>(null);
    const [isLoadingChat, setIsLoadingChat] = useState(false);

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

    const handleChatClick = async (chatId: string) => {
        setIsLoadingChat(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${API_URL}/chat/${chatId}`);
            const data = await response.json();
            setSelectedChat(data);
            onChatSelect?.(chatId);
        } catch (error) {
            console.error("Failed to load chat:", error);
            alert("대화를 불러오는데 실패했습니다.");
        } finally {
            setIsLoadingChat(false);
        }
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
                            onClick={() => handleChatClick(chat.id)}
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

            {/* Chat Viewer Modal */}
            {selectedChat && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedChat(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedChat.title}</h2>
                                <p className="text-sm text-gray-500 mt-1">📄 {selectedChat.filename}</p>
                            </div>
                            <button
                                onClick={() => setSelectedChat(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {selectedChat.messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    {message.role === "bot" && (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <Bot className="w-5 h-5 text-blue-600" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[70%] rounded-lg p-4 ${message.role === "user"
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-100 text-gray-900"
                                            }`}
                                    >
                                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                    </div>
                                    {message.role === "user" && (
                                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-white" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setSelectedChat(null)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
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
```
