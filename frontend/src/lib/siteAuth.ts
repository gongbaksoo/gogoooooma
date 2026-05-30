// 사이트 진입 비밀번호(L1 공용 암호) 공용 헬퍼.
// 미들웨어(Edge)와 라우트 핸들러(Node) 양쪽에서 쓰므로 Web Crypto만 사용.
// 비밀번호 원문은 쿠키에 담지 않고 SHA-256 해시를 토큰으로 사용한다.

export const SITE_AUTH_COOKIE = "site_auth";

export async function sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
