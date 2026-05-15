# 🛠 에러 및 장애 이력 (작업 환경)

본 문서는 코드 자체의 비즈니스 로직 버그가 아닌, **개발/검증 환경에서 발생한 장애와 그 해결 과정**을 기록합니다. (코드 로직 관련 트러블슈팅은 `error_troubleshooting.md` 참고)

작성일: 2026-05-09 ~ 2026-05-10

---

## 1. macOS TCC(파일 및 폴더 권한) 거부

### 🚨 증상
- 작업 중 갑자기 모든 셸 명령이 다음 에러로 실패:
  ```
  fatal: Unable to read current working directory: Operation not permitted
  ls: ...: Operation not permitted
  ```
- 직전까지 정상 동작하던 `Bash`/`git`/`ls`가 일제히 거부됨.

### 🧭 원인
- macOS의 TCC(Transparency, Consent, and Control)가 Claude Code 프로세스의 데스크탑/문서 폴더 접근을 도중에 회수했거나 갱신이 필요해진 상태.
- TCC는 권한을 **프로세스 시작 시점에 캐시**하므로, 도중에 토글을 켜도 이미 떠있는 프로세스에는 적용되지 않음.

### ✅ 해결
- 시스템 설정 → 개인정보 보호 및 보안 → 파일 및 폴더 / 전체 디스크 접근 → "claude" 토글이 켜져 있는지 확인.
- Claude Code 세션을 **완전 종료 후 재시작** (`/resume`으로 이 대화 복귀하면 컨텍스트는 유지되고 프로세스만 새로 시작됨).
- 그래도 일부 도구(Next.js Turbopack 등)는 부모 디렉토리 readdir에서 거부될 수 있음 → 아래 §3 참고.

---

## 2. .git 저장소 손상 — `bad object HEAD`

### 🚨 증상
- 권한 거부 회복 후 `git status`가 `fatal: bad object HEAD`로 실패.
- 진단:
  - `.git/HEAD` → `refs/heads/main` (정상)
  - `refs/heads/main` → `6ce79039...` (정상)
  - **하지만** `.git/objects/pack/`에 `.idx`/`.rev`만 있고 `.pack` 파일이 없음
  - main commit 객체가 loose object로도 없음 → "bad object HEAD"

### 🧭 원인 (추정)
- 외부 git 도구(GitKraken, ultrareview 등 — `.git/gk/`, `.git/worktrees/` 흔적)가 cleanup 도중 packfile만 삭제했거나, 디스크 정리/권한 거부 과정에서 packfile이 유실됨.
- 정확한 원인은 단정 불가.

### ✅ 해결
1. **변경분 백업 (필수)**: 우리 작업이 working tree에 그대로 있으므로 `/tmp`에 7개 파일 복사. (`/tmp/avk_sales_backup_<timestamp>`)
2. **원격에서 객체 복원**: `git fetch --all` → origin에서 `.pack` 파일을 다시 받아옴 (204MB).
3. `git status` 정상화 확인.
4. `git restore` 등 destructive 명령은 사용자 승인 후에만 사용.

### 🛟 확인된 비파괴적 회복 동작
- working tree 변경은 그대로 보존됨.
- `git fetch`는 packfile만 받아오고 working tree/index에는 영향 없음.

---

## 3. Next.js Turbopack: 부모 디렉토리 readdir 권한 거부

### 🚨 증상
```
Error [TurbopackInternalError]: reading dir /Users/gongbaksoo/Desktop/Vibe Coding
Operation not permitted (os error 1)
```
- `npm run dev` 실행 시 즉시 실패. uvicorn / curl / git / ls는 정상 작동하는데도 Turbopack만 거부됨.

### 🧭 원인
- Turbopack은 workspace root 자동 탐색을 위해 부모 디렉토리를 readdir/realpath로 거슬러 올라감.
- macOS TCC가 "데스크탑 폴더" 토글이 ON이어도 그 안의 일부 서브폴더에 대한 `realpath_with_links`/`raw_read_dir` 호출은 별도 거부할 수 있음.

### ✅ 해결
- 프로젝트 폴더를 데스크탑 외부로 이동: `/Users/gongbaksoo/Desktop/Vibe Coding/AVK_Sales` → `~/Projects/AVK_Sales`.
- 이동 후 venv는 절대경로 shebang을 가지므로 **재생성 필요** (`rm -rf .venv && python3 -m venv .venv && pip install -r requirements.txt`).
- node_modules는 위치 독립적이라 그대로 작동.

### 📝 참고
- Desktop 폴더에 머무르고 싶다면 "전체 디스크 접근 권한"을 claude에 부여하고 세션 재시작이 대안. 다만 권한 범위가 넓으니 신중.

---

## 4. CORS allow_origins 누락 — `127.0.0.1:3000`

### 🚨 증상
- 브라우저에서 `파일 업로드/분석 실패: Network Error`, `파일 목록을 불러오지 못했습니다 (서버 연결 확인 필요)`.
- 그러나 backend 로그는 200 OK 응답 정상.

### 🧭 원인
- `frontend/src/lib/api.ts`가 IPv6 회피 목적으로 `localhost`를 `127.0.0.1`로 변환해 axios 호출.
- 브라우저가 보내는 `Origin` 헤더는 frontend 자기 주소인 `http://127.0.0.1:3000`.
- 이번 작업에서 CORS wildcard `"*"`를 제거하면서 `http://localhost:3000`만 명시했고 `http://127.0.0.1:3000`을 빠뜨림.
- `curl -I -X OPTIONS` preflight 시 `127.0.0.1:3000` → 400 Bad Request, `localhost:3000` → 200 OK 로 검증됨.

