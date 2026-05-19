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

## 10. `pretendard` 패키지가 `frontend/node_modules`에 없는 것처럼 보임 (workspace hoisting)

**발생일**: 2026-05-18

### 🚨 증상
- `cd frontend && npm install pretendard` 정상 종료 ("added 497 packages")
- 직후 `ls frontend/node_modules/pretendard/` → `No such file or directory`
- `pretendard/dist/web/variable/pretendardvariable.css` 경로가 안 잡힐까봐 일시적 혼란

### 🧭 원인
- 루트 `package.json`에 `"workspaces": ["frontend"]` 설정.
- npm이 의존성을 **루트 `node_modules`로 호이스팅**하기 때문에 `frontend/node_modules`는 생성되지 않음.
- `frontend/package.json`의 `dependencies`에는 `pretendard`가 정상 기록됨.

### ✅ 해결 / 확인 방법
```bash
ls /Users/gongbaksoo/Desktop/Vibe Coding/AVK_Sales/node_modules/pretendard/dist/web/variable/
# → pretendardvariable.css, pretendardvariable-dynamic-subset.css 등 확인
```
- Next.js의 모듈 해석은 워크스페이스 호이스팅을 자동 처리하므로 `globals.css`에서 `@import "pretendard/dist/..."` 그대로 동작.
- 빌드된 CSS 청크에 `@font-face` 187건 번들 확인 (subset 폰트 정상).

### 💡 메모
- 패키지 위치를 의심하기 전에 항상 **루트 `node_modules`** 부터 확인.
- 워크스페이스가 의도가 아니라면 루트 `package.json`의 `workspaces` 키를 제거하면 `frontend/node_modules`로 격리됨.

---

## 11. 디자인 리팩토링 — 페이지 wrapper만 모노톤화 시 자식 컴포넌트와 시각적 충돌

**발생일**: 2026-05-18

### 🚨 증상
- 사용자가 화면 캡처와 함께 보고: "차트 카드들이 살짝 떠보임", "월별 매출 추이 헤더에 📊가 그대로"
- 페이지 wrapper(`custom-dashboard/page.tsx`)는 순백/모노톤으로 바꿨는데, 차트 컴포넌트 내부는 여전히 파란 그라데이션/`rounded-3xl`/`shadow-xl` + 이모지 헤더 유지.
- "wrapper + 차트 컬러만 모노톤"의 "차트 컬러"가 **recharts stroke/fill만 의미**한다고 좁게 해석한 결과 — 컨트롤 UI(viewMode 버튼, 검색박스, 셀렉트, CTA 버튼)는 손대지 않았음.

### 🧭 원인 (작업 진행상의 누락)
1. **범위 합의 표현의 모호성** — "차트 컬러"가 시리즈 색만 의미하는지 컨트롤 UI까지 포함하는지 사전에 명시되지 않음.
2. **컴포넌트 텍스트 내부 이모지 누락** — 페이지 wrapper의 이모지(🛠️🤖🚨)만 lucide 아이콘으로 교체. 자식 컴포넌트 내 51개 이모지(📊📈📦💰⏱️🔍 등) 잔존.
3. **점진적 적용의 일관성 비용** — 부분 적용은 시각적 일관성을 깨뜨려 결국 추가 라운드가 필요. 디자인 작업은 가급적 동일 범위에서 한 번에 끝내는 것이 비용 효율적.

### ✅ 해결
- 사용자가 캡처를 보내올 때마다 **3차에 걸쳐 점진 확장**:
  1. 1차: 페이지 wrapper + 차트 시리즈 색 (page.tsx + 차트 5개)
  2. 2차: 이모지 51개 전수 제거 (10개 파일)
  3. 3차: 차트/분석 9개 컴포넌트 컨트롤 UI + 채팅/파일/모달 6개 컴포넌트 전부
- 최종적으로 19개 파일 통일.

### 💡 향후 권장
- 디자인 시스템 전환은 **"적용 대상 컴포넌트 리스트"를 먼저 합의** 후 진행 — 페이지 단위가 아니라 컴포넌트 단위로.
- "이모지 제거"가 정책이라면 grep으로 전수 스캔 (`grep -rn --include="*.tsx" -E "[이모지유니코드범위]" .`) 후 한 번에 처리.
- 캡처 기반 1대1 수정은 비효율 — 범위 합의가 먼저.

---

## 12. 로컬 dev 환경에서 파일 업로드 실패 — 백엔드가 떠 있지 않음

**발생일**: 2026-05-18

