import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SITE_AUTH_COOKIE, sha256Hex } from "@/lib/siteAuth";

// 사이트 진입 비밀번호 게이트 (프론트 화면만 보호).
// SITE_PASSWORD(Vercel 환경변수, NEXT_PUBLIC_ 아님)와 쿠키 해시를 대조.
export async function middleware(request: NextRequest) {
    const sitePassword = process.env.SITE_PASSWORD;

    // 비번 미설정 → 보호 비활성(사이트 열림). 배포만으로 잠겨버리는 사고 방지.
    if (!sitePassword) {
        return NextResponse.next();
    }

    const expected = await sha256Hex(sitePassword);
    const cookie = request.cookies.get(SITE_AUTH_COOKIE)?.value;
    if (cookie && cookie === expected) {
        return NextResponse.next();
    }

    // 미인증 → /login 으로 (원래 가려던 경로 보존)
    const loginUrl = new URL("/login", request.url);
    const { pathname, search } = request.nextUrl;
    loginUrl.searchParams.set("from", pathname + search);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    // 프론트 "화면"만 보호. /api/*(백엔드 rewrite·업로드), /site-auth(로그인 처리),
    // Next 내부/정적 자산, favicon, /login 은 게이트에서 제외.
    matcher: ["/((?!api|_next|favicon.ico|login|site-auth).*)"],
};
