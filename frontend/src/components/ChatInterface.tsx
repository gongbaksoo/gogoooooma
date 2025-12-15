"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface Message {
    role: "user" | "bot";
    content: string;
}

interface ChatInterfaceProps {
    filename: string;
}

export default function ChatInterface({ filename }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: "bot", content: "안녕하세요! 업로드된 데이터에 대해 궁금한 점을 물어보세요." },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chatId] = useState(() => `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const saveChatHistory = async (currentMessages: Message[]) => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

            // Generate title from first user message
            const firstUserMessage = currentMessages.find(m => m.role === "user");
            const title = firstUserMessage
                ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
                : "새 대화";

            await fetch(`${API_URL}/chat/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: chatId,
                    filename: filename,
                    title: title,
                    messages: currentMessages,
                    created_at: Date.now() / 1000,
                    updated_at: Date.now() / 1000
                })
            });
        } catch (error) {
            console.error("Failed to save chat:", error);
        }
    };

    // API key is set in Railway environment variables
    // No need to check status on frontend

    // Admin key management removed - API key is set in Railway environment

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await api.post("/chat/", {
                filename,
                query: userMessage,
                api_key: "server_managed", // Signal backend to use stored key
                history: messages, // Send conversation history for context
            });

            const botResponse = response.data.response;
            setMessages((prev) => {
                const updatedMessages: Message[] = [...prev, { role: "bot" as const, content: botResponse }];

                // Auto-save after AI response
                saveChatHistory(updatedMessages);

                return updatedMessages;
            });
        } catch (error: any) {
            console.error("Chat error:", error);
            const errorMessage =
                error.response?.data?.detail || "죄송합니다. 오류가 발생했습니다.";
            setMessages((prev) => [
                ...prev,
                { role: "bot", content: `❌ 오류: ${errorMessage}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] border rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Header */}
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-700">AI 분석 챗봇</h3>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={cn(
                            "flex w-full items-start gap-2",
                            message.role === "user" ? "justify-end" : "justify-start"
                        )}
                    >
                        {message.role === "bot" && (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot className="w-5 h-5 text-blue-600" />
                            </div>
                        )}
                        <div
                            className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                message.role === "user"
                                    ? "bg-blue-600 text-white rounded-tr-none"
                                    : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                            )}
                        >
                            <div className="prose prose-sm max-w-none break-words dark:prose-invert">
                                <ReactMarkdown
                                    components={{
                                        // Style tables in markdown
                                        table: ({ node, ...props }) => (
                                            <table className="border-collapse border border-gray-300" {...props} />
                                        ),
                                        th: ({ node, ...props }) => (
                                            <th className="border border-gray-300 px-4 py-2 bg-gray-100" {...props} />
                                        ),
                                        td: ({ node, ...props }) => (
                                            <td className="border border-gray-300 px-4 py-2" {...props} />
                                        ),
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                        {message.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                                <User className="w-5 h-5 text-gray-600" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <span className="text-sm text-gray-500">분석 중입니다...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
                {/* API key warning removed - key is set in Railway environment */}
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="데이터에 대해 무엇이든 물어보세요..."
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>

            {/* Admin modal removed - API key is managed in Railway environment */}
        </div>
    );
}