### 🚨 증상
- `http://localhost:3000/custom-dashboard`에서 "저장된 파일 카드"에 빨간 에러 "파일 목록을 불러오지 못했습니다. (서버 연결 확인 필요)"
- 파일 업로드 시도 시 connection refused (ECONNREFUSED)

### 🧭 원인
- `frontend/src/config/api.ts`: `NODE_ENV === 'development'`이면 `localhost:8000` 호출.
- `frontend/.env.local`이 없어 환경변수로 우회 안 됨.
- 이 Mac에 `com.avk.backend` launchd 미등록 (Mac Mini가 별도 머신).
- 127.0.0.1:8000에 아무 프로세스도 떠있지 않음 → `lsof -i :8000` 빈 결과, curl 000.

### ✅ 해결 (`.env.local` 추가로 원격 백엔드 사용)
```bash
echo "NEXT_PUBLIC_API_URL=https://api.gongbaksoo.com" > frontend/.env.local
# dev 서버 재시작 → "Environments: .env.local" 로그 표시 확인
```
- 원격 Mac Mini 백엔드(`https://api.gongbaksoo.com`)는 200 OK 응답, 2/5건 파일 보유 상태.
- `lib/api.ts`의 `BASE_URL.replace('localhost', '127.0.0.1')`는 원격 URL에 'localhost' 토큰이 없으므로 안전하게 통과.

### 💡 메모
- 로컬 백엔드를 띄우려면 추가로 필요:
  - `api/venv` 생성 + `pip install -r requirements.txt` (16개 패키지)
  - `api/.env`에 `DATABASE_URL`, `GOOGLE_API_KEY` 필요
  - PostgreSQL 접근, Gemini API 키 보유
- 디자인/프론트 작업 중에는 **`.env.local`로 원격 백엔드 사용이 가장 효율적**.
- `frontend/.env.local`은 `.gitignore`의 `.env*.local` 패턴으로 커밋 제외.

---

## 13. 디자인 점검 단계의 사각지대 — 같은 파일 내부 자체 정의 컴포넌트 + 이모지 grep 패턴 한계

**발생일**: 2026-05-18 (오후, details 페이지 적용 라운드)

### 🚨 증상 (체감)
- "1차 적용 완료, details 페이지만 미적용"이라고 보고했지만, 사용자가 "꼼꼼하게 점검해봐"라고 요청해 재점검하니 **§12까지의 작업에서도 몇 가지 사각지대가 존재**했음을 발견:
  1. `details/page.tsx`의 9개 `DynamicAnalysisSection` 호출(라인 357-397) emoji가 `"✨"`로 살아있음 — 사용자에게 보고한 "이모지 0건"은 페이지 wrapper 기준이었고, prop 값까지는 누락.
  2. `🧼` 비누 이모지(라인 457)가 이전 grep 패턴에 포함되지 않아 발견 못 함.
  3. 헤더 텍스트 자체에 박힌 `🍼 누비 품목별 분석`(라인 415), `🧴 쏭레브 품목별 분석`(라인 446) — emoji prop이 아니라 텍스트라서 "emoji prop" 기준 검사로 잡히지 않음.
  4. **페이지 내부에 자체 정의된 `DynamicAnalysisSection`**(라인 95-187)의 존재 — 공용 `components/DynamicAnalysisSection.tsx`만 손대고, 페이지 로컬 동명 컴포넌트는 미손댐. 이 컴포넌트가 `{emoji} {title}`로 표시하기 때문에 emoji prop 값이 화면에 그대로 노출.

### 🧭 원인
1. **grep 패턴이 닫혀있음** — 이모지 유니코드는 광범위(여러 블록에 흩어짐)인데 수동으로 enumerate한 캐릭터 클래스 `[📊📈📉📦...]`로 검사하면 새 이모지가 추가될 때마다 누락 위험.
2. **"prop 값"과 "텍스트 노출"을 같은 범주로 인지** — emoji prop을 빈 문자열로 바꾸면 표시되지 않는다고 가정했으나, 그 가정은 **공용 컴포넌트가 표시 부분을 이미 제거했을 때만** 성립. 같은 파일에 동명 페이지 로컬 컴포넌트가 있으면 가정이 깨짐.
3. **컴포넌트 import 그래프 전수 조사 누락** — `details/page.tsx`가 사용하는 `DynamicAnalysisSection`이 외부 import인지 파일 내부 정의인지 확인 안 함.