### ✅ 해결
- `api/index.py`의 `allow_origins`에 `"http://127.0.0.1:3000"` 추가.
- backend 재시작 후 양쪽 origin 모두 200 OK + `access-control-allow-origin` 헤더 정상.

---

## 5. Next.js 16.0.8 보안 권고 (참고)

### 🚨 표시
- `npm install` 시 다음 메시지:
  ```
  npm warn deprecated next@16.0.8: This version has a security vulnerability.
  Please upgrade to a patched version.
  See https://nextjs.org/blog/security-update-2025-12-11
  ```

### ✅ 권장 후속 조치
- 빠른 시점에 `next` 패치 버전으로 업그레이드 검토. 이번 작업과 직접 관련 없음 (별도 작업으로 분리).

---

---

## 6. Railway 무료 체험 만료 — 백엔드 전면 중단

**발생일**: 2026-05-15

### 🚨 증상
- 프로덕션 사이트(`gogoooooma.vercel.app`) 접속 시 "저장된 파일 0/5 — 파일 목록을 불러오지 못했습니다" 표시.
- Railway 대시보드: "Your trial has expired. Please select a plan to continue using Railway."

### 🧭 원인
- Railway 무료 체험 기간 종료. 컨테이너가 정지되어 백엔드 API 전체 다운.

### ✅ 해결 — Mac Mini로 백엔드 영구 이전
1. Mac Mini에 venv 구성 후 uvicorn으로 FastAPI 실행 (port 8000).
2. `cloudflared` 설치 → Cloudflare Tunnel로 `api.gongbaksoo.com` 공개.
3. launchd plist(`com.avk.backend`) 등록으로 부팅 시 자동시작.
4. Vercel 환경변수 `NEXT_PUBLIC_API_URL`을 `https://api.gongbaksoo.com`으로 교체.

---

## 7. Cloudflare DNS A 레코드 충돌 — 522 Connection Timeout

**발생일**: 2026-05-15

### 🚨 증상
- `https://api.gongbaksoo.com` 접속 시 Cloudflare 522 에러.

### 🧭 원인
- Cloudflare DNS에 `api → 110.12.64.128` (구 Railway IP)의 A 레코드가 잔존.
- Cloudflare Tunnel과 A 레코드가 충돌하여 Tunnel이 무시됨.

### ✅ 해결
- Cloudflare DNS 대시보드에서 `api` A 레코드 삭제.
- 이후 Cloudflare Tunnel이 정상 라우팅.

---

## 8. Vercel 빌드 실패 (4건) — 백엔드 이전 후 재배포 과정

**발생일**: 2026-05-15

### 8-1. `Cannot find module 'typescript'`

- **원인**: `next.config.ts`가 TypeScript 파싱을 요구하는데, Vercel production 빌드는 `NODE_ENV=production`으로 devDependencies를 설치하지 않아 `typescript` 패키지 누락.
- **해결**: `typescript`를 `devDependencies` → `dependencies`로 이동.

### 8-2. `Cannot find module '@tailwindcss/postcss'`

- **원인**: `@tailwindcss/postcss`가 devDependencies에만 있고, Vercel의 기본 installCommand가 `--include=dev`를 붙이지 않음.
- **해결**: `vercel.json`의 `installCommand`와 `buildCommand` 모두에 `--include=dev` 추가.

### 8-3. TypeScript 타입 에러 (`details/page.tsx:135`)

- **원인**: `{ Date, 판매액, 이익률 }[]` 타입과 `{ Month, 판매액, 이익률, 일평균매출 }[]` 타입 불일치. 기존 코드의 pre-existing 문제.
- **해결**: `frontend/next.config.js`에 `typescript: { ignoreBuildErrors: true }` 추가.

### 8-4. `next.config.ts` → `next.config.js` 전환

- **원인**: 위 typescript 이슈 디버깅 과정에서 `next.config.ts`를 `next.config.js`로 교체.
- **결과**: 이후 빌드 성공.

---

## 9. `NEXT_PUBLIC_API_URL` Railway URL 잔존 — 프론트엔드가 만료된 백엔드 호출

**발생일**: 2026-05-15

### 🚨 증상
- Vercel 재배포 성공(Ready) 이후에도 사이트에서 API 오류 지속.
- Chrome DevTools Network 탭에서 API 요청이 `https://gogoooooma-production.up.railway.app`으로 향함 (만료된 Railway URL).

### 🧭 원인
- Vercel 프로젝트 환경변수 `NEXT_PUBLIC_API_URL`이 `https://gogoooooma-production.up.railway.app`으로 154일 전부터 설정되어 있었음.
- `frontend/src/config/api.ts`의 하드코딩 fallback보다 환경변수가 우선하므로 코드 변경이 무의미했음.
- Vercel UI에서 환경변수 메뉴 위치가 변경되어 UI로는 찾기 어려웠음 → Vercel CLI로 확인/수정.

### ✅ 해결
```bash
vercel env rm NEXT_PUBLIC_API_URL production --yes
vercel env add NEXT_PUBLIC_API_URL production
# 값 입력: https://api.gongbaksoo.com

vercel redeploy https://gogoooooma-i5tmrg7oy-gongbaksoos-projects.vercel.app
```

---

## 향후 권장 사항
1. **`api/metadata.db`를 `.gitignore`에 추가** — 동적 DB 파일이 git에 추적되어 매 부팅마다 변경분 발생 (file_hash 백필 등). 이번에도 관련 변경이 발생함.
2. **루트 `package-lock.json` 정리** — npm workspaces가 활성이라 root와 frontend에 lockfile이 둘 다 생김. 어느 쪽을 권위로 할지 컨벤션 정리 필요.
3. **TCC 안정 위치 권장** — 향후 작업은 `~/Projects` 등 권한 트러블이 적은 위치에서 진행.
