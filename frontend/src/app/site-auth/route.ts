import { NextResponse } from "next/server";
import { SITE_AUTH_COOKIE, sha256Hex } from "@/lib/siteAuth";

// 사이트 진입 비밀번호 검증 → 성공 시 HttpOnly 쿠키 발급.
// 주의: 경로를 /api/ 밖에 둔다 — vercel.json 이 /api/(.*) 를 파이썬 백엔드로 rewrite 하므로
// /api/ 아래에 두면 이 Next 라우트가 가려져 404 가 된다.
export async function POST(request: Request) {
    const sitePassword = process.env.SITE_PASSWORD;
    if (!sitePassword) {
        // 비번 미설정 시 보호가 꺼진 상태이므로 로그인 자체가 불필요
        return NextResponse.json(
            { error: "사이트 비밀번호가 설정되지 않았습니다" },
            { status: 503 }
        );
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }

    const password = typeof body?.password === "string" ? body.password : "";
    if (!password || password !== sitePassword) {
        return NextResponse.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 401 });
    }

    const token = await sha256Hex(sitePassword);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SITE_AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30일
    });
    return res;
}