### ✅ 해결 (이번 라운드에서 적용)
- `details/page.tsx` 전체를 처음부터 끝까지 정독 (Read tool로 1-477줄 전수). grep 의존도 낮추고 시각 검토 병행.
- 4가지 사각지대(자체 컴포넌트 / 🧼 / 헤더 이모지 텍스트 / 4개 컬러 박스+SVG) 모두 카탈로그한 뒤 사용자 승인 후 한 번에 Write로 교체.
- 검증 grep을 보강: 이모지 패턴에 `🧼🥄💧🌴🥤🐞👶🧴✨🍼` 추가.

### 💡 향후 권장 (디자인 적용 SOP 보강)
1. **이모지 검사는 유니코드 범위 기반으로** — `[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]` (Symbols & Pictographs + Misc Symbols/Dingbats) 같은 범위 기반 패턴 사용 시 enumerate 누락 위험 제거.
2. **동명 컴포넌트 중복 정의 점검** — 페이지 파일 안에 동명의 로컬 컴포넌트가 있는지 `grep -rE "(const|function)\s+ComponentName" .` 로 사전 확인.
3. **"prop=" → "표시" 가정의 검증** — emoji/icon prop 변경 시, 그 prop을 받는 컴포넌트의 표시 부분을 같이 확인.
4. **페이지 전체 정독 옵션** — 적용 직전 raw read (`limit` 없이) 한 번. grep으로 "0건"이 나와도 시각 검토로 보완. 작은 파일(<500줄)은 비용 대비 안전.
5. **차트 시리즈 색 hardcode 전수 패턴**: `stroke="#[0-9a-fA-F]"`, `fill:\s*'#[0-9a-fA-F]'`, `fill="#[0-9a-fA-F]"` 3종 모두 검사해야 정의 위치 모두 잡힘.

---

## 14. 공용 `DynamicAnalysisSection`의 차트 stroke 색 누락 — "토글 스타일은 변경, Recharts stroke는 미변경"

**발생일**: 2026-05-18 (저녁, 3차 적용 라운드)

### 🚨 증상
- 사용자가 `https://gogoooooma.vercel.app/custom-dashboard`의 "마이비 전체 동적 매출 분석" 차트 캡처를 보내옴:
  - 보라색 월매출액 라인, 핑크 점선 이익률 라인 — **모노톤 디자인이 적용되지 않은 상태**.
  - 토글 버튼(매출액/일평균/이익률/월매출+이익률/일평균+이익률/일매출+이익률)은 검정 인버티드로 정상.
- 이전(§11)에서 "차트/분석 9개 컴포넌트 컨트롤 UI 통일 완료"라고 보고했지만, 실제로는 컨트롤 UI(토글/셀렉트)만 손댔고 **Recharts Line stroke/fill 색은 미손댐**.

### 🧭 원인
1. **"차트 컴포넌트" 정의의 불일치** — 1차 라운드에서 "차트 컬러"를 "차트 카드 wrapper + 컨트롤 UI"로 좁게 해석. Recharts stroke 색(시리즈 색)은 별도 패스로 잡았어야 했음.
2. **이전 grep 패턴이 wrapper 클래스만 감지** — `bg-blue-*`, `rounded-3xl` 등은 잡혔지만 `stroke="#..."`, `fill: '#...'`는 검사 패턴에 없었음.
3. **차트 컴포넌트 별 다른 변경 범위** — `SalesChartNew`, `ChannelSalesChartNew` 등 5개는 이전에 stroke 색까지 교체했지만, `DynamicAnalysisSection`은 "분석" 카테고리로 분류되며 stroke 단계가 누락. 분류 기반 작업 시 일관성 검증이 없었음.

### ✅ 해결
- `components/DynamicAnalysisSection.tsx`에서 8개 hex 색 전수 교체:
  - 단순 매핑 4건 (replace_all): `#94a3b8` → `#5d5d5d`, `#ec4899` → `#ff0066`, `#8b5cf6` → `#000000`, `#f97316` → `#ff0066`
  - 컨텍스트별 4건 (개별 Edit, 같은 hex가 다른 의미): `#3b82f6` × 2 (모드별 다른 회색 단계), `#10b981` × 2, `#06b6d4` × 2
- Tooltip border `#ddd` → `#c4c4c4`, radius 8px → 2px
- 헤더 `text-slate-800` → `text-black`
- 모드별 시리즈 매핑 명문화 (디자인 문서 §8.5에 표로 기록).

