"use client";

import { useState } from "react";

const MUTED = "rgba(93, 93, 93, 0.64)";
const OUTLINE = "#c4c4c4";

export default function LoginPage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim() || submitting) return;
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/site-auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                const params = new URLSearchParams(window.location.search);
                const from = params.get("from") || "/";
                // 오픈 리다이렉트 방지: 내부 경로(/로 시작)만 허용
                window.location.href = from.startsWith("/") ? from : "/";
            } else if (res.status === 401) {
                setError("비밀번호가 올바르지 않습니다.");
            } else if (res.status === 503) {
                setError("사이트 비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.");
            } else {
                setError("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
            }
        } catch {
            setError("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-5">
            <form onSubmit={handleSubmit} className="w-full max-w-sm">
                <h1 className="text-[24px] font-bold text-black mb-2">Vibe Sales</h1>
                <p className="text-[14px] mb-8" style={{ color: MUTED }}>
                    접속하려면 비밀번호를 입력하세요.
                </p>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호"
                    autoFocus
                    className="w-full h-[48px] px-4 border border-solid text-[15px] text-black mb-3 outline-none focus:border-black"
                    style={{ borderColor: OUTLINE, borderRadius: 4 }}
                />
                {error && <p className="text-[13px] text-red-600 mb-3">{error}</p>}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-[48px] bg-black text-white text-[15px] font-bold disabled:opacity-50"
                    style={{ borderRadius: 4 }}
                >
                    {submitting ? "확인 중..." : "입장"}
                </button>
            </form>
        </div>
    );
}