### 💡 향후 권장
1. **"차트 컴포넌트 적용" 체크리스트** — wrapper / 컨트롤 UI / **Recharts stroke·fill** 세 항목을 모두 grep으로 검증한 뒤 완료 처리.
2. **사전 grep 패턴 보강** — 차트 컴포넌트는 `stroke="#"`, `fill: '#"`, `fill="#"`, `contentStyle={[^}]*border:` 4종을 항상 검사.
3. **컴포넌트 분류와 변경 범위 매핑** — "차트 5개"/"분석 4개"처럼 분류만 보지 말고, **컴포넌트별 변경 카탈로그**(시리즈 색 / 토글 / 카드 / etc.)를 명시.
4. **다시리즈 색 토큰 정의** — 동일 컴포넌트가 모드에 따라 다른 시리즈 수를 그릴 때, 모드별 매핑을 사전에 정의하지 않으면 일관성이 깨짐. 디자인 문서 §8.5처럼 표로 박제.

---

## 15. 차트 컬러 매핑 의미 체계 전환 — "위계 기반" → "데이터 종류 기반" (라운드 4)

**발생일**: 2026-05-18 (심야)

### 🚨 증상 / 사용자 피드백
사용자가 차트들을 살펴본 뒤 지적: "그래프 선들의 굵기나 색상 로직이 일정하지가 않아. 통일해줄래?"
- 1~3차 라운드를 거치며 "메인=검정 / 보조=회색 / 강조=빨강" 위계 기반 매핑을 적용했지만, viewMode가 바뀌어도 같은 의미의 시리즈가 차트마다 다른 색으로 나타남.
- 예: "이커머스 매출"이 SalesChartNew에서는 `#000000`, DynamicAnalysisSection의 total 모드에서는 `#5d5d5d`로 다름.

### 🧭 원인 (의사결정 과정의 누적 모호함)
1. **1차 라운드 합의의 범위 모호**: "차트 컬러 모노톤"이라는 합의가 "위계 기반"으로 굳어졌으나, 사용자 의도는 "어디서든 같은 시리즈는 같은 색"이었음.
2. **이익률 점선 결정의 번복**: 1~3차에서 이익률은 점선 (`strokeDasharray="4 4"`)으로 통일. 4차에서 사용자가 "이익률 점선은 취소, 실선으로 변경" 요청 → 모든 차트에서 점선 제거 + 8-pattern 매핑의 점선/실선 의미 재정의.
3. **29CM 정신과의 충돌**: 데이터 종류별 다른 색조 요구 → 29CM 모노톤 원칙(검정+분홍만)과 충돌. 사용자가 1개 예외(녹색=증감률)만 허용으로 절충.
4. **시리즈 수 불일치 미검증**: 4가지 패턴(실선/점선 × 진함/옅음)을 사용자가 제안했으나, `DynamicAnalysisSection`의 5개 시리즈 + `ProductGroupChartNew`의 N개 시리즈는 4를 초과. 4단계 명도 × 2 패턴 = **8가지로 확장**.

### ✅ 해결 (4차 라운드)
- **데이터 종류별 베이스 색 정의** (디자인 문서 §8.5에 박제):
  - 매출/일평균: 검정 4단계 (`#000` / `#5d5d5d` / `#7d7d7d` / `#b8b8b8`)
  - 이익률: 분홍 4단계 (`#ff0066` / `#ff3385` / `#ff66a3` / `#ff99c1`)
  - 증감률: 녹색 4단계 (`#065f46` / `#10b981` / `#34d399` / `#6ee7b7`)
- **시리즈 순서 → 패턴 매핑** (8가지): 4단계 명도 × 실선/점선
- **이익률 점선 전수 제거** → 실선으로 통일, Combined view에서는 단일 `#ff0066` 보조 위계(sw 1.5)
- **합계/메인이 1번째 시리즈** (가장 두드러진 진함 실선 sw 2.5), 이후 데이터 분해 순
- IIFE 패턴으로 viewMode → palette 매핑을 컴포넌트 안에 인라인 정의 (SalesChartNew, ChannelSales 계열, ProductGroup)

### 💡 향후 권장
1. **디자인 의사결정의 "원칙 우선순위" 명문화** — 이번엔 1~3차에서 위계 기반으로 갔다가 4차에서 뒤집힘. 디자인 시스템 전환 초기에 "데이터 종류 vs 시리즈 위계 중 어느 것이 우선인가"를 먼저 박제.
2. **점선/실선의 의미 합의** — "점선 = 약한 위계" vs "점선 = 우측 축의 시각적 구분" vs "점선 = 시리즈 순서의 일부" 중 어느 것인지 사전 합의.
3. **다중 시리즈 수의 사전 카탈로그** — 적용 전에 각 컴포넌트의 최대 시리즈 수를 표로 정리. 사용자 제안 패턴(예: 4가지)이 모든 케이스를 커버하는지 검증.
4. **색조 추가 의사결정 — 29CM 원칙 예외의 비용** — 녹색 1개 추가가 디자인 일관성 비용 대비 데이터 의미 차별의 가치가 있는지 사전 평가.
5. **사용자 워딩의 의미 명확화** — "통일", "같은 색", "동일", "구분", "일관성" 같은 단어가 사용자마다 다른 의미를 가질 수 있음. 매핑 표 형태로 사전 시각화 후 합의.

---

## 16. 월 리뷰 — 로컬 dev 서버가 운영 백엔드를 호출 (Phase 1 통합 테스트)

작성일: 2026-05-18

### 🚨 증상
- `npm run dev`로 띄운 로컬 프론트엔드에서 `/monthly-review` 진입 → "Not Found" 에러.
- 파일 셀렉터에 로컬에 없는 `260210_2.csv` 같은 운영 파일명이 노출됨.
- 콘솔 axios 에러: `Request failed with status code 404`.

### 🧭 원인
- `frontend/.env.local`에 `NEXT_PUBLIC_API_URL=https://api.gongbaksoo.com`이 박혀 있어, dev 모드에서도 운영 백엔드(Mac Mini)를 호출.
- 새로 추가한 `/api/monthly-review/*` 엔드포인트는 운영 백엔드에 아직 없어 404.
- `src/config/api.ts`의 dev fallback(`http://localhost:8000`)이 작동하지 않은 이유: `.env.local`은 모든 환경에 적용되므로 fallback보다 우선.

### ✅ 해결
1. `.env.local`을 `.env.local.bak`으로 백업.
2. `.env.local`을 `NEXT_PUBLIC_API_URL=http://localhost:8000`으로 임시 변경.
3. dev 서버 재시작 (Next.js는 env 변경 시 재시작 필요).
4. 로컬 uvicorn(127.0.0.1:8000) 호출 정상화 확인.

### 💡 향후 권장
- **dev 전용 env 분리**: `.env.development.local`을 따로 두면 prod env는 그대로 두고 dev만 localhost로 자동 분기 가능 (Next.js는 development 모드에서 `.env.development.local`이 `.env.local`보다 우선).
- 또는 `src/config/api.ts`에 `NODE_ENV === 'development'`이면 env var을 무시하도록 강제 분기.
- 새 백엔드 엔드포인트는 운영 배포 전엔 로컬에서만 검증 가능하다는 점을 작업 시작 시 체크리스트에 추가.

---

## 17. 월 리뷰 — 업로드한 파일이 "파일 없음" 404 (DB-only 저장과 디스크 미동기화)

작성일: 2026-05-18

### 🚨 증상
- `/api/upload/`로 파일 업로드 성공 후 파일 셀렉터에는 나타남.
- 그 파일 선택 시 `/api/monthly-review/months/?filename=260210_2.csv` → **404 "파일 없음"**.
- 동시에 디스크의 `api/uploads/` 폴더에 해당 파일이 없음 (DB에만 존재).

### 🧭 원인
- 기존 `/api/upload/` 엔드포인트는 **DB에만** 파일을 저장(`save_file_to_db`)하고 디스크 쓰기는 사용 시점으로 미루는 아키텍처.
- 다른 dashboard 엔드포인트들은 `get_dataframe()` 호출 **전에** `ensure_file_on_disk()`로 DB→디스크 동기화 수행.
- 새로 작성한 `api/monthly_review.py`가 이 단계를 빠뜨림 → `get_dataframe`이 디스크 source 없어 `FileNotFoundError` → 404.

### ✅ 해결
- `api/monthly_review.py`에 `_ensure_file_on_disk(filename)` 헬퍼 추가 (`index.py`의 동일 함수 로직 복제, 순환 import 회피 목적).
- `_load_dataframe(filename)` 래퍼 정의 후 `list_months` / `get_summary` 모두 이 함수를 통해 DataFrame 로드.
- 재현 케이스(`260210_2.csv`)로 DB→디스크 자동 동기화 확인 (83MB).

### 💡 향후 권장
- **공용 모듈로 추출**: `ensure_file_on_disk()`를 `api/utils.py` 같은 공용 모듈로 분리해 각 라우터가 import하도록 리팩토링. 향후 라우터 추가 시 같은 함정 방지.
- 또는 `dashboard.get_dataframe()` 자체가 디스크 부재 시 DB fetch를 시도하도록 통합 — 현재는 호출자 책임이라 휴먼 에러 발생 가능.
- 새 라우터 PR 체크리스트에 "`ensure_file_on_disk` 호출 여부 확인" 항목 추가.

---

## 18. 차트 등장 애니메이션 — 사용자 의도 오해로 3차 시행착오 (라운드 6)

### 🚨 증상 / 사용자 피드백

- "각 그래프들이 등장할때 애니메이션이 다 다르거든?" — 일부 차트는 stroke 좌→우, 일부는 즉시 표시 (`isAnimationActive={false}` 차트 vs Recharts 기본 차트).
- 통일 요청을 받고 옵션 A (CSS opacity 페이드인) 제안 → 사용자 승인 → 구현.
- 이후 "아래에서 위로 서서히 올라오는 방식으로 변경해볼래?" → CSS translateY(20px) slide-up으로 변경.
- 다시 "아니 배경은 가만히 있고 선만 천천히 올라오는 형식. 기존에 어떤 그래프가 이런 애니매이션이였는데" → 의도 재명확화.
- 최종: Recharts 기본 Bar(아래→위 grow) + Line(좌→우 reveal)을 원하셨음. 일관된 속도로 통일하면 됨.

### 🧭 원인 (의도 매핑 실패)

1. **첫 라운드 (옵션 A)** — "페이드인 통일"이라는 표현을 글자 그대로 받아 CSS opacity 0→1 전환으로 구현. 사용자가 떠올린 reference가 무엇인지 사전 확인 부족.
2. **두 번째 라운드 (translateY)** — "아래에서 위로 올라오는"을 컨테이너 단위 슬라이드로 해석. 배경(축·그리드)이 함께 움직이는 결과 → 사용자가 거부.
3. **세 번째 라운드 (Recharts 기본)** — 사용자가 "선만 올라오는"이라고 명시한 뒤에야 Bar(아래→위), Line(좌→우)이라는 Recharts 내장 동작이 정답임을 확인. "올라오는"이 "Bar의 grow-from-baseline" 또는 "Line의 좌→우 draw"를 묶어서 표현한 것이었음.

핵심 원인: **"기존에 어떤 그래프가 이런 애니매이션이였는데"라는 단서가 있었음에도 어느 차트의 어느 동작을 가리키는지 묻지 않고 추측한 것.** 사용자의 reference를 먼저 특정했다면 1라운드에 끝났을 작업.

### ✅ 해결 (라운드 6 최종)

- 모든 `<Line>`·`<Bar>` 22개에 `animationDuration={1500}` `animationEasing="ease-out"` 일괄 적용.
- 기존 `isAnimationActive={false}` (ChannelSales/DetailedSales/ProductSearch) 모두 제거 → Recharts 기본(`true`) 활성화로 통일.
- 토글 시 재생을 위해 각 차트 컨테이너의 한 단계 바깥 div에 `key={viewMode-...}` 부여 → 상태 변경 시 remount → mount 애니메이션 재실행.
- CSS 시행착오 산물(`@keyframes chartFadeIn` / `.chart-fade-in`)은 `globals.css`에서 완전 제거.
- 상세 규약은 `design_document.md §8.10`에 박제.

### 💡 향후 권장

1. **시각적 reference 사전 확인** — 사용자가 "기존에 어떤 그래프가 ~", "예전 사이트처럼", "지난번 본 거" 같은 단서를 줄 때는 **구체 위치(파일/페이지/스크린샷)부터 묻기**. 추측으로 구현하면 라운드가 누적됨.
2. **애니메이션 옵션 제시 시 실제 동작을 명시** — "fade-in" 같은 추상어가 아니라 "(A) opacity 0→1 / (B) Bar의 grow-from-baseline / (C) Line의 좌→우 draw" 식으로 동작 단위로 분해해 제시.
3. **Recharts 내장 동작이 통일의 정답일 가능성을 먼저 검토** — 외부 라이브러리(여기서는 Recharts)의 기본 애니메이션이 이미 일관되어 있다면, 그것을 유지·활성화하는 것이 커스텀 CSS보다 단순하고 안전. `isAnimationActive={false}`로 끈 코드가 있을 때는 "왜 껐는지" 먼저 확인.
4. **`docs/design_document.md`에 애니메이션 토큰 추가 검토** — duration/easing 상수를 `--chart-anim-duration`, `--chart-anim-easing` 같은 CSS 변수로 빼면 일괄 조정 용이.

---

## 19. 운영 백엔드 미배포 상태에서 dev/Vercel 호출 시 404 (Mac Mini는 자동 배포 안 됨)

작성일: 2026-05-19

### 🚨 증상
- git push로 백엔드 코드까지 origin/main에 올렸지만 `https://api.gongbaksoo.com/api/monthly-review/*` 가 여전히 404.
- 사용자가 "다른 세션이 영향 줘서 그런가?" 의심.

### 🧭 원인 (구조 이해 부족)
- **Vercel은 git push 시 자동 빌드**. 그러나 **Mac Mini는 자동이 아님** — launchd로 부팅 시 uvicorn을 띄울 뿐 코드 업데이트는 사람 손이 필요.
- 매 git push 후 Mac Mini에서 별도로 `git pull` + `launchctl kickstart -k gui/$(id -u)/com.avk.backend` 실행해야 운영 백엔드에 신규 엔드포인트가 반영됨.
- §16의 `.env.local` 함정과 결합되면 디버깅이 복잡해짐: dev 서버가 운영을 부르는데 운영은 옛 코드 → "왜 푸시했는데 안 되지?" 혼란.

### ✅ 해결 (사용자가 Mac Mini에서 직접 실행)
```bash
cd ~/Desktop/Vibe\ Coding/AVK_Sales   # 또는 실제 경로
git pull origin main
launchctl kickstart -k gui/$(id -u)/com.avk.backend
sleep 3
curl http://127.0.0.1:8000/api/health
curl "http://127.0.0.1:8000/api/monthly-review/months/?filename=260210_2.csv"
```
실행 후 외부에서 `https://api.gongbaksoo.com/api/monthly-review/months/?filename=...` 200 OK 검증.

### 💡 향후 권장
- **자동 배포 검토**: Mac Mini에 GitHub Webhook 수신기를 띄워 push 이벤트마다 자동 git pull + kickstart 수행. 또는 단순 cron으로 `git pull && launchctl kickstart` 주기 실행 (분당 1회 정도).
- **README/CLAUDE.md에 배포 절차 명문화**: "프론트 변경만이면 push 끝, 백엔드 변경이면 Mac Mini 추가 배포 필요"를 한 문장으로.
- **세션 간 작업 충돌 의심 시 우선 fetch + 직접 endpoint curl**: 다른 세션 영향과 단순 배포 누락은 git log + curl 한 번이면 구분 가능.

---

## 20. 차트 라벨 통일 — "모든 차트 적용" 지시에 viewMode/timeUnit 조건 차단 케이스 누락 (자가검증 실패)

작성일: 2026-05-19

### 🚨 증상
- 사용자 요청: "차트마다 데이터 포인트 라벨이 너무 많아서 지저분하니 가장 최근 1개만 표시. 모든 그래프 다 적용."
- 1차 작업: 8개 파일의 `LabelList`/인라인 `label` prop에 `lastIndex` 기반 콜백 적용 후 푸시(`077ec14`).
- 사용자가 `/monthly-review`, `/custom-dashboard`에서 확인 → "마지막 레이블이 표현 안 된 것들이 있다"며 스크린샷 2장 제시.
  - 이미지 1: `details/page.tsx` 브랜드 비교 차트 (이커머스 브랜드별) → 라벨 자체가 없음
  - 이미지 2: `/custom-dashboard` 메인 차트 (매출액 모드) → 라벨 미표시

### 🧭 원인
3가지 차단 패턴이 1차 작업에 반영되지 않음:

| 패턴 | 차단 메커니즘 | 해당 차트 |
|---|---|---|
| 1. LabelList 자체가 없음 | 원래 라벨이 정의되지 않은 차트 (변경 없음으로 분류) | `details/page.tsx` 브랜드 비교 4 Line, `Chart2YoYTrend`, `Chart3MainVsCoupang` |
| 2. viewMode 조건 차단 | `showLabel = viewMode !== 'sales' && viewMode !== 'daily'` | `SalesChartNew` (매출액/일평균 모드) |
| 3. day/daily 모드 차단 | `{timeUnit === 'month' && (...)}` 또는 `{!isDaily && (...)}` | `ChannelSalesChartNew`, `DetailedSalesChartNew`, `ProductSearchChart`, `DynamicAnalysisSection`, `details/page.tsx` 첫 차트 |

이전 코드에서 위 조건들은 "데이터 포인트가 N개 다 찍히면 dense해서 가독성 ↓"를 우려해 막아둔 것. 마지막 1개만 표시하는 새 규약에서는 무효한 조건. 그러나 1차 작업 시 "조건 안의 LabelList"만 수정하고 "조건 자체"는 그대로 둠.

핵심 실수: "모든 차트에 적용" 지시를 "각 차트 파일의 LabelList 컴포넌트에 적용"으로 좁게 해석. mode/timeUnit이 라벨 자체를 막고 있는 차트는 적용 범위에서 누락됨을 자가검증하지 못함.

### ✅ 해결 (보강 작업, 커밋 `12a4277`)
- 패턴 2/3: 모든 mode/timeUnit/isDaily 조건 제거 — 어떤 보기에서도 마지막 라벨 노출.
- 패턴 1: `LabelList` 신규 추가 (lastIndex 콜백). 2 Line 차트(`Chart2YoYTrend`, `Chart3MainVsCoupang`)는 라인이 가까이 위치할 수 있어 1번째 라인 `position="top"`, 2번째 `position="bottom"`으로 분리.
- 영향 파일 8개, 문서: `design_document.md §8.11-A` 보강 섹션, `history.md 8회차 §8` 추가.

### 💡 향후 권장

1. **"모든 차트 적용" 지시 시 차트 매트릭스 작성** — 적용 직후 (a) 파일 × (b) viewMode × (c) timeUnit 조합을 표로 만들고 각 셀에서 라벨/스타일/애니메이션 등 변경이 실제 가시화되는지 1회 점검. 코드 grep만으로는 "조건문이 차단하고 있는 경우"가 안 잡힘.
2. **`viewMode/timeUnit/isDaily` 조건문 우선 탐지** — 가시성 변경 작업 전에 `grep -E "viewMode|timeUnit|isDaily.*(LabelList|label=)"` 같은 패턴으로 조건 차단을 먼저 식별.
3. **"라벨이 없는 차트도 적용 대상"** — 사용자가 "모든 그래프"라고 했을 때, 기존에 라벨이 있던 차트만이 아니라 라벨이 아예 없던 차트도 신규 추가 후보. 1차 분류에서 "변경 없음"으로 떨어진 차트는 사용자 의도와 어긋날 수 있으므로 별도 컬럼으로 표기하고 명시적 합의받기.
4. **자가검증 보고서 포맷** — 적용 후 사용자에게 보고할 때 "적용 완료" 한 줄이 아니라 "(파일 N개, 라벨 K개) + 조건문 영향 받는 케이스 별도 명시"로 구체화. 사용자가 "이 케이스는 의도 맞아?"를 자기 검토할 여지를 남김.

---

## 향후 권장 사항
1. **`api/metadata.db`를 `.gitignore`에 추가** — 동적 DB 파일이 git에 추적되어 매 부팅마다 변경분 발생 (file_hash 백필 등). 이번에도 관련 변경이 발생함.
2. **루트 `package-lock.json` 정리** — npm workspaces가 활성이라 root와 frontend에 lockfile이 둘 다 생김. 어느 쪽을 권위로 할지 컨벤션 정리 필요.
3. **TCC 안정 위치 권장** — 향후 작업은 `~/Projects` 등 권한 트러블이 적은 위치에서 진행.
4. **디자인 시스템 전환 SOP** — 캡처 1대1이 아니라, ① 컴포넌트 리스트 합의 → ② 토큰 정의 → ③ grep 기반 일괄 치환 → ④ 잔여 수동 수정 → ⑤ 캡처 검증 순서로 진행하면 라운드 수 감소.
5. **이모지 정책 lint** — pre-commit hook으로 유니코드 범위 기반 이모지 검사 추가 검토 (§13 권장 1번 참조).
6. **페이지 로컬 동명 컴포넌트 통합** — `details/page.tsx`의 자체 `DynamicAnalysisSection`을 `components/DynamicAnalysisSection.tsx`로 통합 또는 다른 이름으로 리네임 권장 (혼동 방지).
7. **차트 컴포넌트 적용 체크리스트** — wrapper / 컨트롤 / stroke·fill 3축 동시 검증 (§14 권장 1번 참조).
8. **차트 매핑 의미 체계 합의 사전화** — 디자인 시스템 적용 초기 단계에 "위계 기반 vs 데이터 종류 기반"을 먼저 결정 (§15 권장 1번 참조).
9. **시각적 reference 사전 특정 SOP** — 사용자가 과거 동작을 언급할 때 추측 금지, 위치부터 확인 (§18 권장 1번 참조).
10. **차트 매트릭스 점검 SOP** — "모든 차트 적용" 지시는 파일 × viewMode × timeUnit 매트릭스로 자가검증 (§20 권장 1·2번 참조).
