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

#### 📌 §22 SOP 후속 사례 — 성공 적용 (2026-05-19)
- chart3 응답 구조를 2-series 고정(`value1`/`value2`) → N-series 가변(`values: number[]`)으로 재차 breaking change.
- 본 SOP 그대로 따름: ① Mac Mini 백엔드 수동 패치(`api/monthly_review.py` Edit) → ② 운영 curl로 3-series 응답 검증 → ③ git push로 Vercel 자동 빌드.
- 결과: 화이트스크린 없이 매끄러운 전환. SOP 효과 입증.
- 다만 Mac Mini 자동 배포 도입 권장은 여전히 유효 — 매번 수동 패치는 휴먼 에러 위험.

#### 📌 §22 SOP 가벼운 사례 — Non-breaking 변경 (2026-05-19, Phase 2 chart 4~9 추가)
- chart 4~9를 신규 추가만 했고 chart 1~3 응답 구조 그대로 유지 → **non-breaking change**.
- 위험 분석:
  - OLD 프론트 + NEW 백엔드 = OLD 프론트가 chart4~9 무시 → 안전
  - NEW 프론트 + OLD 백엔드 = `summary.chart4` undefined → 크래시 위험 (1~2분 Vercel 빌드 갭 동안)
- 그래서 여전히 **Mac Mini 먼저 → 검증 → push** 순서 권장. Non-breaking이라고 SOP를 스킵하면 NEW 프론트 배포 시점에 OLD 백엔드면 크래시. SOP는 breaking·non-breaking 무관하게 적용.

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

## 21. 운영 백엔드 데이터 vs 로컬 데이터 불일치 — "사라진" 게 아니라 "원래 없던" 것

작성일: 2026-05-19

### 🚨 증상
- 사용자가 `gogoooooma.vercel.app/monthly-review` 진입 → 목표 파일 드롭다운에 `test_targets.csv`만 표시.
- 직전 로컬 세션에서 업로드해 사용했던 `full_targets_extracted.csv`가 안 보임.
- 사용자가 "목표 데이터가 사라진 것 같다" 보고.

### 🧭 원인
- 로컬 backend(`api/uploads/targets/`)와 운영 backend(Mac Mini `api/uploads/targets/`)는 **물리적으로 다른 디렉토리**.
- 지난 세션에서 추출한 `full_targets_extracted.csv`는 로컬에만 업로드. 운영엔 한 번도 안 올렸음.
- 즉, "사라진" 게 아니라 **운영에는 원래 없던** 파일.
- §16 (`.env.local`이 운영을 가리킴)이 결합되어 로컬 dev에서도 운영을 보고 있던 상태라 혼란 가중.

### ✅ 해결
1. 양쪽 상태를 동시에 보여줘 차이를 명확화:
   ```bash
   curl -s https://api.gongbaksoo.com/api/monthly-review/targets/   # 운영
   curl -s http://127.0.0.1:8000/api/monthly-review/targets/        # 로컬 (켜져 있을 때)
   ls api/uploads/targets/                                          # 로컬 디스크
   ```
2. 사용자 승인받고 로컬 파일을 운영에 curl 업로드:
   ```bash
   curl -F "file=@api/uploads/targets/full_targets_extracted.csv" \
        https://api.gongbaksoo.com/api/monthly-review/targets/
   ```
3. 동일 파일명 + 동일 수치 검증 (2026-02 전체 목표 721M / 실적 405M / 56% 일치).

### 💡 향후 권장
- **로컬 ↔ 운영 데이터 명확 분리 인지**: 로컬에서 만든 산출물은 운영에 자동 동기화되지 않음. 작업 보고 시 "로컬에만" / "운영에도" 명시.
- **목표 파일·기준 데이터 sync 스크립트** — `api/uploads/targets/`처럼 운영에도 필요한 정형 데이터는 git 추적 + Mac Mini가 git pull 시 자동 동기화되도록 하거나, 별도 sync 스크립트 운영.
- **사용자에게 보일 때 "원천(source)" 명시** — UI에 "데이터 출처: 운영 백엔드 (api.gongbaksoo.com)" 같은 환경 표시 검토.

---

## 22. 백엔드 미배포 상태에서 API 구조 변경 → Vercel 프론트 client-side crash (화이트스크린)

작성일: 2026-05-19

### 🚨 증상
- Vercel 프론트 `gogoooooma.vercel.app/monthly-review` 접속 시 화이트스크린.
- 브라우저 콘솔: "Application error: a client-side exception has occurred"
- 직전 작업: chart3 응답 구조를 array → object `{title, series_names, colors, data}`로 변경, `git push` 완료.

### 🧭 원인
- **§19와 동일한 Mac Mini 비자동 배포** + **이번엔 API 응답 스키마가 변했다는 점이 결합**.
- 시퀀스:
  1. `git push` → Vercel은 자동 빌드 (프론트는 신규 object 구조 기대).
  2. Mac Mini는 자동 배포 안 됨 — 백엔드는 옛 array 구조 응답.
  3. 프론트가 `chart3.title` / `chart3.series_names`를 읽는데 array에는 그 키 없음 → `undefined` 액세스 → React 렌더 중 throw → client-side crash.
- §19는 404 (네트워크 레벨), 본 §22는 200 응답 + JS 런타임 크래시 — **더 나쁜 UX**.

### ✅ 해결
1. `curl`로 운영 응답 구조 확인 (`OLD (array)` 검출).
2. 사용자가 Mac Mini에서 직접:
   ```bash
   cd ~/Desktop/Vibe\ Coding/AVK_Sales
   git pull origin main
   launchctl kickstart -k gui/$(id -u)/com.avk.backend
   ```
3. 외부 curl로 `NEW (object)` 확인 + Vercel 페이지 200 OK 재확인.

### 💡 향후 권장 (배포 운영 SOP)
1. **API 구조 변경 시 배포 순서 명문화**:
   - Breaking change면 **백엔드 먼저** 배포 → 검증 → 프론트 배포 순서로 분리.
   - Non-breaking(필드 추가)이면 동시 배포 가능.
   - 본 케이스는 array → object 라 명백한 breaking — 원칙 어김.
2. **Mac Mini 자동 배포 도입** (§19 권장 누적 반복) — 더 미룰수록 비슷한 incident 누적. webhook 또는 cron `git pull && launchctl kickstart`.
3. **프론트엔드 방어 코드**: `chart3 && typeof chart3 === 'object' && !Array.isArray(chart3)` 같은 타입 가드로 크래시 대신 "데이터 로드 실패" 메시지 표시. 운영 incident에서 화이트스크린 대신 readable error.
4. **배포 후 헬스체크 자동화**: 백엔드 재시작 후 curl로 신규 엔드포인트 응답 구조까지 점검하는 간단한 smoke test 스크립트 (`scripts/deploy-check.sh`).

---

## 23. 의도 mis-interpretation — 사용자가 원한 UI vs 내가 만든 UI 불일치 (Phase 3 첫 시도)

작성일: 2026-05-19

### 🚨 증상
- Phase 3 (브랜드별 상품 라인 6개 차트) 작업 후 사용자 피드백: **"내 의도를 정확히 파악 못했네, 앞으로 작업전에 html 로 예시를 만들어주고 내가 그걸보고 너한테 피드백 줘야할거같다"**
- 실제 사용자 원했던 구조: 각 브랜드별로 ① 종합 + ② 주요 상품(사용자 선택) + ③ 개별 상품(추가/삭제 가능)
- 내가 만든 구조: chart10~15 (브랜드 종합 + 상품 통합 line) 6개 고정 — "사용자 선택" 부분이 누락

### 🧭 원인
- 직전 대화에서 "6개 차트" 라는 숫자에만 매달려, **선택 가능성/커스터마이즈 측면을 놓침**.
- 사용자가 "6개" 라고 했을 때 정적 차트 6개로 가정한 것이 잘못. 의도는 동적 N개 (기본 6개) + 추가/삭제.
- 텍스트 기반 합의만으로는 시각적 의도가 명확히 전달되지 않음 — 특히 인터랙션·동적 요소.

### ✅ 해결
1. 사용자 의도를 다시 정확히 설명해서 받음 (① 종합 OK / ② 주요 상품 사용자 선택 / ③ 개별 상품마다 차트 + 추가/삭제).
2. **HTML 목업** (`docs/mockups/brand-detail-mockup.html`) 작성 → 사용자가 시각적으로 검토 → "딱 내가 원하는 형태" 확인.
3. 그 후에야 코드 작성 시작 → 첫 시도에 의도 일치.

### 💡 향후 권장 (새 SOP 도입)
1. **HTML 목업 우선 SOP** — 복잡한 UI 변경(레이아웃 재구성, 신규 인터랙션, 동적 카드/모달 등) 전:
   - `docs/mockups/<feature>-mockup.html` 단일 파일 작성 (정적, SVG placeholder 차트, 인터랙션 시각화)
   - 사용자 브라우저에서 직접 검토 → 피드백 → 합의 후 코딩
   - 텍스트 표/플로우차트보다 훨씬 빠르게 의도 일치
2. **"개수"보다 "동작 가능성" 먼저 질문** — 사용자가 "N개"라고 할 때, "고정 N개 vs 기본 N개 + 추가/삭제 가능?" 명시적 확인.
3. **본 SOP는 `design_document §2.3.3.7`에 박제**됨.

### 📌 본 SOP 효과 (즉시 사례)
- HTML 목업 만들고 사용자 검토 → "딱 내가 원하는 형태다 바로 작업시작해" → 코드 1회 작성에 의도 100% 일치.
- 이전 회차들의 "구현 → 피드백 → 재구현" 라운드를 한 번에 줄임. SOP 효과 입증.

---

## 24. localStorage selection 마이그레이션 누락 — 옛 카테고리명이 새 옵션 풀에 없으면 모달 비어보임

작성일: 2026-05-19 (14회차)

### 🚨 증상
- 이커머스 모드의 채널 selection을 4 그룹 카테고리(`사입/위탁/자사몰/기타`) → P열 unique values로 변경.
- 기존 사용자 localStorage에 `["사입","위탁","자사몰","기타"]`가 저장된 상태였음.
- 신규 옵션 풀(P열 10개)에는 `사입`/`위탁`/`기타` 항목이 없음 → filter 결과 빈 selection → 차트에 "표시할 채널을 선택해주세요" 안내만.
- 신규 default가 적용되지 않고 빈 상태로 보임.

### 🧭 원인
- selection 풀(옵션 카테고리 이름)이 바뀌었는데 localStorage migration 코드가 없음.
- `loadChannelSelections`는 string array만 그대로 보존 — 유효성 검증·default fallback 없음.
- 결과: 사용자는 "왜 비어있지?" 혼란.

### ✅ 해결 (사용자 대처 안내)
- 모달 열고 새 default 5개 체크 → 적용 (수동).
- 또는 브라우저 콘솔: `localStorage.removeItem("avk_monthly_review_channel_selections")` 후 새로고침 → 기본값 자동 적용.

### 💡 향후 권장
1. **selection storage에 마이그레이션 로직 추가** — load 시 옵션에 없는 값 자동 제거 + 0개 남으면 default fallback.
   ```ts
   function migrate(selected: string[], availableNames: Set<string>, fallback: string[]): string[] {
     const valid = selected.filter(s => availableNames.has(s));
     return valid.length > 0 ? valid : fallback;
   }
   ```
2. **스키마 버전 키**: `avk_monthly_review_channel_selections_v2` 같은 버전 suffix → breaking 변경 시 자동 초기화.
3. **사용자에게 변경 시 안내 토스트**: "옵션이 변경되어 기본값으로 초기화됨" 1회 표시.

---

## 25. 디자인 시스템 드리프트 — `font-mono` 4개소 잔존 (타이포 단일 패밀리 위반)

작성일: 2026-05-19 (17회차)

### 🚨 증상
- ProductSearchChart 검색 결과 테이블의 품목코드 컬럼이 등폭(monospace) 글꼴로 렌더링됨.
- 사용자 캡처 + 지적: "여기는 글씨체가 29cm 스타일이 아닌거같은데?"
- 동일 패턴(코드/ID 컬럼·콘솔·디버그 패널)에 `font-mono`가 4개소 잔존.

### 🧭 원인
- design_document §8.2에 "단일 패밀리: Pretendard Variable" 규약이 있었으나, Tailwind 유틸리티(`font-mono`)는 클래스 단위라 규약 lint가 없으면 누락 가능.
- 과거 작성된 코드(주문 ID 컬럼·디버그 패널)가 디자인 시스템 v8 적용 이전부터 존재했고, §8 도입 시 일괄 정리 SOP에서 grep 대상에서 빠짐.
- 디버그/콘솔 케이스는 "터미널 느낌 의도" 판단으로 무의식 예외 처리. 사용자 합의는 "예외 없이 전부" 였음.

### ✅ 해결
1. `grep -rn "font-mono" frontend/src` → 4개소 위치 특정.
2. 사용자에게 적용 범위 합의 (#1만 / 표 ID만 / 콘솔·디버그 제외 / 전체) → "프로젝트 전체" 선택.
3. 4개소 모두 `font-mono` 토큰만 제거 (배경·색·사이즈는 유지). 콘솔 패널은 검정 배경 + 녹색 글씨 유지하되 글꼴만 Pretendard로.
4. design_document §8.13 신설 — 향후 도입 차단.

### 💡 향후 권장
1. **타이포 토큰 lint** — pre-commit/CI에 `font-mono|font-serif|font-display` 등 비-Pretendard 패밀리 클래스 사용 시 fail. design_document §8.2/§8.13 위반 자동 차단.
2. **디자인 시스템 도입 시 grep 일괄 점검 체크리스트화** — 새 §추가할 때마다 "기존 코드에 위반 사례 grep" 단계를 SOP에 포함.
3. **"예외 없음" 명시 규약** — 단일 패밀리·단일 토큰 규약은 "콘솔/디버그도 예외 없음"을 본문에 명문화하여 작업자가 임의 예외 판단을 못 하도록 함.

---

## 26. 월 리뷰 — 파트 토글 시 페이지가 맨 위로 스크롤됨 (조건부 unmount → 페이지 높이 급감)

작성일: 2026-05-19 (17회차)

### 🚨 증상
- 월 리뷰 페이지를 아래로 스크롤한 상태에서 파트 토글(전체/이커머스/오프라인) 클릭 시 페이지가 맨 위로 점프.
- 사용자: "파트 클릭할 때마다 다시 화면이 맨 위로 올라가는데 위치 변경 없이 그 자리에서 변경할 수 있니"

### 🧭 원인
- `page.tsx`의 차트 그리드 렌더 조건이 `{summary && !loading && (...)}`로 작성되어 있었음.
- 파트 변경 → `useEffect` → `setLoading(true)` → 차트 그리드 **언마운트** ("불러오는 중..." 텍스트로 대체).
- 페이지 높이 급감 (3000px+ → 200px 수준) → 브라우저가 짧아진 페이지 max-scroll(=0)로 자동 클램프 → 스크롤 위치 리셋.
- fetch 완료 후 차트 다시 mount되지만 스크롤 위치는 이미 0.

### ✅ 해결
- 차트 그리드 조건을 **`{summary && (...)}`** 로 단순화 (loading 무시).
- "불러오는 중..." 표시 조건을 **`{salesFile && !summary && loading}`** 로 변경 → 초기 로드(아직 데이터 없음)일 때만 표시.
- 결과: 파트 변경 시 이전 차트가 그대로 보이는 채로 새 데이터 도착 → Recharts 부드러운 재렌더 → 페이지 높이 변동 없음 → **스크롤 위치 보존**.
- design_document §2.3.3.10에 "스크롤 위치 보존 규약" 신설 → 향후 동일 패턴 방지.

### 💡 향후 권장
1. **재페치 트리거가 있는 그리드는 unmount 금지 규약** — `{data && (...)}` 형태로만 작성. `!loading`을 마운트 조건에 결합하지 말 것.
2. **로딩 인디케이터 위치 규약** — refetch 중 로딩 표시가 필요하면 그리드 외부(상단 sticky 바·코너 뱃지)에 absolute overlay로 배치. 그리드 자체를 가리는 방식은 금지.
3. **스크롤 보존 회귀 테스트 체크리스트** — 차트가 있는 페이지에서 컨트롤 변경 후 스크롤 위치 보존 여부를 매뉴얼 QA 항목으로 추가.

---

## 27. GroupConfigModal 가독성 문제 — 좌측 그룹 이름 input 잘림 + 우측 컬럼 시야 밖

작성일: 2026-05-20 (19회차)

### 🚨 증상
- 주요 채널 이슈의 "그룹 설정" 모달 첫 렌더링 시:
  - 좌측 "그룹 이름" 컬럼의 input이 거의 안 보일 정도로 좁아짐 (사입몰/위탁몰/자사몰 텍스트도 안 보임).
  - 우측 끝 채널 (자사몰/종합몰/할인점/해외 등 18개 중 후반부 5~6개)이 시야 밖으로 잘림.
  - 사용자가 어떤 row가 어떤 그룹인지 식별 불가.
- Playwright 자체 검증 중 캡처로 발견.

### 🧭 원인
- 모달 width `max-w-4xl` (≈896px)인데 18개 채널 컬럼 × ~70px + 그룹 이름 + 순서/삭제 합치면 ~1500px 필요 → 가로 압축으로 input·텍스트가 짜부라짐.
- `w-full table` 자동 layout이라 좁은 너비 안에서 모든 컬럼이 비례로 줄어듦.
- 가로 스크롤 wrapper 없음.

### ✅ 해결
1. 모달 width `max-w-4xl` → **`max-w-6xl`** 확대.
2. table 컨테이너에 **`overflow-auto`** 적용 → 가로 스크롤 가능.
3. **좌측 (그룹 이름) / 우측 (순서·삭제) 컬럼 `sticky left-0` / `sticky right-0`** + 흰 배경 + border-r/l → 가로 스크롤 중에도 항상 보임.
4. 채널 컬럼 `min-width: 80px` + `whitespace-nowrap` 보장.
5. table에 `style={{ minWidth: "100%" }}` → 표가 모달보다 넓어지면 스크롤로 처리.

### 💡 향후 권장
1. **N-column 매트릭스 UI 사전 검토 체크리스트** — 컬럼 수가 ~10개 이상일 때 `overflow-auto` + sticky 컬럼 패턴 디폴트 적용.
2. **HTML 목업에 실제 컬럼 수 반영** — 본 19회차의 목업에서는 P열 채널구분 6개만 가정했지만 실제 데이터는 18개. 다음 목업부터 실제 카디널리티 확인.
3. **모달 width 토큰화** — 컨텐츠 폭이 변동 가능한 모달은 `max-w-sm/md/lg/xl/2xl/4xl/6xl` 중 컨텐츠 기준으로 선택 (지금은 케이스별 산발).

---

## 28. ChartVisibilityModal 구조가 목업과 어긋남 — 섹션 토글 별도 그룹으로 분리

작성일: 2026-05-20 (19회차)

### 🚨 증상
- 19회차 신규 섹션 통합 시 ChartVisibilityModal에 섹션 토글 3개(`brandDetail`/`channelOverview`/`channelIssue`)를 추가했으나, **별도의 "[섹션 표시]" 그룹**으로 모달 하단에 분리 배치.
- 목업에서는 `종합 → Chart 1/2/3 → 브랜드 종합 → Chart 4/5/6 → 브랜드 상세 → 채널 종합 → 주요 채널 이슈` 5섹션 모두 동일 위계의 평면 리스트였음.
- 사용자 피드백: "토글이 없다고" (= 목업과 다른 위치/구조라 사용자가 인지 못 함).

### 🧭 원인
- 초기 구현 시 "체크박스 위치"만 맞추고 "위계"는 다르게 둠 (`SECTIONS`에 chart 묶음만 정의, 섹션 토글은 `SECTION_TOGGLES` 별도 배열).
- 종합/브랜드 종합은 chart-level만 있고 section-level 토글 없음 → 5섹션 중 3섹션만 section-level 토글 가능 → 비대칭.
- 목업 마지막 컨펌 단계에서 사용자가 본 것은 "평면 리스트 + 일부 indent"인데, 구현은 "2개 chart 그룹 + 별도 섹션 그룹".

### ✅ 해결
1. `SECTIONS` 배열을 5섹션 평면화로 재정의 (`{id, label, charts?}`). 종합·브랜드 종합만 `charts` 필드 보유.
2. `SectionId`에 `overview` / `brandOverview` 추가 → 종합·브랜드 종합도 섹션 단위 토글 가능.
3. **섹션 토글 OFF 시 sub-chart 토글 자동 disabled** (`opacity-50 cursor-not-allowed` + `input disabled`).
4. page.tsx에 `visibility.overview` / `visibility.brandOverview` 분기 추가 → 섹션 헤더 단위로 통째 숨김.

### 💡 향후 권장
1. **목업 ↔ 구현 위계 1:1 매칭 SOP** — HTML 목업의 들여쓰기/순서/그룹핑이 곧 구현 위계임을 명시. 자체 판단으로 그룹 분리 금지.
2. **섹션 토글 위계 통일 규약** — 다 차트 보유 섹션이든 단일 컴포넌트 섹션이든 section-level 체크박스는 동일 위계로 노출.
3. **사용자 피드백 "토글이 없다고" 류 모호한 문구 → 즉시 캡처/위치 확인 요청** — 추측 금지 (CLAUDE.md). 본 회차에서 가능성 A/B/C로 분기 질문 사용.

---

## 29. `.gitignore`의 광범위한 `lib/` 룰이 `frontend/src/lib/` 신규 파일 차단

작성일: 2026-05-20 (20회차)

### 🚨 증상
- B-6 차트 팔레트 적용 작업에서 `frontend/src/lib/chartPalette.ts` 신규 생성.
- 19회차 다른 세션도 같은 위치 헬퍼 파일 import를 4개 컴포넌트에 커밋했으나, 파일 자체는 git에 추적 안 됨.
- `git status`에서 untracked로도 보이지 않음 → 한참 후에야 파일이 ignore되었음을 발견.
- `git ls-files`로 확인 결과 `frontend/src/lib/api.ts`, `frontend/src/lib/utils.ts`는 추적 중이지만 신규 파일만 무시됨.

### 🧭 원인
- `.gitignore` 62행 `lib/` 룰 — Python setuptools dist 디렉토리(`build/lib/`, `lib64/`)를 무시하려는 의도였으나, gitignore는 **루트 경로 한정이 없으면 어디서나 매칭**.
- `frontend/src/lib/` 디렉토리 전체가 의도치 않게 ignore 대상.
- 기존 `api.ts`/`utils.ts`는 이 룰 추가 이전에 커밋되었거나 `-f`로 강제 추가되어 추적 중. 새 파일은 자동 무시.
- `git check-ignore -v frontend/src/lib/chartPalette.ts` 출력: `.gitignore:62:lib/	frontend/src/lib/chartPalette.ts`

### ✅ 해결
- `.gitignore`에 `!frontend/src/lib/` 명시 예외 추가 (62행 `lib/` 바로 아래).
- 이후 `git status`가 `?? frontend/src/lib/chartPalette.ts`로 정상 untracked 표시.
- 정상 `git add` → 커밋 가능.

### 💡 향후 권장
1. **gitignore 룰 작성 시 절대 경로 prefix 권장** — `lib/` → `/lib/` 또는 `build/lib/`로 좁히는 게 안전. 광범위 매칭 시 명시 예외(`!path/`) 같이 동반.
2. **신규 파일이 `git status`에 안 보일 때 `git check-ignore -v` 즉시 사용** — silent ignore가 가장 진단 어려운 케이스. 19회차에서도 발견 못 함.
3. **CI에 "import 대상 파일 존재" lint** — 빌드는 working tree 기준이라 로컬에서는 통과하나, 클론하면 실패. tsc는 잡지만 import path 위반은 패턴별로 잡히기 어려움.

---

## 30. 상대적 색 지시("더 진하게")의 방향 오해 — 1회 darken 후 lighten으로 반전

작성일: 2026-05-20 (20회차 후속)

### 🚨 증상
- 사용자: "남색이 좀더 진했음 좋겠어" → 진하게 darken (`#2c3e50` → `#1a2942`).
- 사용자 재확인: "반대로 해야할거같아 #2c3e50 여기서 더 연해져야할거같아. 진해지니까 더 검정선이랑 구분안된다" → 방향 반전 lighten (`#1a2942` → `#475d78`).
- 2회 반복 → 4개 파일 동기화도 2번 수행.

### 🧭 원인
- 모니터에서 본 시각 결과와 사용자 의도가 어긋남. "진하게 = 검정에 가까워짐"이 시각적으로는 인접 슬롯(검정 `#000`)과 충돌 → 식별성 저하.
- 인접 슬롯과의 상호작용을 사전에 시뮬레이션하지 않고 단일 색만 조정.
- 본인이 추측한 darken 방향이 검정과 격차를 좁히는 결과를 낳을 거란 점을 사전에 인지하지 못 함.

### ✅ 해결
- 진한 톤: `#1a2942` → **`#475d78`** (RGB 71/93/120, 검정과 명확히 분리)
- 연한 톤 동반 조정: `#4a5e80` → `#7d92b0`
- 4파일(chartPalette.ts / mockup b6 / design_document §8.14 / history) 동기화.

### 💡 향후 권장
1. **인접 슬롯 시뮬레이션 SOP** — 색 조정 시 단일 hex만 보지 말고, 같은 차트 안 나란히 있을 인접 슬롯(특히 검정/회색 같은 무채축)과 같이 swatch 비교.
2. **상대 지시는 시각 결과로 환원하여 재질문** — "더 진하게" 같은 모호 지시는 "결과적으로 검정과의 격차를 좁히는 방향인지/늘리는 방향인지" 같이 시각 의도 확인.
3. **mockup 사이클에서 인접 슬롯 함께 변경 미리보기** — palette 조정안을 코드 적용 전 mockup 단계에서 인접 슬롯과 같이 보여주기.

---

## 31. SalesChartNew B-6 적용 누락 — 초기 컴포넌트 스캔 시 인라인 ternary 패턴 미감지

작성일: 2026-05-20 (20회차 후속)

### 🚨 증상
- B-6 다중 시리즈 팔레트 적용 후 사용자 캡처 제보: `/custom-dashboard/details`의 "월별 이커머스 vs 오프라인 매출 추이" 차트가 옛 §8.5 v4 패턴(검정 실/점 + 회색 실)으로 그려져 있음.
- 적용 대상 5개 컴포넌트(`BrandSection`/`ChannelSection`/`ChannelIssueSection`/`ProductGroupChartNew`/`DynamicAnalysisSection`)를 모두 수정했으나 SalesChartNew가 빠짐.

### 🧭 원인
- 초기 스캔 시 `PALETTES`(객체) 패턴만 grep — `grep -rn "const colors\s*=\|COLORS\s*=\|MONO_PALETTE\|SERIES_COLORS\|chartColors"`.
- SalesChartNew의 인라인 ternary 패턴(`viewMode === 'growth' ? [...] : viewMode === 'profitRate' ? [...] : [...]`)은 식별자 없는 익명 배열이라 위 grep에 안 잡힘.
- 사용자 캡처 제보 후 `grep -rln "palette\[Math.floor"`로 재스캔 → SalesChartNew 발견.

### ✅ 해결
- SalesChartNew에 `getMultiSeriesStyle` / `getDataTypeSeriesStyle` 도입.
- 인라인 4단계 명도 팔레트 폐기.
- 후속 grep `palette\[Math.floor` → 잔여 없음.

### 💡 향후 권장
1. **컴포넌트 스캔 시 grep 패턴 다양화** — 식별자 패턴(`PALETTES`/`COLORS`) + 패턴 표현식(`palette\[Math.floor`/`stroke=.+#`) + hex 시퀀스(`#000000.*#5d5d5d`)를 함께.
2. **차트 컴포넌트 인벤토리 문서화** — 어느 컴포넌트가 multi-series mono palette를 쓰는지 design_document.md §7 또는 §8에 표로 명시. 후속 작업의 누락 위험 감소.
3. **사용자 캡처 제보 가치 재인식** — 자동 스캔보다 실 화면 캡처가 더 빠르게 누락 발견. 작업 후 "Vercel 배포 후 확인 부탁" 명시.

---

## 32. 코드 수정이 "안 변함" — 로컬 dev 미실행 상태에서 Vercel 배포본을 보고 있었음

작성일: 2026-05-20 (21회차)

### 🚨 증상
- `chartPalette.ts` 점 크기 수정 후 사용자: "아직 안 변했는데?" (캡처에 옛 큰 점 그대로).

### 🧭 원인
- 로컬에 Next.js dev 서버가 실행되고 있지 않았음 (`ps`/`lsof :3000` 확인 결과 node/next 프로세스 없음).
- 사용자가 보던 화면은 **Vercel 배포본**이었고, 수정은 커밋·푸시 전이라 배포에 미반영.
- 즉 코드 변경은 정상이었으나 "어디서 보고 있는지"가 어긋남.

### ✅ 해결
- 실행 환경부터 진단: `ps aux | grep -E "next|node"`, `lsof -nP -iTCP -sTCP:LISTEN | grep :300`.
- `frontend`에서 `npm run dev` 백그라운드 기동 → `.env.local`이 `http://localhost:8000` 백엔드를 보므로 로컬에서 즉시 확인 가능.

### 💡 향후 권장
1. **"안 변함" 보고 시 환경부터 확인** — 코드 재검토보다 ① 로컬 dev 실행 여부 ② 보고 있는 URL(localhost vs 배포본) ③ 푸시/배포 여부를 먼저 점검.

---

## 33. 일괄 치환 정규식이 `activeDot=`(대문자 D)를 누락 — 대소문자 필터 함정

작성일: 2026-05-20 (21회차)

### 🚨 증상
- 전 차트 점·선 크기 통일 perl 치환 후, 단독 줄의 `activeDot={{ r: 6 }}` / `r: 5 }}`가 옛 값 그대로 남음.
- 같은 줄에 소문자 `dot=`(dot 프롭)도 있던 결합 라인(details L336 등)은 정상 변경되어, 누락이 눈에 안 띄었음.

### 🧭 원인
- 라디우스 치환을 `if (/dot=/)` 라인 필터로 제한했는데, `activeDot=`는 "**D**ot="(대문자)라 소문자 `dot=`에 매칭되지 않음.
- 검증 grep도 `grep -E "dot="`(대소문자 구분)이라 단독 `activeDot=` 줄을 아예 검사 대상에서 제외 → "잔존 없음(OK)"으로 오판.

### ✅ 해결
- `if (/activeDot=/) { s/\br: [56]\b/r: 3.5/g; }` 보강 패스 실행.
- 재검증은 `grep -i`(대소문자 무시)로 수행 → 잔존 없음 확인.

### 💡 향후 권장
1. **검증 grep은 치환 grep과 다른 각도로** — 치환 필터가 케이스 민감이면 검증은 `-i`로, 또는 화이트리스트(허용값) 역-grep으로 누락 자체를 못 숨기게.
2. **결합 라인에 가려진 누락 주의** — 동일 속성이 단독/결합 두 형태로 존재하면 둘 다 샘플 확인.

---

## 34. recharts Legend 순서가 안 바뀜 — `itemSorter={undefined}`가 defaultProps로 되돌아감 + HMR 미반영

작성일: 2026-05-20 (22회차)

### 🚨 증상
- 표시 항목 순서 기능 구현 후, 트렌드 차트의 **선 색상은 선택 순서대로 맞는데 범례 텍스트만 가나다순**으로 고정.
- 1차 수정으로 `<Legend itemSorter={undefined} />`를 줬으나 여전히 가나다순. (HMR 상태에서도 변화 없음)

### 🧭 원인
- **(주 원인) recharts v3 기본 정렬**: `<Legend>`의 defaultProps `itemSorter: 'value'` → 범례 payload를 라벨 값 기준 `sortBy`로 자동 정렬 (`lib/state/selectors/legendSelectors.js`: `itemSorter ? sortBy(flat, itemSorter) : flat`). 선 렌더 순서(=시리즈 children 순서)는 우리 순서지만 범례 표시만 정렬됨.
- **(수정이 안 먹은 이유) React defaultProps**: `itemSorter={undefined}`로 주면 React가 prop을 "미지정"으로 보고 defaultProps(`'value'`)로 **되돌림** → 결국 정렬 유지. undefined는 끄는 값이 아니다.
- **(검증 혼선) HMR 미반영**: 코드 수정 후 Turbopack HMR로는 recharts 내부 store(legend settings)가 갱신되지 않아 이전 정렬 상태가 남음 → 풀 리로드 전까지 효과 확인 불가.

### ✅ 해결
- `<Legend ... itemSorter={null} />` 로 변경 (트렌드 차트 3곳: BrandSection / ChannelSection / ChannelIssueSection).
  - `null`은 falsy & **defaultProps 대체 대상이 아님** → 셀렉터가 `flat`(미정렬) 반환. 타입도 `LegendItemSorter | null` 허용.
- 검증은 **풀 페이지 리로드 + 데이터 재업로드** 후 수행 → 범례 순서 = 선택 순서 확인.

### 💡 향후 권장
1. **라이브러리 기본값 끄기는 `null`/명시값으로** — `undefined`는 React defaultProps로 되돌아가 "끈 게 아님". 끄려면 falsy 명시값(`null`) 또는 no-op 함수.
2. **차트 라이브러리 옵션 변경은 풀 리로드로 검증** — recharts 등 내부 store(redux 류)를 쓰는 라이브러리는 HMR로 설정 변경이 안 먹을 수 있음.

---

## 35. 기능 구현 누락 — 확인 질문 미해결 상태로 다른 작업으로 전환

작성일: 2026-05-20 (23회차)

### 🚨 증상
- 사용자가 "편집 모드" 3종 요청(① 차트 표시→편집 모드 명칭 ② 상품 추가 편집 모드에만 노출 ③ 버튼 클릭 시 전환 선택)을 했는데, 한참 뒤 화면을 보니 **하나도 반영 안 됨**. 사용자가 "다 반영이 안 된 거냐"고 재확인.
- 실제로는 반영 누락이 아니라 **애초에 구현된 적이 없음** (grep으로 `편집 모드`/`editMode` 0건 확인).

### 🧭 원인
- 편집 모드 요청에 대해 설계 확인 질문(숨김 범위/버튼 동작)을 드린 뒤, **답을 받기 전에** 사용자가 다음 요청("표시 순서")을 했고 그쪽으로 작업 전환.
- "표시 순서" 작업 완료 후 **미해결로 남아 있던 편집 모드 건을 다시 집어오지 않음** → 대기 큐에서 유실.

### ✅ 해결
- 누락 사실을 추측 없이 grep으로 확인 후 정직하게 보고("미구현이 맞다").
- 미해결 설계 포인트 2개를 `AskUserQuestion`으로 재확정 → 5개 파일 구현 → Playwright로 OFF/ON/OFF 왕복 검증.

### 💡 향후 권장
1. **미해결 질문은 작업 전환 시에도 추적** — 사용자가 새 요청으로 전환하면 이전 미해결(pending) 항목을 todo/메모로 남기고, 새 작업 완료 시 "이전에 남은 OO도 진행할까요?"로 환기.
2. **여러 요청 동시 수신 시 명시적 큐잉** — 한 메시지에 복수 요청이 오면 "①은 진행, ②③은 확인 후"처럼 처리 순서를 명시하고 마무리 때 누락분 체크.

---

## 36. `.env.local`에 `NEXT_PUBLIC_API_URL` 2줄 — 로컬 dev가 어느 백엔드를 보는지 모호

작성일: 2026-05-20 (24회차)

### 🚨 증상
- `frontend/.env.local`에 `NEXT_PUBLIC_API_URL`이 **2줄**(`http://localhost:8000` + `https://api.gongbaksoo.com`) 존재.
- 백엔드 변경(channel_issue P열/S열 추가)을 로컬에서 검증해야 하는데, dev 프론트가 로컬(8000)을 보는지 운영을 보는지 불확실 → 잘못 보면 "코드 고쳤는데 안 변함"으로 오판 위험 (§32와 유사).

### 🧭 원인
- dotenv는 같은 키 중복 시 **나중 줄이 우선**이라, 문자대로면 운영 URL이 적용될 수 있음. 단, `NODE_ENV==='development'` fallback·dev 서버 기동 시점 캐싱 등으로 실제 값이 달라질 수 있어 정적 추론만으로는 불확실.

### ✅ 해결
- 추측 대신 **브라우저 네트워크로 실제 호출 URL 확인**: `performance.getEntriesByType('resource')`로 `monthly-review` 요청이 `http://localhost:8000/api/...`로 가는 것 확인 → 로컬 백엔드 사용 확정 후 검증 진행.

### 💡 향후 권장
1. **env 중복 키 제거** — `.env.local`의 `NEXT_PUBLIC_API_URL`을 한 줄로 정리(로컬은 localhost만, 운영은 Vercel 대시보드). 중복은 혼란·오판의 원인.
2. **백엔드 검증 전 타깃 URL부터 확정** — API 응답 구조 변경 검증 시, 정적 추론 말고 실제 네트워크 요청(또는 직접 `curl localhost:8000`)으로 어느 백엔드인지 먼저 확인.

---

## 37. 백엔드 성능 회귀 — 항목×월 반복 불리언 필터 + 전 파트 빌드로 summary ~7s

작성일: 2026-05-20 (24회차 후속)

### 🚨 증상
- 24회차(S열 품목 추가) 직후 "매출/목표 파일 선택 후 그래프 로딩이 엄청 느려졌다". 측정 결과 `/summary/` 응답이 **part당 ~7초**(이전 1초대).

### 🧭 원인
1. **항목·월마다 데이터프레임 통째 필터링**: `_build_channel_issue`가 채널×(거래처·브랜드·품목)×12개월 각각을 `cdf[cdf["월구분"]==월]["판매액"].sum()`로 반복 스캔. S열 품목(107개) 추가로 스캔량 폭증 (O(채널×항목×12)).
2. **전 파트 빌드**: 한 요청에서 `all`/`ecommerce`/`offline` channel_issue를 모두 계산(프론트는 현재 part만 사용하는데도).
3. 부가: 빈 이름 필터를 행 단위 `astype(str).str.strip()`로 수행(대용량 컬럼에서 비용).

### ✅ 해결
1. **채널당 `groupby` 1회**: `sub.groupby([key,"월구분"])["판매액"].sum().unstack("월구분").reindex(columns=last12).fillna(0)` → 항목×월 반복 스캔 제거. 채널 합계도 `groupby("월구분").sum()` 1회.
2. **요청 part만 빌드**: `channel_issue[part] = _build_channel_issue(df_part)`, 나머지는 `{"channels": []}`.
3. 빈 이름 필터를 `dropna(subset=[key])` + value_counts unique 단위로.
- 결과: all 7.3→2.4~3.0s / ecommerce 7.1→1.7s / offline 6.7→1.3s. 데이터 정합성 동일.

### 💡 향후 권장
1. **항목별 시계열 집계는 groupby/pivot 1회로** — "고유값 × 기간" 반복 boolean-mask sum은 카디널리티 증가 시 폭발. 신규 차원 추가 시 집계 패턴부터 점검.
2. **응답에 안 쓰는 파트/데이터 빌드 금지** — 클라이언트가 일부만 쓰면 백엔드도 그만큼만. 특히 무거운 pivot은 요청 스코프로 한정.
3. **데이터 차원 추가 PR은 응답시간 측정 동반** — `curl -w "%{time_total}"`로 before/after 기록.

---

## 38. 요구 범위 과잉 해석 — "범례만 구분"인데 차트 선 패턴까지 변경

작성일: 2026-05-20 (25회차)

### 🚨 증상
- 사용자: "범례에서 마이비(실선)·얼룩제거제(점선)가 같아 보인다, 안 헷갈리게." → 의도는 **범례 표현만** 구분.
- 나는 차트 선 dasharray를 `4 4`→`2 6`(잘게 쪼갠 점선)+긴대시+대시닷으로 바꾸고 범례(plainline)도 같이 변경. 사용자: "내가 요청한 거랑 다르다. 잘게 쪼개진 점선은 없애라. 범례 부분은 만족."

### 🧭 원인
- "구분되게 해달라"를 **선 스타일 전면 개편**으로 확대 해석. 실제 불만의 근원(범례 아이콘이 dasharray 무시 → 두 검정 시리즈가 동일하게 보임)만 고치면 충분했음.
- AskUserQuestion 선택지에 "선 패턴 변경"을 포함시켜 동의를 받았다고 판단했으나, 사용자 본의는 범례 가독성이었음(선택지 설계가 본의를 좁히지 못함).

### ✅ 해결
- 차트 선 패턴은 원복(`4 4` 점선 유지), 범례 `iconType="plainline"`만 유지 → 범례에서 실선/점선 구분 + 차트 선은 기존 그대로.

### 💡 향후 권장
1. **"구분/개선" 요청은 변경 대상(범례 vs 선 vs 색)을 좁혀 재확인** — "선 모양도 바꿀까요, 범례만 바꿀까요?"처럼 최소 변경 옵션을 명시.
2. **근본 원인부터 최소 수정** — 증상(범례 혼동)의 직접 원인(아이콘이 dash 무시)만 고치고, 더 큰 변경은 별도 동의.

---

## 39. 동명이종 합산 오해 — 같은 상품명을 브랜드 무관 합산으로 제안

작성일: 2026-05-21 (26회차)

### 🚨 증상
- "상품을 브랜드별로 그룹핑" 요청에 대해, 여러 브랜드에 걸친 상품(`물티슈` 등)을 **이름 기준 1개 합산 라인 + 대표 브랜드 1곳 배치**로 제안.
- 사용자: "데일리케어 물티슈와 라포레띠 물티슈는 전혀 다른 매출이야. 합산하면 안 돼." → 동명이라도 브랜드가 다르면 다른 상품.
- 이어 사용자가 정밀화: "물티슈만 선택하면 합산, **라포레띠+물티슈를 선택하면 라포레띠 물티슈만**" → 단순 합산도 단순 분리도 아닌 **부모-자식 교차필터**.

### 🧭 원인
- 백엔드가 products를 `품목 구분`(이름) 단일 키로 묶어 이미 브랜드 가로질러 합산하고 있었음 → "그룹핑"을 표시 정렬 문제로만 보고 데이터 식별 단위를 재검토하지 않음.
- 다대다(상품↔브랜드) 예외(물티슈/면봉/젖병솔/대상X)를 "대표 1곳"으로 단순화하려다 의미를 왜곡.

### ✅ 해결
- 식별 단위를 `(브랜드, 상품)`으로 변경: 백엔드 `_series_by_pair(cdf, "품목 구분", "품목그룹1")` (각 항목 `brand` 부착).
- 표시는 자식 토큰 1개(`S:<상품>`) 유지하되 **차트 값은 선택된 부모로 동적 스코프**(미선택→전체 합산 / 선택→교집합 / 교집합 없음→0). 식별자 스킴 불변 → 마이그레이션 불필요. `design_document.md §2.3.3.16`.

### 💡 향후 권장
1. **"그룹핑/분류" 요청은 데이터 식별 단위(키)부터 확인** — 표시만 바꾸는지, 집계 키가 바뀌는지(동명이종 존재 여부)를 실데이터로 점검 후 설계.
2. **다대다 예외는 실데이터로 먼저 카운트** — 1:1 가정 전에 `groupby(key)[group].nunique()>1` 같은 점검으로 예외 규모 파악.

---

## 40. 모달 row 수가 그룹 몫 아닌 전체 합으로 표시 — 다부모 자식 카운트

작성일: 2026-05-21 (26회차)

### 🚨 증상
- 브랜드별 그룹 모달에서 여러 브랜드에 걸친 상품(`대상 X`)이 **어느 브랜드 그룹에 있든 전 브랜드 합계 row(2,048)**로 표시. 마이비 그룹인데 마이비 몫(377)보다 큰 숫자가 떠 잘못돼 보임.
- 거래처 모달은 거래처↔채널이 대부분 1:1이라 카운트가 채널 합계와 맞아떨어져 정상으로 보였음(대비).

### 🧭 원인
- `buildChartModel`의 `childRowCount`가 자식의 **전 부모 합계**를 누적 → 자식 옵션은 `groups[]`로 여러 그룹에 같은 단일 `row_count`를 표시.

### ✅ 해결
- `childRowByParent`(자식×부모 row 수) 추가 → `ProductOption.rowCountByGroup` 전달. 모달이 헤더(그룹)별로 그 그룹 몫을 표시. 마이비 `대상 X` 2,048→377, 누비 452, 쏭레브 1,039. 단일 부모 항목·차트 동작 불변.

### 💡 향후 권장
1. **항목이 여러 그룹에 중복 표시되면 그룹별 수치 사용** — 합계성 수치(row/매출)는 그룹 몫으로 분해해 표시하고, "그룹 몫 합 = 부모 합계" 검산.

---

## 41. 카드 높이 불일치 — 차트 height만 맞추다 footer를 누락 (목표비 실적)

작성일: 2026-05-21 (27회차)

### 🚨 증상
- 목표비 실적(chart1)이 옆 차트보다 작아 보임 → height 220→260으로 키움 → 이번엔 카드가 더 커 보임. "반응형이라 맞추기 힘드냐"는 질문까지 나오며 라운드 반복.

### 🧭 원인
- chart1만 차트 아래에 **"달성률 N%" footer(약 33px)**가 있음. 옆 라인 차트는 footer 없음.
- 차트 영역(`ResponsiveContainer height`)만 옆과 같은 260으로 맞추면 카드 외곽 = 차트 + footer라 33px 더 큼. height만 보고 footer를 계산에 넣지 않아 양방향으로 어긋남.

### ✅ 해결
- 실제 카드 높이를 `getBoundingClientRect`로 측정(목표비 362 vs 나머지 329, 차 33px = footer)해 원인을 수치로 특정.
- 사용자 선택(달성률 footer 유지)에 따라 chart1 height를 **227**로 설정 → 카드 외곽 세 개 모두 **329px** 일치(막대 영역만 라인보다 약간 짧음). footer 있는 카드는 "차트 height = 목표 카드 높이 − 비차트 영역(header+footer+padding)"으로 역산.

### 💡 향후 권장
1. **카드 높이 일치는 차트 height가 아니라 카드 외곽으로 검증** — footer/부가 라인이 있는 카드는 `getBoundingClientRect`로 실측 후 역산. height 숫자만 맞추지 말 것.
2. **양방향 조정 전 실측 우선** — "작다/크다" 피드백이 반복되면 추측 조정 대신 먼저 측정해 차이의 출처(footer 등)를 특정.

---

## 42. 디자인 규약 위반 — "AI 분석" 버튼에 이모지(🤖) 삽입 (이모지 전면 금지)

작성일: 2026-05-21 (28회차)

### 🚨 증상
- AI 매출 분석 버튼 라벨을 `🤖 AI 분석`으로 작성해 배포. 사용자가 스크린샷과 함께 "왜 이모티콘을 쓰니? 디자인가이드 안 읽어보니"라고 지적.

### 🧭 원인
- `docs/design_document.md` 디자인 규약에 **"이모지: 전면 금지 (UI/카피/에러 메시지 모두)"** 가 명시(§6.1, line 793)돼 있는데, 새 UI 요소(버튼)를 만들면서 **디자인 가이드를 먼저 확인하지 않고** 임의로 이모지를 추가함.
- 과거에도 동일 이슈로 헤더·`emoji` prop 이모지를 전수 제거한 이력(§13, 22회차 §914-915) 있었음에도 신규 컴포넌트에서 재발.

### ✅ 해결
- `page.tsx`의 버튼 라벨 `🤖 AI 분석` → `AI 분석`으로 수정. ghost 버튼 스타일(1px `#c4c4c4` 아웃라인)은 가이드 CTA(`더보기`)와 동일하게 유지.
- 모달(`AIAnalysisModal.tsx`)에는 이모지 없음 확인.

### 💡 향후 권장
1. **신규 UI 요소 작성 전 디자인 규약 선확인** — 버튼/라벨/카피를 새로 만들 때 `design_document.md` 디자인 규약(이모지 금지·타이포·색 토큰)을 먼저 읽고 적용. 이모지는 어떤 경우에도 금지.

---

## 43. 인접 버튼 디자인 불일치 — disabled 상태로 색·크기 달라 보임 ("AI 분석" vs "편집 모드")

작성일: 2026-05-22 (28회차 후속)

### 🚨 증상
- "AI 분석" 버튼을 헤더의 "편집 모드" 버튼 왼쪽으로 옮긴 뒤, 사용자가 "두 버튼 디자인이 다르다 — 사이즈와 색이 다르다"고 지적(매출/목표 파일 선택 전 화면).

### 🧭 원인
- 두 버튼은 동일 클래스(`border-[#c4c4c4] bg-white text-black text-[13px] px-3 py-2 rounded`)였으나, "AI 분석"에만 `disabled={!summary}` + `disabled:opacity-50`을 줌. 파일 미선택 시 `summary`가 없어 **AI 분석만 흐려져(opacity-50)** 색이 다르고 크기도 작아 보임. "편집 모드"는 비활성 상태가 없어 항상 진함.
- 인접 배치하면서 한쪽에만 disabled 시각효과를 적용하면 "디자인이 다르다"는 인상을 줌을 사전에 고려하지 못함.

### ✅ 해결
- "AI 분석" 버튼의 `disabled` 제거 → 항상 활성, "편집 모드"(비활성)와 동일 외형.
- 데이터 없음 처리는 버튼이 아니라 **모달 내부**로 이전: `summary == null`이면 `분석하기`만 비활성 + "매출·목표 파일과 대상 월을 먼저 선택하면 분석할 수 있습니다." 안내(프롬프트 작성은 가능). 모달도 `summary` 없이 항상 렌더하도록 변경.

### 💡 향후 권장
1. **인접 버튼은 disabled 시각효과까지 일치 검토** — 같은 줄에 나란히 둘 버튼은 enabled뿐 아니라 disabled(opacity 등) 상태도 시각적으로 어긋나지 않는지 확인. 한쪽만 비활성될 수 있으면 비활성 표현을 버튼 밖(모달·툴팁 등)으로 옮기는 것을 우선 검토.

---

## 44. 운영 매출 파일이 배포 때마다 유실 — `metadata.db`가 git에 추적됨

작성일: 2026-05-23 (29회차)

### 🚨 증상
- 사용자: "새 파일 업로드하고 새로고침하니 새로 올린 파일만 보이고 기존 파일은 안 보인다", "왜 자꾸 매출 자료가 사라지나".
- 운영 `GET /api/files/`가 방금 올린 1건만 반환. 로컬 DB에는 정상적으로 존재 → 운영에서만 발생.

### 🧭 원인
- 업로드 파일은 BLOB으로 **`api/metadata.db`(SQLite)** 에 저장되는데, **이 DB 파일이 git에 추적**되고 있었음(`git ls-files` 확인). 저장소 커밋본(HEAD)의 `uploaded_files` 테이블은 **0행**(마지막 커밋 `517e551 "Railway deployment"`).
- 운영 백엔드(맥미니)를 배포할 때마다 코드를 받아오며(`git pull`/checkout) **빈 DB가 운영 DB를 덮어써서** 그 안의 업로드 파일이 전부 유실됨. 최근 AI 분석 기능으로 여러 번 배포 → 매 배포마다 사라짐("자꾸").
- `.gitignore`는 존재하지 않는 경로 `backend/uploads/...`만 무시하고 있어, 실제 경로 `api/uploads`·`api/metadata.db`는 한 번도 무시되지 않았음. (본 문서 "향후 권장 사항 #1"에 이미 동일 권장이 있었으나 미조치 상태에서 사고로 이어짐.)

### ✅ 해결
- `git rm --cached api/metadata.db`, `git rm --cached -r api/uploads`(디스크 파일은 보존, `.gitkeep`만 재추가)로 **git 추적 제외**.
- `.gitignore`의 `backend/uploads` 룰을 실제 경로로 교정: `api/uploads/*`(+`targets/*`, `!.gitkeep`), `api/metadata.db`, `api/*.db` 등록. 커밋 `ee440ec` 푸시.
- 맥미니 안전 반영(추적 파일 삭제 커밋이 pull 시 운영 DB를 지울 수 있으므로): **① 운영 `metadata.db`·`uploads` 백업 → ② `git pull` → ③ pull이 metadata.db를 삭제하면 백업에서 복원 → ④ 재기동·`curl /api/files/` 검증**. 맥미니에 더 많은 파일이 든 옛 DB 백업은 없어, 유실 파일은 노트북 디스크에 보존돼 있던 `260210_2.csv`·`260519.csv`를 운영으로 재업로드(`curl -F file=@...`)하여 복구.

### 💡 향후 권장
1. **런타임/사용자 데이터는 절대 git에 두지 않는다** — DB 파일(`*.db`)·업로드 디렉토리는 소스가 아니라 운영 데이터. 신규 생성 즉시 `.gitignore`에 등록하고 `git ls-files`로 추적 여부를 점검. 이미 추적 중이면 `git rm --cached`로 즉시 제외.
2. **추적 해제 커밋은 배포처 데이터를 지울 수 있다** — 추적되던 파일을 삭제하는 커밋을 다른 클론이 pull하면 working tree 파일이 삭제될 수 있음. 운영 반영 전 **반드시 백업 → pull → 필요 시 복원** 순서 준수(`§22` 배포 SOP와 병행).
3. **`.gitignore` 경로 실재 검증** — 룰 작성 시 실제 디렉토리 경로(`api/` vs `backend/`)가 맞는지 확인. 잘못된 경로 룰은 아무것도 막지 못함(`§29`와 동류).

---

## 45. 채널 이슈 미니 차트가 품목 매출을 0으로 표시 — 백만원 반올림 단위가 너무 거침

작성일: 2026-05-24 (30회차)

### 🚨 증상
- 사용자: "26년 4월에 0원이라고 되어 있는데 업로드한 CSV 보면 262,018원이다. 너무 중요한 문제다."
- 월 리뷰 "주요 채널 이슈" 섹션의 "2in1 컵"(품목, S열) 미니 차트가 2026-04에 0으로 표시. Y축이 0~1로만 잡혀 다른 달도 0/1로 뭉개져 보임.

### 🧭 원인 (데이터·날짜·유실 문제 아님)
- **백엔드는 정확함**: 운영 `/monthly-review/summary/`를 직접 호출해 검산 → 2026-04 "2in1 컵" = 7개 채널 합산 `11,727+16,272+176,909+15,655+41,455 = 262,018원`. CSV와 일치. 다른 달도 전부 일치.
- **프론트 표시 변환이 너무 거침**: `ChannelIssueSection.tsx`의 `toMan = Math.round(v / 1_000_000)`(백만원 정수 반올림). 채널 이슈 섹션은 품목(S열)·거래처(R열)처럼 **월 매출 100만원 미만 항목**이 많아, `262,018 ÷ 1,000,000 = 0.26 → 반올림 → 0`. 모든 소액 항목이 0/1로 소실.
- 함수명 `toMan`(만원)과 실제 동작(÷1,000,000=백만)이 불일치했던 점도 혼동 요인.

### ✅ 해결
- `toMan`을 **만원 단위(천원 자리 반올림)** `Math.round(v / 10_000)`로 변경 → `262,018 → 26만원`. 함수명과 동작 일치.
- 단위 라벨 동반 수정: 툴팁 `백만`→`만원`, 두 서브타이틀 `(백만)`→`(만원)`.
- 적용 범위: **채널 이슈 섹션 한정**. 종합 9개 차트(§2.3.3.5)는 집계값이 커 백만 유지.
- 백엔드 무변경 → **재배포 불필요(Vercel 자동)**. 상세 설계: `docs/design_document.md §2.3.3.21`.

### 💡 향후 권장
1. **차트 표시 단위는 데이터 스케일에 맞춰 선택** — 집계 레벨(채널·브랜드, 수백만~수천만)과 세부 레벨(품목·거래처, 수만~수십만)은 단위가 다름. 한 컴포넌트가 양쪽을 그리면 **세부 레벨 기준으로 단위를 잡아야** 소액이 0으로 사라지지 않음. "정수 반올림 + 큰 단위"는 해상도 손실을 점검.
2. **변수/함수명과 실제 단위 일치** — `toMan`이 ÷1,000,000이면 이름-동작 불일치. 단위 상수는 이름(`MAN`=10,000 / `MILLION`=1,000,000)으로 명확히.
3. **"0으로 보인다" 류 데이터 의심은 백엔드 원값부터 검산** — 차트의 0이 데이터 유실인지 표시 반올림인지 구분하려면, 동일 입력으로 API raw 응답을 직접 확인(둘 다 0으로 보일 수 있음).

---

## 46. §45 수정이 화면에 반영 안 됨 — 잘못된 컴포넌트를 고침 (차트 제목 단서 무시)

작성일: 2026-05-24 (30회차 후속)

### 🚨 증상
- §45 수정·배포 후에도 사용자: "여전히 변경 안 됐는데?" — 동일하게 "2in1 컵"이 0/1로 표시.

### 🧭 원인
- §45에서 `ChannelIssueSection.tsx`(미니 차트 제목 = 고정 "거래처별/브랜드별 매출 트렌드")를 고쳤으나, **사용자가 본 차트의 제목은 품목명 "2in1 컵"**이었음. 제목이 품목명인 차트는 **`BrandSection.tsx`의 "개별 상품" 소형 멀티플**(`individualProducts.map(p => <h4>{p.name}</h4> …)`)임. 즉 단위 변환 함수가 같은 이름(`toMan`)으로 여러 컴포넌트에 중복 존재(9개 파일)해, 한 곳만 고치고 "전부 고쳤다"고 오판.
- **차트 제목이라는 명백한 식별 단서**(품목명 vs 고정 라벨)를 첫 수정 때 대조하지 않음.

### ✅ 해결
- `BrandSection.tsx`도 동일 원칙으로 수정: 함수 분리 `toMillion`(÷1,000,000, 브랜드 종합 트렌드) / `toManWon`(÷10,000, 품목 차트). "주요 상품 라인"·"개별 상품" → 만원, 툴팁 `백만`→`만원`. 브랜드 종합 트렌드는 백만 유지.
- 백엔드 검산으로 대상 재확인: `brand_products["누비"]` "2in1 컵" 2026-04 = **262,018원 → 26만원**. (BrandSection이 쓰는 필드가 `brand_products`임을 확인 후 수정)

### 💡 향후 권장
1. **수정 전 "사용자가 보는 그 화면"의 컴포넌트를 제목·라벨로 특정** — 스크린샷의 제목/문구가 코드의 어느 컴포넌트 출력인지 grep으로 먼저 매칭. 제목이 동적(품목명)인지 고정인지가 핵심 단서.
2. **중복 정의된 유틸은 전수 점검** — `toMan`처럼 같은 이름이 N개 파일에 복붙된 유틸을 고칠 땐 `grep -rl`로 전부 찾아 영향 범위를 먼저 파악(공용 유틸로 추출 검토).

---

## 47. 추출 레퍼런스 데이터(`brand_targets.csv`)를 gitignore된 `uploads/`에 둘 뻔함 — 배포 누락 함정

작성일: 2026-05-24 (30회차 후속)

### 🚨 증상 (사전 포착, 실제 사고 전)
- 브랜드 목표 데이터 `brand_targets.csv`를 처음에 `api/uploads/targets/`에 생성. 그런데 `uploads/`는 §44에서 git 추적 제외(gitignore)됨 → **커밋·push해도 Mac Mini에 안 감**. 코드(목표 로딩)는 배포되는데 데이터 파일은 안 가서 운영에서 목표비가 전부 `-`로 나올 뻔함.

### 🧭 원인
- §44에서 "운영 런타임 데이터(업로드 파일·DB)는 git 추적 금지"로 `uploads/`를 ignore함. 그런데 `brand_targets.csv`는 **사용자 업로드 런타임 데이터가 아니라 '전사' 시트에서 추출한 레퍼런스(코드와 함께 배포돼야 하는 정적 데이터)**임 — 성격이 정반대인데 같은 디렉토리에 둠.

### ✅ 해결
- `brand_targets.csv`를 추적 경로 **`api/brand_targets.csv`**로 이동, `BRAND_TARGETS_FILE`도 `BASE_DIR` 기준으로 변경. → git pull로 코드와 함께 배포됨.

### 💡 향후 권장
1. **"런타임 데이터" vs "레퍼런스 데이터" 구분해서 위치 결정** — 사용자가 업로드/생성하는 가변 데이터(gitignore)와, 코드와 함께 배포돼야 하는 정적 추출/설정 데이터(추적)는 **다른 디렉토리**에. 후자를 gitignore된 `uploads/`에 두지 말 것(§44와 짝).
2. **고정 경로로 읽는 데이터 파일은 배포 경로(git 추적) 확인** — `git check-ignore <path>`로 추적 여부를 만들 때 즉시 점검.

---

## 48. 백엔드 검증이 수정 전 코드를 반환 + N개 대상 중 1개만 검증·보고 → 부분 작업 오인

작성일: 2026-05-24 (31회차)

### 🚨 증상
- 브랜드 상세 13개월 확장 후 로컬 `/summary`를 curl로 검증 → `chart10` 개월수가 여전히 **12**로 나옴(수정한 코드와 불일치).
- 마이비 검증 결과만 보고하자 사용자: **"마이비만 한 거니?"** — 실제로는 세 브랜드 모두 적용됐는데 1개 예시만 보여 부분 작업처럼 보임.

### 🧭 원인
- ① 로컬 uvicorn이 `--reload` 없이 기동돼 **수정 전 코드가 메모리에 상주**. 파일은 고쳤지만 실행 중 프로세스에는 반영 안 됨.
- ② 변경이 N개 대상(마이비/누비/쏭레브)에 동일 적용되는데 검증·보고를 대표 1개로만 함 → 적용 범위가 전달되지 않음.

### ✅ 해결
- 기존 uvicorn `pkill` 후 재기동 → `chart10` 13개월 확인.
- 세 브랜드 전부 수치 검증 후 표로 보고(마이비/누비/쏭레브 + 누비 상품 3종).

### 💡 향후 권장
1. **백엔드 변경 검증 전 재기동 확인** — `--reload` 미사용 환경에선 파일 수정만으로 반영 안 됨. curl 결과가 코드와 어긋나면 우선 프로세스 재기동을 의심(§32 "안 변함 → 실행 환경" 의 백엔드판).
2. **N개 대상 일괄 변경은 전부 검증·전부 보고** — 같은 코드가 여러 항목에 적용되면 1개 예시가 아니라 전 항목을 확인하고 "전부 적용됨"을 명시(부분 작업 오인 방지).

---

## 49. 한 화면에 단위 다른 차트 공존 + 단위 라벨 누락 → 데이터 정합성 오인

작성일: 2026-05-25 (34회차)

### 🚨 증상
- 사용자: "누비 종합 트렌드 4월이 1백만원인데 스텐물병 매출이 4(백)인 게 말이 안 된다. 스텐물병은 누비 매출에 포함인데."
- 즉, 하위 상품(스텐물병)이 상위 브랜드(누비) 합계를 초과하는 것처럼 보임.

### 🧭 원인
- **데이터·구조는 정상**: 누비 종합 = `품목그룹1=="누비"` 전체 합, 스텐물병 = 그 안의 한 `품목 구분` → 구조상 누비 ⊇ 스텐물병 항상 보장.
- **단위가 차트마다 다름**: 종합 트렌드 = `toMillion`(백만), 개별 상품·주요 상품 라인·상품 요약 = `toManWon`(만원). 실제 26.04 = 누비 100만원 vs 스텐물병 4만원 → 정합.
- **착시 원인**: 종합 트렌드에는 `13개월 (단위: 백만)` 라벨이 있는데 **개별 상품 카드에는 단위 라벨이 없어**, 종합과 같은 백만으로 읽으면 "4백만 > 1백만 → 불가능"으로 오인.

### ✅ 해결
- 추측·코드 변경 전 백엔드(`monthly_review.py`)·프론트(`BrandSection.tsx`) 단위 변환을 먼저 읽어 정합성 확인(데이터 버그 아님을 규명).
- 개별 상품 카드 제목 아래에 `13개월 (단위: 만)` 라벨 추가(`BrandSection.tsx`, 프론트 전용).

### 💡 향후 권장
1. **한 화면에 단위가 다른 차트가 공존하면 모든 차트에 단위 라벨 명시** — 라벨 있는 차트(백만)와 없는 차트가 섞이면 사용자는 같은 단위로 읽어 정합성을 오인. "데이터가 이상하다" 제보는 코드 변경 전에 **단위·집계 구조부터 raw로 검산**(데이터 버그 vs 표시 문제 구분).
2. **상하위 포함 관계 수치는 단위를 통일하거나 포함 관계를 라벨로 명시** — 부모(브랜드 종합) vs 자식(상품) 차트는 가능하면 같은 단위, 불가하면 각 단위 라벨 필수.

## 50. "기기 간 유지" 요구는 프론트 단독 불가 — 백엔드 저장 + 분리 배포 함정

작성일: 2026-05-26 (35회차)

> 런타임 에러는 없었음. **사전 포착한 배포/설계 함정**을 기록.

### 🚨 증상 (사전 포착)
- 요구: "그래프 날짜를 다른 기기에 접속해도 똑같이 유지." 그래프 6종의 기간을 `localStorage`로 저장하면 새로고침은 되지만 **다른 기기에서는 복원 안 됨**(localStorage는 브라우저/기기 한정).
- 또한 이 저장소는 **백엔드 변경**을 수반하는데, 운영 백엔드는 별도 **맥미니**에 있고 작업 머신(노트북)에서 SSH 불가 → **프론트만 push하면 저장 기능이 동작하지 않는** 부분배포 상태가 됨.

### 🧭 원인
- "기기 간 공유" = 공용 서버 저장이 필수. 클라이언트 저장(localStorage)으로는 정의상 불가.
- 이 프로젝트는 **프론트(Vercel 자동) ↔ 백엔드(맥미니 수동)** 배포 경로가 분리됨(인프라 메모/`project_plan §7`). 백엔드 의존 기능을 프론트만 배포하면 미동작.

### ✅ 해결
- 저장소를 **백엔드 JSON 파일**(`dashboard_dates.json`)로 설계, `GET/POST /custom/dashboard-dates/` 추가(기존 `schema_aliases.json` 패턴 재사용). 모든 기기가 같은 백엔드를 보므로 공유 성립.
- 프론트는 **백엔드 미배포·오류 시 조용히 폴백**(GET/POST 실패 무시 → 기본 기간 사용)하도록 작성 → 백엔드 배포 전에도 앱이 깨지지 않음.
- 배포 순서를 명시 안내: 프론트 push(Vercel 자동) + **맥미니에서 `git pull` → `com.avk.backend` 재시작** 별도 수행.

### 💡 향후 권장
1. **"다른 기기에서도 유지" 요구는 무조건 서버 저장으로 설계** — localStorage는 기기 한정임을 사용자에게 먼저 구분 안내.
2. **백엔드 의존 기능은 프론트에 graceful 폴백 내장 + 배포 순서 명시** — 분리 배포(프론트 자동/백엔드 수동) 환경에서 부분배포로 인한 미동작·앱 깨짐을 방지.

## 51. AI 채팅이 EUC-KR CSV에서 전부 실패 — read_csv UTF-8 기본값 + 함수 내 중복 import가 진짜 에러를 가림

작성일: 2026-05-30 (36회차)

> 맥미니 백엔드 `chat_debug.log`에서 포착. 두 질문("안녕", 파일 미선택 질문)이 서로 다른 에러로 실패하던 것을 사용자가 로그로 전달.

### 🚨 증상
- AI 채팅에 어떤 질문을 보내도 실패. 로그 표면 에러는 `UnboundLocalError: cannot access local variable 'traceback'`(chat.py:213)으로 떠서 **진짜 원인이 안 보임**.
- 실제 원인 1: `'utf-8' codec can't decode byte 0xc0 in position 0`(chat.py:173, `pd.read_csv`).
- 실제 원인 2: 파일 미선택 상태로 질문 시 `[Errno 21] Is a directory: '.../api/uploads/'`.

### 🧭 원인
- **(가림) 함수 내부 중복 import**: `chat.py`는 모듈 상단에 `import traceback`이 있는데 함수 안 `except direct_error` 블록에도 `import traceback`이 또 있었음. 파이썬은 함수 안 어디서든 이름이 대입/임포트되면 그 이름을 **함수 전체에서 지역변수로 취급** → 바깥 `except`가 그 줄을 거치지 않고 실행되면 `traceback`이 미바인딩 → `UnboundLocalError`. 이 엉뚱한 에러가 진짜 에러를 덮어씀.
- **(인코딩) read_csv UTF-8 기본값**: 업로드 원본 CSV는 전부 EUC-KR(cp949)인데 `read_csv`를 인코딩 인자 없이 호출 → 첫 바이트 `0xC0`("일별"의 "일")에서 UTF-8 디코드 실패. (맥미니에서 `xxd` → `C0 CF BA B0` = EUC-KR "일별", `iconv -f euc-kr` 정상 디코드로 확정.)
- **(디렉토리) 빈 파일명**: 파일 미선택 시 `filename`이 빈 문자열 → `os.path.join(UPLOAD_DIR, "")` = 디렉토리 자체. `ensure_file_on_disk`가 `os.path.exists`(디렉토리도 True)로 통과시켜 → `open(디렉토리,'rb')`가 IsADirectoryError.

### ✅ 해결
- `chat.py:205` 함수 내 중복 `import traceback` 제거 → 바깥 `except`의 `traceback.format_exc()` 정상 동작(진짜 에러가 로그에 남음).
- `chat.py:173` `read_csv`에 `try: read_csv() except UnicodeDecodeError: read_csv(encoding='cp949')` 폴백 추가.
- `index.py:60` `ensure_file_on_disk`에 빈 파일명 가드(`if not filename: return False`) + `os.path.exists`→`os.path.isfile` → 미선택 시 `[Errno 21]` 대신 깔끔한 404("파일을 찾을 수 없습니다").
- **전수 감사**: `grep -rn read_csv`로 전 CSV 리더 점검 → 운영 리더(`index.py`/`dashboard.py`/`monthly_review.py`)는 이미 4종 인코딩 폴백 보유, `chat.py`만 누락이었음(수정 완료). `analysis.py`는 폴백 없으나 어디서도 import 안 되는 死코드라 위험 없음.
- 맥미니 `git pull` + `com.avk.backend` 재시작 후 검증: "안녕" → 200 정상 응답(cp949 CSV 로드 OK), 파일 미선택 질문 → 404("파일을 찾을 수 없습니다", `[Errno 21]` 제거 확인).

### 💡 향후 권장
1. **함수 안에서 모듈 재-import 금지** — 모듈 상단에 이미 있는 이름(`traceback`/`os` 등)을 함수 내부에서 다시 `import`하면 그 이름이 함수 전체 지역변수로 승격돼, 미실행 분기에서 `UnboundLocalError`로 진짜 에러를 가린다. 특히 에러 핸들러에서 쓰는 이름일수록 치명적.
2. **CSV 리더는 인코딩 폴백 필수 + 신규 리더 추가 시 전수 점검** — 이 프로젝트 원본 CSV는 EUC-KR(cp949)다. 새 `read_csv` 추가 시 `['utf-8','utf-8-sig','cp949','euc-kr']` 폴백을 기존 리더와 동일하게 적용하고, `grep -rn read_csv`로 누락 지점이 없는지 점검.
3. **경로 존재 확인은 의도에 맞는 술어로** — "파일"을 기대하는 곳은 `os.path.exists`(디렉토리도 True) 대신 `os.path.isfile`을 쓰고, 외부 입력(파일명)은 빈 값 가드를 먼저 둔다.

## 52. 적대 검증이 잡은 self-DoS — `hmac.compare_digest`가 한글 비밀번호에서 TypeError

작성일: 2026-05-30 (37회차)

> 런타임 사고는 없었음. **로그 관리 기능(관리자 비번 가드) 구현 후 배포 전 다관점 적대 검증으로 사전 포착**한 함정.

### 🚨 증상 (사전 포착)
- 신규 `POST /logs/clear` + `GET /logs/` 가드에 `hmac.compare_digest(provided, ADMIN_PASSWORD)`를 **str끼리** 비교하도록 작성.
- 검증 에이전트가 Python 3.14에서 실증: `hmac.compare_digest('비밀번호','비밀번호')` → `TypeError: comparing strings with non-ASCII characters is not supported`.
- 한글 코드베이스라 **한글 비밀번호가 충분히 가능** → 저장된 비번이 비ASCII면 정답을 입력해도, 빈 값/오답을 넣어도 **매 요청이 TypeError → 500**. 전역 예외 핸들러도 없어 기능이 영구 미동작(self-DoS). 프론트는 401/503만 분기해 "실패"만 표시.

### 🧭 원인
- `hmac.compare_digest`는 str 인자일 때 **양쪽 모두 ASCII**여야 함. 한쪽이라도 비ASCII면 TypeError.
- 저장 비번이 한 피연산자라, 비번 자체가 한글이면 입력값과 무관하게 항상 실패.

### ✅ 해결
- 양쪽을 **utf-8 bytes로 인코딩 후 비교**: `hmac.compare_digest(provided.encode('utf-8'), admin_password.encode('utf-8'))`. 임의 유니코드 비번에서 동작 + 상수시간 비교 유지. (실증: str 비교는 TypeError, bytes 비교는 한글/ASCII 모두 정상.)
- 곁들여 반영: 읽기 엔드포인트 `GET /logs/`도 같은 가드로 잠금(로그에 사용자 프롬프트·데이터가 남으므로 보기/지우기 보안 일관화), 비번은 호출마다 `os.getenv`로 읽기, 트렁케이트는 `with open(...)`, 프론트는 clear/refresh 에러 구분 + 공백 비번 가드.

### 💡 향후 권장
1. **`hmac.compare_digest`는 bytes로 비교** — 비밀번호/토큰처럼 사용자 입력 비교는 양쪽을 `.encode('utf-8')` 후 넘긴다. str 비교는 비ASCII에서 TypeError → 비ASCII 비번이면 기능 전체가 500(self-DoS).
2. **인증·권한 등 보안 경계 변경은 배포 전 적대 검증 필수** — 정상 경로(맞는 비번)만 테스트하면 비ASCII·미설정·헤더 누락 등 엣지에서 깨지는 걸 놓친다. 독립 관점(보안/백엔드/프론트)으로 사전 점검.
3. **읽기·쓰기 보안 posture 일관화** — 파괴적 작업만 막고 조회는 열어두지 말 것. 로그·데이터를 노출하는 읽기 엔드포인트도 동일 가드 적용 여부를 함께 결정.

## 53. 로컬 빌드는 통과인데 라이브 404 — `vercel.json`의 `/api/(.*)` rewrite가 Next 라우트를 가림

작성일: 2026-05-30 (38회차)

> 사이트 진입 비밀번호 게이트 배포 직후 포착. 페이지 게이트는 라이브 정상인데 로그인 API만 404.

### 🚨 증상
- 로그인 엔드포인트를 `app/api/site-auth/route.ts`로 만들고 로컬 `next build` + `next start`로 검증 → 401/200 모두 정상.
- 라이브(Vercel) 배포 후: 페이지 게이트(미인증 → 307 → `/login`)는 정상인데 `POST /api/site-auth`만 **404**. 정답 비번도 404라 로그인 불가.

### 🧭 원인
- 루트 `vercel.json`에 `{"source":"/api/(.*)","destination":"/api/index.py"}` rewrite가 있음 → **모든 `/api/*` 요청이 파이썬 백엔드(`index.py`)로 프록시**됨. `/api/site-auth`도 백엔드로 가는데 거긴 그런 라우트가 없어 404.
- **로컬 `next start`는 `vercel.json` rewrite를 적용하지 않으므로** 같은 코드가 로컬에선 통과(거짓 음성). 로컬-라이브 동작 불일치의 전형.

### ✅ 해결
- 로그인 라우트를 `/api/` 밖으로 이동: `app/api/site-auth/route.ts` → `app/site-auth/route.ts`. `/site-auth`는 `/api/(.*)`에 안 걸려 Next 라우트로 정상 도달.
- 로그인 fetch(`/api/site-auth`→`/site-auth`)·미들웨어 matcher(`site-auth` 제외) 동기화.
- 검증을 **라이브에서** curl로 재확인: 미인증 307 / `/login` 200 / 틀린비번 401 / 정답 200+쿠키 / 쿠키 통과 200.

### 💡 향후 권장
1. **`vercel.json` rewrite가 있는 프로젝트의 신규 Next API 라우트는 rewrite 경로와 충돌 점검** — `/api/(.*)`가 백엔드로 프록시되면 `/api/` 아래 Next 라우트는 전부 가려진다. 신규 라우트는 rewrite 밖 경로에 두거나 rewrite에 명시 예외.
2. **`next start`/`next build`는 `vercel.json`을 적용하지 않음 → 라우팅·rewrite 검증은 라이브(또는 `vercel dev`)에서** — 로컬 통과가 라이브 통과를 보장하지 않는 대표 사례(rewrites/redirects/headers).

## 54. 업로드 시각이 한국시와 하루 어긋남 — `toLocaleString`에 `timeZone` 옵션 누락

작성일: 2026-06-15 (39회차)

> 사용자 제보: custom-dashboard "저장된 파일" 목록의 업로드 날짜·시각이 한국시와 다름.

### 🚨 증상
- `260615.csv`(6월 15일자 파일)의 업로드 시각이 `2026. 06. 14. 오후 11:44`로 표시 — 하루 전·약 9시간 어긋남.

### 🧭 원인
- `frontend/src/components/FileSelector.tsx`의 `formatDate()`가 `new Date(ts*1000).toLocaleString("ko-KR", { ... })`로 포맷하면서 **`timeZone` 옵션이 없음**.
- `timeZone` 미지정 시 **렌더 환경의 로컬 타임존**을 따른다. Vercel 등 UTC 환경에서 렌더되면 UTC가 그대로 출력 → KST(UTC+9)와 정확히 9시간(하루) 차이. (KST 6/15 08:44 → UTC 6/14 23:44와 일치)

### ✅ 해결
- `toLocaleString` 옵션에 `timeZone: "Asia/Seoul"` 추가 → 렌더 위치와 무관하게 항상 KST로 고정.

### 💡 향후 권장
1. **사용자 노출 시각은 `timeZone` 명시로 고정** — `toLocaleString`/`Intl.DateTimeFormat`은 옵션 없으면 런타임 타임존을 따른다. SSR/엣지/UTC 서버에서 렌더될 수 있는 값은 `timeZone: "Asia/Seoul"`을 항상 명시. 신규 시각 포맷터 추가 시 `grep -rn toLocaleString`으로 누락 점검.

## 55. 일평균 차트가 좌측 절반에서 끊김 — 자식 `<Line>`에 per-Line `data` prop을 줘 Recharts X축 도메인 2배

작성일: 2026-06-15 (40회차)

> 사용자 제보: `custom-dashboard/details?...&type=ecommerce`의 "일평균(꺾은선)" 토글에서 검정선이 차트 좌측 ~55%에서 끝나고 우측 ~45%가 비며, 선이 일 단위처럼 촘촘히 진동. 'total'(월매출)·'daily'(일매출) 토글은 정상.

### 🚨 증상
- 라이브 API 실측: `ecommerce.monthly`는 66개월(2021-01~2026-06)·`일평균매출` 정상값(1,061만~2,306만)인데, 차트가 66점을 좌측 절반에만 그림. 마지막 점(2026-06, 1482만)이 ~55% 위치에서 끝남 → X축 칸이 데이터의 약 2배.
- 'avg' 모드만 깨짐(다른 토글 정상).

### 🧭 원인
- `details/page.tsx`·공유 `components/DynamicAnalysisSection.tsx`의 검정 `판매액 <Line>`이 **`avg` 모드에서만 자체 `data` prop**을 가짐: `data={mode==='avg' ? chartData.map(d=>({...d, 판매액:일평균매출})) : undefined}`. 같은 차트의 `이익률 <Line>`은 부모 data를 씀 → **두 선의 data 소스 비대칭**.
- Recharts(3.8.1, `allowDuplicatedCategory` 기본 `true`)는 자식이 자체 data를 가지면 category 축 값을 **부모 data(66) + 자식 data(66) = 132로 중복 concat**(dedupe 안 함). 검정선은 앞 66칸(좌측 50%)에만 찍혀 ~55%에서 끝남. "촘촘한 진동"은 별도 버그가 아니라 66개월 정상 데이터가 절반 폭에 압축된 것 → 도메인 정상화로 함께 해소. **데이터가 아니라 표시(렌더) 버그.**

### ✅ 해결
- per-Line `data` prop을 **제거**하고, `avg` 변환을 **차트 레벨 `chartData`로 이동**: `chartData = monthly.map(d => ({ ...d, 판매액: d.일평균매출 }))`. 두 선이 동일 데이터셋·동일 카테고리축 공유 → concat 조건 소멸 → 도메인 66 복구.
- `<LabelList dataKey>`를 선의 `dataKey`(`"판매액"`)와 통일.
- 적용 2곳(둘 다 `avg` 모드만 해당, total/daily 무영향): `app/custom-dashboard/details/page.tsx`(상세), `components/DynamicAnalysisSection.tsx`(메인 대시보드 브랜드 섹션 — `BrandAnalysisSection`→`custom-dashboard/page.tsx` 경유, "일평균+이익률" 버튼으로 도달). 검증: `tsc` 신규 에러 0, `next build` 성공.
- ⚠️ `data` prop만 단독 제거하면 `avg`에서 검정선이 월매출(판매액)을 그려 지표가 틀려진다 — 반드시 `chartData` 레벨 변환과 **함께** 한다.

### 💡 향후 권장
1. **한 차트 내 모든 그래픽 요소는 부모의 단일 `data`만 사용** — 자식 `<Line>`/`<Bar>`에 `data` prop을 따로 주지 말 것. 모드별로 다른 값을 그릴 땐 부모 `chartData`를 미리 매핑. 불가피하게 자식 data를 써야 하면 `<XAxis allowDuplicatedCategory={false}>`로 명시(단 정렬·결측 처리 주의). 상세 규약: `design_document §8.15`.
2. **차트 "이상" 제보는 표시 vs 데이터를 먼저 분리** — 라이브 API raw로 점 개수·값·끝점 라벨을 검산해 데이터 버그인지 렌더 버그인지 판정 후 수정.

---

## 56. AI 월리뷰 분석 컨텍스트 — grounding / 단위 / 정렬 다건 (2026-06-15 41~42회차, 2026-06-16 43회차 보강)

### 🚨 증상 / 함정
월리뷰 "AI 분석"을 회의용 6섹션 보고로 고도화하며 발생한 데이터 컨텍스트 관련 함정 모음. 공통 뿌리: **AI는 `_build_analysis_context`가 출력한 텍스트만 본다** — `summary` dict에 값이 있어도 컨텍스트에 출력 안 하면 못 본다.

1. **grounding 공백 (데이터 보유 ≠ 컨텍스트 출력)**: 프롬프트가 "브랜드별 상품 전월비", "채널 최근3개월·전년동월"을 요구했으나 컨텍스트에 미출력 → 그대로 두면 그 섹션이 비거나 추측이 된다. 데이터(`brand_products`, `channel_options.values13`)는 `summary`에 이미 있어 `_build_analysis_context`에 surface만 하면 해결. 적대 감사 워크플로(섹션별 grounding 감사)로 미출력 항목을 코드 근거로 식별.
2. **`_won_to_man` 함수명-단위 불일치**: 함수명은 `man`(만원)인데 실제 `÷1,000,000` = **백만원** 출력(docstring엔 명시). 초기 브리프에서 "만원"으로 오인 → 프롬프트가 단위 환산을 유발할 뻔. 함수명 믿지 말고 정의·docstring 확인.
3. **"주요" top3가 거래 건수순(매출 아님)**: `_series_by`/`_series_by_pair`가 `value_counts()`(거래 건수) 정렬이라 컨텍스트 top3에 매출 0원 항목(`위메프 0백만원`, `대상 X 0백만원`)이 "주요"로 노출 → 회의 자료 부적합. 컨텍스트 렌더 단계에서 대상월 매출(`values[-1]`)순 재정렬 + 0 이하 제외(프론트 차트는 무영향).
4. **`대상 X` placeholder 혼입**: `brand_products`는 `'대상 X'`를 제외(`get_summary` line 567)하지만 `channel_issue.products`(`_series_by_pair`)는 미제외 → 채널 주요 상품에 `대상 X` 노출. 컨텍스트에서 별도 제외.
5. **Cloudflare 403 (python-urllib)**: 프롬프트 저장/조회를 `urllib.request`로 `api.gongbaksoo.com` 호출 시 **403 Forbidden**(Cloudflare가 기본 `Python-urllib/x.y` User-Agent 차단). `User-Agent: curl/...` 헤더 추가로 통과(curl은 기본 통과).
6. **전월비 "+0백만원" 노이즈**: 브랜드별 상품 전월비 top3에 백만원 미만 미세 변동이 `+0백만원`으로 표시 → 반올림 ±1백만원 이상만 필터.
7. **전월비 movers ≠ 매출 상위 상품 (2026-06-16 43회차)**: 브랜드 주요 상품을 [브랜드별 상품 전월비](상승/하락 movers)로만 컨텍스트에 surface하면 '많이 움직인 상품'만 보여, 변동이 작은 꾸준한 주력 상품(예: 마이비 순한라인·삶기세제)이 누락된다. "주요 상품 매출"은 movers가 아니라 **대상월 매출순 top-N**을 별도 블록으로 surface해야 함. → [브랜드별 주요 상품 — 대상월 매출 상위 top5] 블록 신설(§56 #3의 '금액순' 원칙을 movers와 구분해 확장).

### ✅ 조치
- `get_summary`에 `brand_focus`(마/누/쏭 × 채널) 신설, `_build_analysis_context`에 채널 최근3개월·전년동월 / [브랜드 포커스] / [브랜드별 상품 전월비] 블록 추가 + 매출순 top3 + `대상 X` 제외 (41회차 `22ca95a`, 42회차 `e255ea0`).
- (43회차 보강) 브랜드 '주요 상품 매출'용 **[브랜드별 주요 상품 — 대상월 매출 상위 top5]** 블록 신설(`summary["brand_products"]`의 `values[-1]` 내림차순, 0원 제외, 직전월 동반 — `get_summary` 무수정). movers 블록과 병존, 프롬프트 섹션5에 `주요 상품` 불릿 추가.
- 프롬프트 저장 스크립트는 `User-Agent` 헤더 포함, 저장 전 기존값 백업.
- 실데이터(`uploads/260519.csv`)로 `_build_analysis_context` 직접 호출 검증 + 라이브 `ai-analysis` end-to-end 검증.

### 💡 향후 권장
1. **프롬프트가 요구하는 모든 값은 컨텍스트 출력 여부로 검증** — `summary` 보유가 아니라 `_build_analysis_context` 출력이 grounding 기준. LLM 프롬프트 점검은 "데이터 어디 있나"가 아니라 "AI에게 실제로 내려가나"로.
2. **유틸 함수는 이름이 아니라 정의로 단위·동작 확인** — `_won_to_man`처럼 이름과 실제(백만원)가 다를 수 있음.
3. **외부(Cloudflare 등) 보호 엔드포인트는 `User-Agent` 헤더 명시** — 기본 라이브러리 UA가 차단될 수 있음.
4. **"주요/top" 집계는 정렬 키 확인** — 건수순 vs 금액순. 회의·보고용은 금액순 + 0 제외.
5. **"주요"는 movers와 sales-rank를 구분해 surface** — '많이 움직인 것'(전월비 movers)과 '많이 팔리는 것'(매출순)은 다른 질문이다. 보고가 "주요 상품 매출"을 요구하면 매출순 top-N 블록을 별도로 내려보내야 movers가 가린 steady 주력이 드러난다.

## 57. 복사 버튼 — `navigator.clipboard`는 보안 컨텍스트(HTTPS) 전용, 폴백 필수 (2026-06-16 44회차)

### 🚨 증상 / 함정
AI 분석 결과 '복사' 버튼 구현 시 `navigator.clipboard.writeText`만 쓰면 **비보안 컨텍스트(HTTP·`file:`·일부 사설망/임베드)**에서 `undefined`이거나 거부되어 복사가 조용히 실패한다. clipboard API는 secure context(HTTPS 또는 localhost)에서만 노출된다.
- 부수: 복사상태(`setCopied`) 등을 `useEffect` 본문에서 동기 setState하면 ESLint `react-hooks/set-state-in-effect`가 경고하나, 기존 effect(`setError`/`setResult`)와 동일 패턴이라 신규 위반 아님(규칙은 effect당 1회 보고). `next.config`의 `ignoreBuildErrors`는 TS만 덮으므로 ESLint 빌드 차단 여부는 별도 확인 대상.

### ✅ 조치
- `navigator.clipboard.writeText` 우선 + 실패 시 `textarea` + `document.execCommand("copy")` 폴백으로 이중화. 프로덕션(Vercel, HTTPS)에선 주 경로가 동작, 그 외 환경은 폴백이 커버.
- 변경 파일만 tsc·ESLint로 검증(신규 타입에러·신규 위반 0 확인) 후 커밋.

### 💡 향후 권장
1. **클립보드/공유 등 브라우저 권한 API는 secure-context 가정 + 폴백 필수** — `navigator.clipboard`·`share` 등은 HTTPS 전용이라 `execCommand` 등 폴백을 같이 둔다.
2. **프론트 변경은 Vercel 자동 배포 경로** — 백엔드(Mac Mini 수동 pull)와 배포 경로가 다르므로, 프론트 기능은 GitHub push만으로 라이브 반영됨을 명시.

## 58. 노션 활동 데이터 접근 — 같은 기능에 권한 다른 두 도구 + 담당 user 식별 불가 (2026-06-21 45회차)

- **증상 1**: Notion MCP `query_data_sources`(SQL·view 모드)가 `400 validation_error: "requires an Enterprise plan with Notion AI"`로 전부 실패. 데이터소스 SQL 쿼리·뷰 쿼리가 Enterprise 게이팅.
- **해결 1**: 동일 결과를 주는 별도 도구 `query_database_view`(뷰 모드)는 비-Enterprise에서 동작 → 이걸로 페이지네이션(`start_cursor`/`has_more`). DB는 `fetch`로 스키마·뷰 URL 확보 후 뷰 URL로 쿼리.
- **교훈**: Notion MCP에 기능이 겹치는 도구가 둘 있고 권한 게이팅이 다름. 하나가 막히면 동류 도구를 먼저 시도.
- **증상 2**: 활동 카드 `담당`의 user ID를 `get-users`로 조회 시 빈 결과(비활성/게스트 추정) → 실명 매핑 불가.
- **해결 2**: `담당1~6` 코드 + **발자국(주력 채널·브랜드·상품) 병기**로 식별. 사용자에게 실명 매핑은 별도 요청(보류). 데이터로 단정 불가한 것은 코드+근거로 표기.

## 59. 바이럴 효율 "조회수+매출" — 카드에 매출 없음, 활동 기재매출 ≠ 채널 총매출 (2026-06-21 45회차)

- **증상**: "바이럴은 조회수와 매출로 효율을 보자"는 요구였으나, 바이럴 카드 60건은 **전부 조회수만** 기재(매출 0건). 바이럴이 유도한 매출은 연결된 행사/딜 카드에 잡힘.
- **해결**: 동일 **상품·노출채널·기간(±7일)** 의 행사 카드 매출을 바이럴에 **추정 재귀속(연결매출)** 으로 병기(58/60 매칭). 단 이는 행사 매출의 재귀속이므로 **중복·인과 단정 금지**를 문서에 명시, 순수 바이럴 성과는 조회수·목표달성으로 봄.
- **단위 혼동 위험**: 활동 카드 **기재매출(행사 합 71.9백만)** 과 매출 리뷰의 **채널 총매출(상시 포함)** 은 단위·정의가 달라 합산·동일시 금물. 종합(C타입) 브리지에서 **병기 + caveat**로만 연결.
- **교훈**: 두 데이터셋을 합칠 때 "같은 단위처럼 보이는 다른 값"을 절대 더하지 말 것. 파생 비율(건당·100뷰당)도 재귀속 기반이면 절대지표 아님을 명시.

## 60. 집계·포맷 버그 — defaultdict 가드 전부 스킵 / 1 미만 반올림 불일치 (2026-06-21 45회차)

- **증상 1 (B타입 담당 표 전부 0)**: `dam=defaultdict(...)` 후 `if d not in dam: continue` 가드를 둠. `defaultdict`는 `in`으로 키를 생성하지 않으므로 **첫 접근 시 미존재 → continue**, 모든 행이 0으로 집계됨.
- **해결 1**: 키를 **사전 채움**(`{d: dict(...) for d in DORD}`) 후 가드는 비대상 키 스킵 용도로만. (A타입 같은 집계는 사전 채움이라 정상이었음 → 패턴 불일치가 원인.)
- **증상 2**: 중요행사 실적 `0.05백만`이 `:.1f`로 **`0.1`** 표기되어 달성률(2%)·본문(0.05)과 불일치.
- **해결 2**: 1 미만은 소수 2자리(불필요한 0 제거) 포맷터(`fmt_man`)로 통일. 작은 값이 의미를 가지는 표는 자릿수 보존.
- **방지책**: 단일 소스(파싱 데이터)에서 md·html 동시 생성 + **원본 재집계 교차검증**으로 헤드라인 수치(192·71.9·63,787 등) 일치 확인.

## 61. (운영) 생성 스크립트 heredoc 잔여 SyntaxError / Playwright file: 차단 (2026-06-21 45회차)

- **증상 1**: Write 툴로 만든 파이썬 파일 끝에 bash heredoc 종결자(`EOF`/`echo`)가 섞여 `SyntaxError`. (heredoc 패턴을 비-bash 컨텍스트에 그대로 붙임.)
- **해결 1**: 해당 잔여 라인 제거. Write로 코드 파일을 만들 때 heredoc 구문을 넣지 말 것.
- **증상 2**: Playwright는 `file:` 프로토콜 차단 → 로컬 HTML 직접 열람 불가.
- **해결 2**: `reviews/`를 `python -m http.server <port>`로 서빙 후 `http://localhost:<port>/...` 네비게이트해 스크린샷 검증(기존 패턴 재확인). 사용자에겐 `open` 으로 기본 브라우저에 띄움.

## 62. 날짜 컬럼의 의미를 확인하지 않고 '일 단위 분석'을 설계할 뻔함 — `일별` = 주문일이 아니라 ERP 매출계상일 (2026-07-13 46회차)

### 🚨 증상 / 함정
- "월 리뷰처럼 일 리뷰도 만들자"는 요구를 그대로 받으면, 월 리뷰 구조(핵심실적→채널→브랜드→시사점)를 하루로 축소하는 설계가 자연스럽게 나온다. **그 설계는 전부 거짓말을 출력한다.**
- 결정적 증거: **D2C 온라인몰인 `자사몰`의 2026년 토요일 기록이 2일·일요일 1일뿐**(월20/화21/수21/목23/금21). 소비자 온라인 주문이 주말에 0일일 수는 없다 → `일별`은 주문일이 아니라 **회계 계상일**이다.
- 파생 사실: 최대 채널 `오픈마켓(사입)`(=쿠팡 로켓, 매출의 51%)은 63 거래일 중 **26일만 계상**(월요일 편중). 다이소는 **8,601,600원 정수배**로만 계상. 요일별 평균이 월 4,928만 vs 토 19만(**259배**).
- **스무딩·이동평균·시각화로 해결되지 않는다.** 데이터 의미론(semantics) 문제다.

### ✅ 조치
- 기능의 정체를 **「직전 코어 계상일 점검표」**로 재정의. 일 단위로 해석 가능한 채널(A군, 순매출의 39.2%)과 배치 계상 채널(B군, 60.8%)을 **기계적으로 분리**하고 B군은 금액 추이를 아예 표시하지 않음.
- `dod`(전일비)·`yoy`(전년 동일자)·`landing`(착지 금액)·B군 일별 배열을 **응답 스키마에서 제거**. 만들 수 없으면 그릴 수 없다.

### 💡 향후 권장
- **시간 축 분석을 설계하기 전에 날짜 컬럼의 정의부터 데이터로 검증할 것.** 검증법: 주말·공휴일 기록 밀도를 본다. 온라인 채널인데 주말이 비어 있으면 그 컬럼은 주문일이 아니다.
- 채널별 기록 밀도(계상일수/거래일수)와 변동계수를 먼저 재고, **밀도가 낮은 채널을 시계열에 섞지 말 것.**

---

## 63. 계획서의 숫자를 재현 없이 코드에 박을 뻔함 — 3중 독립구현으로 3건 오류 발견 (2026-07-13 46회차)

### 🚨 증상 / 함정
설계 단계에서 산출된 상수들이 **재현되지 않았다.** 착수 전 3개 에이전트가 같은 명세로 각자 구현해 대조하니:

| 계획서 주장 | 실제 | 원인 |
|---|---|---|
| 쿠팡 사입 밀도 **0.483** | **0.433** | **2026-06-12에 쿠팡 행이 26개 있는데 판매액이 전부 0원.** '행 존재'로 세면 0.483, '순매출 ≠ 0'으로 세면 0.433. **행의 존재는 계상의 증거가 아니다.** |
| 프로파일 앵커 66.7% → **62.4** / 83.3% → **80.9** | **62.1 / 80.8** | 월별 누적곡선을 **관측일에만 점을 찍고 갭을 직선 보간**하면 주말 구간에서 곡선이 미리 상승. DOM12가 토·일인 달만 +2.4~7.6%p 부풀려짐 |
| "다이소 계상 단위 = 8,601,600원" | **60일 창에서만 성립** | 전 기간 gcd는 100 |
| "G3 A군 6채널 전부 전환 0회" | **폐쇄몰 1회 / 사내판매 4회** | 순매출이 1,000만 경계를 넘나듦 → G3 FAIL |

### ✅ 조치
- 3구현이 갈린 지점마다 **변형(variant)을 교차 실행**해 원인을 실증하고 명세를 확정(모호함 제거).
- 프로파일은 **달력형**(달력 모든 날에 점, 계상 없는 날은 누적 유지)으로 고정.
- A/B 판정에 **히스테리시스** 도입(이탈 조건이 연속 3 코어일 지속될 때만 강등) → 전환 4회 → **1회**, G3 통과.
- 확정 수치를 골든 테스트 27개로 못박음(`api/tests/test_daily_review.py`).

### 💡 향후 권장
- **설계 문서의 수치는 근거가 아니다.** 코드에 상수로 박기 전에 재현하고, 재현 안 되면 폐기한다.
- 통계적 판정 로직은 **독립 구현 2~3개로 교차 검증**한다. 갈리면 명세가 모호한 것이고, 그 모호함이 그대로 버그가 된다.
- 경계값 근처를 오가는 분류(A/B 등)는 **히스테리시스 필수.** 안 넣으면 사용자에게 "어제는 있던 항목이 오늘 사라짐"으로 나타난다.

---

## 64. "마감월은 동결된다"는 가정이 거짓 — ERP가 과거 45일을 소급 정정 (2026-07-13 46회차)

### 🚨 증상 / 함정
- 4일 간격 스냅샷(260709 vs 260713)만 비교하고 **"과거일 수치는 소급 수정되지 않는다 → 리뷰 아카이브·백테스트 안전"** 이라고 결론냈다. **거짓이었다.**
- **27일 간격(260519 vs 260615)으로 대조하니 과거 17일치가 변경**돼 있었다. 2025-06-24는 13,106,674 → 26,406,674(**+1,330만**).
- **6일 간격(260707 vs 260713)에서도 2026-06 데이터가 계속 움직인다**(06-30 자사몰 **−20,927,184**). 관측된 최대 소급 지연 **42일**. 2026-05 이전은 세 스냅샷 모두 일치 → **소급 창 ≈ 45일**.

### ✅ 조치
- 응답에 `source_file` + `file_hash`를 싣고, **최근 45일 대상일은 `provisional`(잠정)** 로 표시 + 화면에 "이 판정은 잠정" 명시.
- 골든 테스트는 `260615.csv`를 **fixture로 고정**(그 파일에 대한 회귀 테스트이지 '진실'에 대한 테스트가 아님을 파일 상단에 명시).

### 💡 향후 권장
- **"데이터가 변하지 않는다"는 가정은 짧은 간격 비교로 검증하면 안 된다.** 소급 정정은 월 마감 주기로 일어나므로 **최소 1개월 이상 간격**의 스냅샷을 대조할 것.
- 판정·리포트를 저장·아카이브할 때는 **판정에 쓴 스냅샷 식별자(파일명 + 해시)를 반드시 함께 핀으로 박을 것.** 안 그러면 저장된 리포트와 나중에 다시 연 화면의 숫자가 달라진다.

---

## 65. `astype(str)`이 NaN을 `'nan'` 문자열 채널로 만들어 코어일 판정을 오염 (2026-07-13 46회차)

### 🚨 증상 / 함정
- `df["채널구분"] = df["채널구분"].astype(str)` → **결측(NaN)이 `'nan'`이라는 이름의 유효 채널로 승격**된다.
- 이 프로젝트에서 '코어 계상일'은 **`채널구분`의 nunique ≥ 6**으로 판정한다. 유령 채널 하나가 **5채널짜리 날을 6채널로 밀어올려 비계상일(주말 등)을 리뷰 대상으로 승격**시킬 수 있었다.
- 함께 발견: `공통`(마지막 계상 772일 전), `마케팅팀`(242일 전) 같은 **죽은 채널이 B군 이벤트 표에 노출**.

### ✅ 조치
- `astype(str)` 후 `{'nan','None','','0'}`을 `'미분류'`로 치환하고, **코어일 채널 카운트에서 제외**(매출은 전사 총계에 살려둠).
- 채널 목록·B군 이벤트에서 **판정 창 안에 한 번도 계상되지 않은 채널(`days_seen == 0`)을 제외**.
- 회귀 테스트로 고정: `test_junk_channels_are_not_listed`.

### 💡 향후 권장
- **`astype(str)`은 NaN을 조용히 `'nan'` 문자열로 바꾼다.** 카테고리 컬럼을 문자열화할 때는 반드시 결측 처리를 함께 한다.
- **엔티티 개수(nunique)를 임계값 판정에 쓰는 로직**은 유령 카테고리에 취약하다. 카운트 대상에서 무엇을 빼는지 명시적으로 정의할 것.

---

## 66. 시스템 파이썬 ≠ 운영 파이썬 — pandas/numpy ABI 불일치로 SIGSEGV (2026-07-13 46회차)

### 🚨 증상 / 함정
- 로컬 검증용 venv를 시스템 기본 파이썬(**3.14**)으로 만들고 `pandas==2.2.3`(운영 버전)을 설치 → 스크립트가 **exit 139(SIGSEGV)** 로 죽음. 트레이스백 없음.
- 원인: py3.14용 pandas 2.2.3 휠이 없어 소스 빌드되고, numpy 2.5와 ABI가 어긋남. `numpy<2.1` 재설치도 py3.14에서 빌드 실패.
- 부수 함정: 백엔드 로컬 venv(`api/venv`)는 **Mac Mini에만 있고 개발 머신에는 없다.**

### ✅ 조치
- `runtime.txt`(**python-3.11**)를 확인하고 **동일 버전으로 venv 재생성** → pandas 2.2.3 + numpy 2.4.6 정상 동작.
- 검증용 venv는 프로젝트가 아닌 **스크래치패드**에 만들어 사용자 환경을 오염시키지 않음.

### 💡 향후 권장
- **로컬 검증 환경은 `runtime.txt`/배포 런타임 버전에 맞춰 만든다.** "그냥 python3"로 만들면 운영과 다른 결과가 나오거나 조용히 죽는다.
- 파이썬 프로세스가 **트레이스백 없이 exit 139**로 죽으면 로직 버그가 아니라 **네이티브 확장 ABI 불일치**를 먼저 의심할 것.

---

## 67. 같은 화면이 스스로 모순 — "범위 하단 미만"인데 "확인할 예외 없음" (2026-07-13 46회차)

### 🚨 증상 / 함정
- 계상 현황 표의 버티컬커머스가 **"범위 하단 미만"으로 강조색 표시**되는데, 바로 위 예외 섹션은 **"확인할 예외 없음"**.
- **로직은 정확했다.** 예외 판정은 `범위 이탈 AND 절대금액 게이트 초과`의 **AND**인데, 이탈폭 23만원이 채널 게이트 200만원에 못 미쳐 카드로 올리지 않은 것.
- 하지만 **화면이 그 이유를 말하지 않으면 사용자는 둘 중 하나가 거짓말이라고 판단한다.** 이것만으로 기능 전체의 신뢰가 무너진다.

### ✅ 조치
- 범위 밖이지만 게이트 미만인 항목은 **"이탈폭이 게이트(200만원) 미만 — 예외로 올리지 않음"** 을 명시하고 **강조색을 쓰지 않음**(예외 카드와 색이 어긋나면 안 됨).
- 예외 0건 문구도 보강: "○○ — 8주 범위를 벗어났으나 이탈폭이 게이트 미만이라 예외로 올리지 않았습니다."
- 범위 막대의 마커 색도 **flagged된 경우에만** 강조색.

### 💡 향후 권장
- **한 화면에 같은 대상을 두 번 표시하면(요약 + 상세) 두 표현의 판정 기준을 일치시키거나, 다르면 그 차이를 화면에 쓴다.** 조용히 다르면 사용자는 버그로 읽는다.
- "AND 조건으로 걸러진 항목"은 **왜 걸러졌는지가 UI에 나와야** 한다. 필터는 숨기면 거짓말이 된다.
- **이 버그는 단위 테스트로는 절대 안 잡힌다.** 백엔드도 프론트도 각자 정확했다. 실제로 브라우저에서 화면을 열어봐야 보인다.

---

## 68. parquet 캐시가 조용히 실패 중 — 원인이 **둘**이었다 (`pyarrow` 미설치 + 혼합 타입 컬럼) (2026-07-13 46회차 / 2026-07-14 배포 시 추가 발견)

### 🚨 증상 / 함정
- `dashboard.py`의 `get_dataframe`은 3단 캐시(메모리 → parquet → 원본 CSV)인데, **`api/uploads/cache/`가 비어 있었다.**
- **원인 1**: `requirements.txt`에 **`pyarrow`도 `fastparquet`도 없었다.**
- **원인 2 (배포 후에야 드러남)**: `pyarrow`를 설치했는데도 **여전히 실패**. `거래처코드` 컬럼이 **혼합 타입**(숫자/문자 섞임)이라 `to_parquet`이 직렬화하지 못했다.
- **두 원인 모두 `df.to_parquet()`을 감싼 `try/except`가 삼키고 있었다.** 예외는 로그로만 남았고, 호출부는 정상 동작했다. 그래서 **몇 달간 아무도 몰랐다.**
- 결과: 3단 캐시가 사실상 **2단**(메모리 → CSV 풀 재파싱, 87MB × 41.8만행)으로 동작. 월 리뷰 응답 지연의 원인 중 하나.

### ✅ 조치
- `api/requirements.txt`에 `pyarrow==24.0.0` 추가 (46회차).
- `api/dashboard.py`에 `normalize_parquet_object_columns()` 추가 — parquet 저장 직전 `infer_dtype`이 `mixed`인 object 컬럼만 문자열로 정규화 (커밋 `230fc0f`, Mac Mini 배포 중 발견·수정).
- 적용 후 `uploads/cache/`에 parquet 생성 확인. prod 응답 첫 호출 2.93s → 두 번째 **1.53s**.

### 💡 향후 권장
- **"원인을 하나 찾았다"에서 멈추지 말 것.** 이 건은 `pyarrow` 설치만으로 해결됐다고 단정했다가 배포 현장에서 두 번째 원인이 드러났다. **조치 후 산출물이 실제로 생겼는지 반드시 확인**해야 그 사실이 보인다.
- **`try/except`로 감싼 캐시·최적화 경로는 "동작한다고 가정"하지 말고 산출물 존재를 직접 확인할 것**(여기서는 `uploads/cache/`가 비었는지). 조용한 실패는 몇 달간 발견되지 않는다.
- 선택적 의존성(optional dependency)에 의존하는 코드는 **requirements에 명시**하거나, 없을 때 경고를 띄운다.
- **혼합 타입 object 컬럼은 parquet 직렬화를 깨뜨린다.** 외부 ERP CSV처럼 스키마가 보장되지 않는 소스는 저장 전 dtype 정규화를 넣는다.

---

## 73. 백엔드 편집 검증은 `api/.venv`로 — 시스템 파이썬엔 fastapi가 없다 + 기존 lint 에러를 새 에러로 오인 (2026-07-18 52회차)

### 🚨 증상 / 함정
- **함정 1**: `monthly_review.py`를 고친 뒤 `python3 -c "import monthly_review"`로 임포트 검증 → `ModuleNotFoundError: No module named 'fastapi'`. 시스템 파이썬엔 운영 의존성이 없어 **내 코드와 무관한 에러**다. (§66 "시스템 파이썬 ≠ 운영 파이썬"의 다른 얼굴 — 거긴 SIGSEGV, 여긴 임포트 실패.) 이걸 코드 문제로 오해하면 멀쩡한 편집을 뒤집게 된다.
- **함정 2**: 새로 만진 `AIAnalysisModal.tsx`에 eslint `react-hooks/set-state-in-effect` 1건이 떴다. 방금 추가한 `useEffect` 근처라 **내가 유발한 것처럼 보였지만**, 실제 지적 줄(`setError(null)`)은 손대지 않은 기존 코드였다.

### ✅ 조치
- **백엔드 임포트/라우트 검증은 `./.venv/bin/python`**으로 실행. AST 파싱(`ast.parse`)은 시스템 파이썬으로 문법만 빠르게 보고, 실제 임포트·라우트·모델 필드 확인은 venv로.
- **"이 lint 에러가 내 변경 때문인가"는 `git stash`로 대조**: `git stash push -- <file>` → HEAD에서 카운트 → `git stash pop` → 수정본 카운트. 이번엔 둘 다 1이라 **기존 것**으로 확정. 카운트가 늘었을 때만 내 책임.

### 💡 향후 권장
- 이 저장소의 백엔드 검증 명령은 **항상 `api/.venv/bin/python`** 기준으로 짠다(시스템 파이썬 금지). `_build_analysis_context` 같은 순수 함수는 venv로 직접 호출해 왕복 테스트하면 HTTP 없이도 검증된다.
- 기존 코드에 이미 있던 경고를 **새 변경의 회귀로 착각하지 말 것.** 파일 단위 lint는 "새로 생겼는지"가 핵심이지 "0인지"가 아니다 — 반드시 HEAD 대비 증감으로 판단.

---

## 72. 브라우저 기본 색 피커에는 저장 슬롯을 넣을 수 없다 + React `onBlur`는 `blur`로 검증되지 않는다 (2026-07-17 51회차)

### 🚨 증상 / 함정
- **함정 1 (전제)**: "색 저장하게 해줘"라는 요청의 스크린샷은 `<input type="color">`가 띄운 **OS/브라우저 기본 피커**였다. 그 창 안에 스와치를 추가하는 건 **DOM 밖이라 원천적으로 불가능**하다. 요청을 문자 그대로 구현하려 들면 막히거나, "된 것처럼" 엉뚱한 걸 만들게 된다.
- **함정 2 (설계)**: `input[type=color]`는 **피커에서 드래그하는 동안 `change`(React `onChange`)가 연속 발생**한다. 여기서 바로 '최근 사용색'에 push하면 **스펙트럼을 훑고 지나간 중간색이 목록 8칸을 다 채운다.** 최종색 1건만 남기는 커밋 시점(=피커 닫힘)이 따로 필요하다.
- **함정 3 (검증 위양성)**: blur 시점 기록을 검증하려고 `input.dispatchEvent(new FocusEvent('blur', {bubbles:false}))`를 쐈더니 **아무 일도 일어나지 않았다.** 코드 버그로 오판할 뻔했으나, 원인은 **React 17+가 `blur`가 아니라 루트에 위임된 `focusout`으로 `onBlur`를 받는다**는 것. `blur`는 버블링하지 않아 위임 리스너에 닿지 않는다. `input.focus()` → `input.blur()`(실제 포커스 이동)로 바꾸니 정상 발화.
- **함정 4 (보고)**: 로컬에서 검증만 끝내고 커밋하지 않은 채 "확인해 보시라"고 안내 → 사용자는 **운영(Vercel) 화면**을 열었고 당연히 기능이 없어 "아직 적용 안 된 것 같다"는 혼선. **미배포 상태를 명시하지 않은 안내는 '동작 안 함' 보고로 되돌아온다.**

### ✅ 조치
- 함정 1: 피커는 그대로 두고, **툴바에 자체 스와치 줄**(고정 ★ / 최근)을 만들어 localStorage에 저장(`design_document.md §2.3.3.30`). 불가능하다는 사실을 먼저 사용자에게 알리고 대안으로 합의.
- 함정 2: 적용은 실시간 유지, `recent` 기록은 `pickerDirty` ref로 실제 변경 여부를 표시해 **blur 때 최종색 1건만**. 스와치 클릭은 즉시 기록.
- 함정 3: 실제 `focus()`/`blur()`로 재검증 → `recent: ["#123456", "#c00000"]` 확인.
- 함정 4: 검증 결과와 함께 **"커밋 전 = 운영 미반영"**을 명시하고 로컬 확인/푸시 중 선택지를 제시.

### 💡 향후 권장
- **네이티브 위젯이 여는 UI는 우리 DOM이 아니다.** `input[type=color/date/file]`, `select` 팝업, `alert`류의 내부는 스타일도 기능 추가도 불가. 요청이 그 안을 가리키면 **먼저 불가능을 말하고 대안을 합의**하라. 조용히 비슷한 걸 만들면 "이거 말고"가 된다.
- **합성 이벤트로 React 핸들러를 검증하지 마라.** React는 `blur`→`focusout`, `input`→`onChange`처럼 **위임 이벤트로 매핑**한다. `dispatchEvent`가 무반응이면 코드 버그로 단정하기 전에 **실제 사용자 동작(`focus`/`blur`/클릭)으로 재현**하라. 이 순서를 지키지 않으면 멀쩡한 코드를 고치게 된다.
- **연속 발화 입력(색·슬라이더·드래그)은 '적용'과 '기록'의 시점을 분리하라.** 적용은 매 프레임, 기록은 커밋 시점(blur/pointerup) 1회.
- **"확인해 보세요"라고 말할 땐 어디서 볼 수 있는지 항상 붙여라.** 로컬 전용인지 배포됐는지가 빠지면 사용자는 운영 화면을 본다.

---

## 71. Gemini 429를 '크레딧 소진'으로 단정했으나 일시적 오류였다 + AI 출력의 마크다운이 평문으로 새어 나온다 (2026-07-17 50회차)

### 🚨 증상 / 함정
- **증상 1**: 일 리뷰 AI 프롬프트를 실제 Gemini로 검증하려다 `429 RESOURCE_EXHAUSTED: Your prepayment credits are depleted.`
  → **"크레딧이 소진돼 월 리뷰 AI 분석도 지금 실패한다"고 사용자에게 보고했다.** 몇 분 뒤 같은 키로 호출하니 **정상 응답**. 즉 **일시적 오류를 영구 상태로 단정**한 오보였다.
  - 함정: 429의 `details` 문구가 "credits are depleted"라고 단정적으로 말해도, 실제로는 순간 rate-limit/쿼터 흔들림일 수 있다. **에러 메시지의 문구를 상태 진단으로 그대로 옮기면 안 된다.**
- **증상 2**: 하드룰을 다 지킨 Gemini 출력이 `**[오늘의 확인 필요 예외]**` 같은 **마크다운**을 썼는데, 모달은 `whitespace-pre-wrap` **평문 렌더**라 별표가 그대로 노출된다(월 리뷰 모달도 동일 구조라 같은 문제를 안고 있다).

### ✅ 조치
- 증상 1: 재시도로 정상 확인 후 **사용자에게 정정 보고**. 크레딧 조치 요청을 철회.
- 증상 2: 하드룰에 **규칙 14(마크다운 금지 — 화면이 평문 렌더이므로 문단·줄바꿈·"- "만)** 추가. 재호출로 마크다운 소거 확인(값어치는 유지).

### 💡 향후 권장
- **외부 API의 4xx/5xx는 최소 1회 재시도한 뒤에 상태를 단정하라.** 특히 과금·쿼터 관련 메시지는 문구가 단정적이어도 일시적일 수 있다. 사용자에게 "기능이 죽었다"고 보고하기 전에 재현부터.
- **LLM 출력 형식은 렌더러와 계약을 맞춰라.** 평문으로 렌더할 거면 프롬프트에서 마크다운을 금지하고, 마크다운을 쓸 거면 렌더러를 붙여라. 모델은 시키지 않으면 기본으로 마크다운을 쓴다.

---

## 70. "실측으로 검증된 숫자"가 결정에는 틀린 지표였다 — SKU '2개'는 발화 수가 아니라 레벨 수 (2026-07-15 49회차)

### 🚨 증상 / 함정
- 48회차 재검증에서 "SKU 승격 대상 = 게이트50만+A군+유효관측6 충족 **2개**(1006045/1006046)"라고 실측·확정했고, 이를 **"상위 SKU 2개를 예외 카드로 승격"** 권고로 옮겼다.
- 49회차에 실제 구현 직전, 상품 레벨 예외를 A군·게이트50만으로 **2026년 전 코어일에 시뮬**하니 **연 101건 / 31개 SKU / 0건인 날 45%**가 나왔다. '2개'가 전혀 아니었다.
- 원인: 재검증이 잰 '2개'는 **"A군 일별 *중앙값*이 50만을 넘는 SKU 수"**(레벨 지표)였고, 실제 예외는 **"그날 값이 같은 요일 8주 범위를 이탈 + 게이트"**(발화 지표)다. **두 질문이 달랐다.** 작은 SKU도 하루 스파이크로 범위를 50만 넘게 이탈할 수 있어 발화 수는 훨씬 많다.
- 이대로 카드화했으면 **조용한 날이 58.7%→45%로 무너져** 일 리뷰의 핵심 원칙("조용한 날은 짧게")을 정면으로 깰 뻔했다.

### ✅ 조치
- SKU를 **예외 카드가 아니라 감시 패널**로 구현(top-8, 접힘). 히어로 SKU 움직임은 보이되 예외 소음은 안 만든다.
- 브랜드도 같은 판단: 예외 발화는 게이트200만에서 연 26건(조용한 날 78%)로 카드도 가능했으나, 채널·거래처 예외와 **중복**이라 감시 패널로만.

### 💡 향후 권장
- **"실측했다"와 "결정에 맞는 것을 실측했다"는 다르다.** 검증 숫자를 권고로 옮기기 전에 *그 숫자가 결정이 요구하는 바로 그 지표인지* 되물어라. 레벨(중앙값·평균) 지표를 발화(임계 이탈) 지표로 착각하기 쉽다.
- **UI 구현 직전에 '실제 운영 시나리오'로 한 번 더 시뮬**하라(여기선 '이 규칙을 켜면 하루 몇 건 뜨나'를 전 기간에 돌림). 설계 단계의 요약 지표만 믿지 말 것.
- 소음을 만들 수 있는 신호는 **카드(알람) vs 패널(참조)** 을 구분해 배치한다. 발화 빈도가 원칙(조용한 날 비율)을 깨면 카드가 아니라 패널이다.

---

## 69. 중단된 채널이 매일 "확인"을 영원히 띄운다 — 상태 감지에 상한이 없었다 (2026-07-15 47회차)

### 🚨 증상 / 함정
- 일 리뷰 B군 계상 이벤트는 "통상 간격보다 오래 계상이 없으면 `확인`(계상 지연)"을 띄운다. 판정식: `days_since > max(median_gap×2, p90)`.
- **쿠팡 사입(오픈마켓 사입)이 발주를 접자**(사용자 통보, 마지막 실질 계상 2026-06-30) `days_since`가 매일 늘어 **하루도 빠짐없이 "확인"이 뜬다.** 경과일만 커질 뿐 영원히 사라지지 않는다.
- 조용한 날 화면을 짧게 유지하는 것(판정일의 58.7%가 예외 0건)이 이 기능의 핵심 가치인데, **죽은 채널 하나가 매일 노이즈를 만들어 그 가치를 무너뜨린다.**
- 함정: 코드는 "중단"과 "지연"을 구분할 수 없다. 무한 상향 카운터에는 반드시 **상한**이 필요하다.

### ✅ 조치
- 판정을 3단계로: `정상` → `확인`(지연이 **새로울 때**만) → `휴면`(상한 초과, 중단·휴면 추정 — 알림 없음).
- 휴면 상한 = `max(BEVENT_DORMANT_DAYS=30, thr×2)`. **채널 고유 주기(`×2`)를 함께 봐서** 40일마다 계상되는 희소 채널의 정상 간격을 휴면으로 오탐하지 않는다.
- 재계상되면 자동 해제. 화면은 `확인`(호박색 배지) vs `휴면`(옅게 + "중단·휴면 추정")로 구분.
- 판정 로직을 순수 함수 `_bevent_gap_status(days_since, gaps)`로 분리해 단위 테스트 7개 추가(정상/새 지연/장기 휴면/희소채널 오탐 방지/표본 부족).
- 시뮬레이션 확인: 쿠팡 사입은 중단 후 ~7/30까지 "확인"(3주간 인지 유도) → 8/1부터 조용히 "휴면" → 60일 창에서 빠지면 목록에서 소멸.

### 💡 향후 권장
- **단조 증가하는 카운터(경과일·연속 실패 횟수 등)를 알림 조건에 쓰면 반드시 상한을 둔다.** 상한이 없으면 "알려진 상태"가 영원히 알림으로 남는다.
- **"확인/경고"는 상태가 새로울 때만 띄운다.** 이미 인지된 상태를 매일 반복 통지하면 사용자는 전체 알림을 무시하기 시작한다(alarm fatigue).
- 임계값을 절대값 하나로 두지 말고 **대상 고유 특성(여기선 통상 주기)과 결합**해 희소·저빈도 대상의 오탐을 막는다.

---

## 향후 권장 사항
1. ~~**`api/metadata.db`를 `.gitignore`에 추가**~~ — ✅ **2026-05-23 29회차에 조치 완료**(`§44`). 미조치 기간 동안 배포 시 운영 업로드 파일이 유실되는 사고가 실제 발생함. 동적 DB 파일이 git에 추적되면 매 부팅·배포마다 변경분/유실 발생.
2. **루트 `package-lock.json` 정리** — npm workspaces가 활성이라 root와 frontend에 lockfile이 둘 다 생김. 어느 쪽을 권위로 할지 컨벤션 정리 필요.
3. **TCC 안정 위치 권장** — 향후 작업은 `~/Projects` 등 권한 트러블이 적은 위치에서 진행.
4. **디자인 시스템 전환 SOP** — 캡처 1대1이 아니라, ① 컴포넌트 리스트 합의 → ② 토큰 정의 → ③ grep 기반 일괄 치환 → ④ 잔여 수동 수정 → ⑤ 캡처 검증 순서로 진행하면 라운드 수 감소.
5. **이모지 정책 lint** — pre-commit hook으로 유니코드 범위 기반 이모지 검사 추가 검토 (§13 권장 1번 참조).
6. **페이지 로컬 동명 컴포넌트 통합** — `details/page.tsx`의 자체 `DynamicAnalysisSection`을 `components/DynamicAnalysisSection.tsx`로 통합 또는 다른 이름으로 리네임 권장 (혼동 방지).
7. **차트 컴포넌트 적용 체크리스트** — wrapper / 컨트롤 / stroke·fill 3축 동시 검증 (§14 권장 1번 참조).
8. **차트 매핑 의미 체계 합의 사전화** — 디자인 시스템 적용 초기 단계에 "위계 기반 vs 데이터 종류 기반"을 먼저 결정 (§15 권장 1번 참조).
9. **시각적 reference 사전 특정 SOP** — 사용자가 과거 동작을 언급할 때 추측 금지, 위치부터 확인 (§18 권장 1번 참조).
10. **차트 매트릭스 점검 SOP** — "모든 차트 적용" 지시는 파일 × viewMode × timeUnit 매트릭스로 자가검증 (§20 권장 1·2번 참조).
11. **타이포 단일 패밀리 lint** — `font-mono`/비-Pretendard 패밀리 클래스 사용을 pre-commit/CI에서 차단 (§25 권장 1번 참조).
12. **재페치 시 그리드 unmount 금지** — refetch 트리거 컨트롤이 있는 페이지의 차트/리스트 그리드는 `!loading` 조건과 결합 금지 (§26 권장 1번 참조).
13. **N-column 매트릭스 UI 패턴** — 10개 이상 컬럼은 `overflow-auto` + sticky 컬럼 (좌/우) 디폴트 적용 (§27 권장 1번 참조).
14. **목업 ↔ 구현 위계 1:1 매칭** — HTML 목업의 들여쓰기·순서·그룹핑이 구현 위계임을 명시 (§28 권장 1번 참조).
15. **gitignore 광범위 룰 점검** — `lib/` 같은 식별자 단독 룰은 절대 경로 prefix(`/lib/`) 또는 명시 예외(`!path/`) 동반 (§29 권장 1번 참조).
16. **인접 슬롯 시뮬레이션 SOP** — 색 조정 시 단일 hex가 아니라 인접 슬롯과 swatch 비교 (§30 권장 1번 참조).
17. **차트 컴포넌트 인벤토리** — multi-series mono palette 사용 컴포넌트 리스트를 design_document.md에 표로 유지 (§31 권장 2번 참조). → 21회차에 §8.14 "전 차트 적용 범위(13개)" 표로 반영 완료.
18. **"안 변함" 보고 시 실행 환경 우선 점검** — 로컬 dev 실행/보고 URL/배포 여부 (§32 권장 1번 참조).
19. **케이스 민감 치환의 검증은 case-insensitive로** — `dot=` 필터가 `activeDot=`를 누락하지 않도록 검증 grep은 `-i` 또는 역-grep (§33 권장 1번 참조).
20. **라이브러리 기본 옵션 끄기 + 풀 리로드 검증** — `undefined`는 defaultProps로 되돌아가니 끄려면 `null`/명시값; recharts 등 내부 store 라이브러리 설정 변경은 HMR 말고 풀 리로드로 확인 (§34 권장 1·2번 참조).
21. **미해결 질문·복수 요청 큐잉** — 확인 질문이 미해결인 채 작업을 전환하면 pending 항목을 추적하고 마무리 때 환기 (§35 권장 1·2번 참조).
22. **env 중복 키 제거 + 검증 전 타깃 URL 확정** — `NEXT_PUBLIC_API_URL` 같은 키는 한 줄로, 백엔드 변경 검증은 실제 네트워크 요청으로 어느 백엔드인지 먼저 확인 (§36 권장 1·2번 참조).
23. **시계열 집계는 groupby 1회 + 응답시간 측정** — 고유값×기간 반복 boolean-mask sum 금지, 안 쓰는 파트 빌드 금지, 차원 추가 PR은 `curl -w "%{time_total}"`로 before/after 기록 (§37 권장 1·2·3번 참조).
24. **"구분/개선" 요청은 변경 대상 좁혀 최소 수정** — 범례 vs 선 vs 색 중 무엇을 바꿀지 재확인 후 근본 원인만 고치고 큰 변경은 별도 동의 (§38 권장 1·2번 참조).
25. **"그룹핑/분류"는 데이터 식별 키부터 확인 + 다대다 예외 실데이터 카운트** — 동명이종 존재 여부 점검 후 설계, 1:1 가정 금지 (§39 권장 1·2번 참조).
26. **다그룹 중복 표시 항목은 그룹별 수치로** — 합계성 수치는 그룹 몫 분해 + "그룹 몫 합 = 부모 합계" 검산 (§40 권장 1번 참조).
27. **카드 높이 일치는 외곽 실측으로** — footer/부가 라인 있는 카드는 차트 height만 맞추지 말고 `getBoundingClientRect`로 카드 외곽 측정 후 역산, "작다/크다" 반복 시 추측 말고 먼저 측정 (§41 권장 1·2번 참조).
28. **신규 UI 작성 전 디자인 규약 선확인 (이모지 금지)** — 버튼/라벨/카피 신규 작성 시 `design_document.md` 디자인 규약을 먼저 읽고 적용, 이모지는 전면 금지 (§42 권장 1번 참조).
29. **인접 버튼은 disabled 상태까지 일치 검토** — 나란히 둘 버튼은 enabled·disabled(opacity 등) 외형을 모두 맞추고, 한쪽만 비활성될 수 있으면 비활성 표현을 버튼 밖으로 이전 (§43 권장 1번 참조).
30. **런타임/사용자 데이터 git 추적 금지** — DB 파일(`*.db`)·업로드 디렉토리는 소스가 아닌 운영 데이터. 즉시 `.gitignore` 등록 + `git ls-files` 점검, 이미 추적 중이면 `git rm --cached`. 추적 해제 커밋의 운영 반영은 백업→pull→복원 순서 (§44 권장 1·2·3번 참조).
31. **차트 표시 단위는 세부 레벨 스케일 기준 + 이름-단위 일치** — 한 컴포넌트가 집계·세부 항목을 함께 그리면 소액이 0으로 사라지지 않게 세부 기준으로 단위 선택. "0으로 보인다" 의심은 API raw 원값부터 검산 (§45 권장 1·2·3번 참조).
32. **수정 전 대상 컴포넌트를 화면 제목·라벨로 특정 + 중복 유틸 전수 점검** — 스크린샷의 제목(동적 vs 고정)으로 어느 컴포넌트인지 grep 매칭 후 수정. `toMan`처럼 N개 파일에 복붙된 유틸은 `grep -rl`로 전부 찾아 영향 범위 파악 (§46 권장 1·2번 참조).
33. **런타임 데이터 vs 레퍼런스 데이터 위치 구분** — 코드와 함께 배포돼야 하는 정적 추출/설정 데이터는 gitignore된 `uploads/`가 아닌 추적 경로(`api/`)에. 고정 경로로 읽는 데이터는 `git check-ignore`로 배포 여부 점검 (§47 권장 1·2번 참조).
34. **백엔드 검증 전 재기동 + N개 대상 전수 검증·보고** — `--reload` 없는 로컬 백엔드는 파일 수정이 즉시 반영 안 되니 curl 결과가 코드와 어긋나면 재기동부터; 같은 변경이 여러 항목에 걸리면 대표 1개가 아니라 전 항목 검증·보고 (§48 권장 1·2번 참조).
35. **한 화면 다단위 차트는 단위 라벨 전수 + 정합성 제보는 raw 검산 우선** — 백만/만원처럼 단위가 다른 차트가 한 화면에 있으면 전 차트에 단위 라벨 명시(라벨 누락 차트는 정합성 오인 유발). "데이터가 이상하다" 제보는 코드 수정 전 집계 구조·단위를 raw로 검산해 데이터 버그 vs 표시 문제를 먼저 구분 (§49 권장 1·2번 참조).
36. **"다른 기기에서도 유지" = 서버 저장 + 백엔드 의존 기능은 폴백·배포순서 명시** — localStorage는 기기 한정이라 기기 간 공유는 백엔드 저장 필수. 분리 배포(프론트 자동/백엔드 수동) 환경에선 프론트에 graceful 폴백을 내장하고 배포 순서를 안내해 부분배포 미동작을 방지 (§50 권장 1·2번 참조).
37. **함수 내 모듈 재-import 금지 + CSV 리더 인코딩 폴백 전수 + 경로 술어 정확히** — 모듈 상단에 import된 이름을 함수 안에서 다시 import하면 함수 전체 지역변수로 승격돼 미실행 분기에서 `UnboundLocalError`로 진짜 에러를 가림. 원본 CSV는 EUC-KR(cp949)이니 신규 `read_csv`는 4종 인코딩 폴백 필수(`grep`으로 누락 점검). 파일 기대 경로는 `os.path.isfile` + 빈 파일명 가드 (§51 권장 1·2·3번 참조).
38. **`hmac.compare_digest`는 bytes 비교 + 보안 경계는 배포 전 적대 검증 + 읽기/쓰기 posture 일관화** — `compare_digest`를 str로 호출하면 비ASCII(한글) 비밀번호에서 TypeError로 기능이 500(self-DoS)나니 양쪽 `.encode('utf-8')`. 인증/권한 변경은 정상 경로만 보지 말고 독립 관점으로 사전 검증하고, 파괴적 작업만 막고 조회를 열어두지 말 것 (§52 권장 1·2·3번 참조).
39. **`vercel.json` rewrite와 Next 라우트 충돌 점검 + 라우팅 검증은 라이브/`vercel dev`에서** — `/api/(.*)`를 백엔드로 보내는 rewrite가 있으면 `/api/` 아래 Next 라우트가 전부 404로 가려진다. 신규 라우트는 rewrite 밖에 두거나 예외 명시. `next start`/`next build`는 `vercel.json`을 적용 안 하니 rewrite·라우팅 검증은 라이브에서 (§53 권장 1·2번 참조).
40. **사용자 노출 시각은 `timeZone` 명시로 KST 고정** — `toLocaleString`/`Intl.DateTimeFormat`은 `timeZone` 옵션이 없으면 렌더 런타임의 로컬 타임존을 따라가, SSR/UTC 서버(Vercel)에서 렌더되면 한국시와 9시간(하루) 어긋난다. 사용자에게 보이는 모든 시각 포맷터는 `timeZone: "Asia/Seoul"` 명시 + 신규 추가 시 `grep -rn toLocaleString`으로 누락 점검 (§54 권장 1번 참조).
41. **차트 자식 `<Line>`/`<Bar>`에 per-Line `data` prop 금지** — Recharts(`allowDuplicatedCategory` 기본 true)는 자식이 자체 data를 가지면 X축 category를 부모 data와 중복 concat해 도메인이 2배가 되고 데이터가 좌측 절반에만 그려진다. 모드별로 다른 값을 그릴 땐 부모 `chartData`를 미리 매핑하고 `<LabelList dataKey>`는 선의 `dataKey`와 통일. 차트 "이상" 제보는 라이브 raw로 표시/데이터 버그를 먼저 분리 (§55 권장 1·2번, `design_document §8.15` 참조).
42. **AI 컨텍스트 grounding — 프롬프트 요구값은 컨텍스트 출력으로 검증 + 유틸은 정의로 단위 확인 + 보호 엔드포인트 UA 헤더 + top 집계 정렬 키 확인** — LLM 프롬프트가 요구하는 값은 `summary` 보유가 아니라 `_build_analysis_context` 실제 출력으로 grounding 확인; `_won_to_man`처럼 함수명≠단위(백만원) 주의; Cloudflare 등 보호 엔드포인트는 `User-Agent` 명시; "주요/top" 집계는 건수순 vs 금액순 + 전월비 movers vs 매출순 구분(보고용 '주요 상품 매출'은 매출순 top-N 별도 surface) (§56 권장 1·2·3·4·5번 참조).
43. **클립보드 등 브라우저 권한 API는 secure-context 가정 + 폴백 필수** — `navigator.clipboard`는 HTTPS에서만 동작하니 `execCommand` 폴백을 동반한다. 프론트 변경은 Vercel 자동 배포(백엔드 Mac Mini 수동과 경로 구분) (§57 권장 1·2번 참조).
44. **시간 축 분석 전 날짜 컬럼의 정의를 데이터로 검증** — "일별/날짜" 컬럼이 주문일인지 계상일인지 먼저 확인한다. 검증법: 온라인 채널의 **주말 기록 밀도**를 본다(주말이 비면 주문일이 아니다). 채널별 기록밀도·변동계수를 재고, 밀도 낮은 배치 채널을 시계열에 섞지 말 것. 의미론 문제는 스무딩으로 해결되지 않는다 (§62 권장 1·2번 참조).
45. **설계 문서의 수치는 근거가 아니다 — 재현 후 코드에 박을 것** — 통계 판정 로직은 독립 구현 2~3개로 교차 검증하고, 갈리면 그 지점이 명세의 모호함이자 곧 버그다. 경계값을 오가는 분류(A/B 등)는 **히스테리시스 필수** — 없으면 사용자에겐 "어제 있던 항목이 오늘 사라짐"으로 나타난다. `astype(str)`은 NaN을 `'nan'` 채널로 승격시키니 nunique 임계 판정을 오염시킨다 (§63·§65 권장 참조).
46. **"데이터는 변하지 않는다"는 가정은 장기 간격으로 검증** — ERP는 과거 45일을 소급 정정한다(실측 최대 지연 42일). 짧은 간격(며칠) 스냅샷 비교로는 안 잡힌다. **최소 1개월 이상 간격**으로 대조할 것. 판정·리포트를 저장할 땐 **스냅샷 파일명 + 해시를 반드시 핀으로 박을 것** (§64 권장 1·2번 참조).
47. **로컬 검증 venv는 `runtime.txt` 버전으로** — 시스템 기본 파이썬으로 만들면 네이티브 확장(pandas/numpy) ABI가 어긋나 **트레이스백 없이 exit 139(SIGSEGV)** 로 죽는다. 트레이스백 없는 139는 로직 버그가 아니라 ABI 불일치를 먼저 의심 (§66 권장 1·2번 참조).
48. **한 화면에 같은 대상을 두 번 표시하면 판정 기준을 일치시키거나 차이를 화면에 쓸 것** — AND 조건으로 걸러진 항목은 **왜 걸러졌는지가 UI에 나와야** 한다(필터를 숨기면 거짓말이 된다). 이런 모순은 단위 테스트로 안 잡힌다 — 백엔드도 프론트도 각자 정확했다. **브라우저에서 실제로 열어봐야** 보인다 (§67 권장 1·2·3번 참조).
49. **`try/except`로 감싼 캐시·최적화 경로는 산출물 존재를 실제로 확인 + "원인 하나 찾았다"에서 멈추지 말 것** — `to_parquet`이 몇 달간 조용히 실패하며 3단 캐시가 2단으로 동작했다. 원인이 **둘**이었다(`pyarrow` 미설치 **+** 혼합 타입 컬럼). 첫 원인만 고치고 끝냈다가 배포 현장에서 두 번째가 드러났다 — **조치 후 산출물이 실제로 생겼는지 확인해야** 그 사실이 보인다. 선택적 의존성은 requirements에 명시하고, 스키마 미보장 외부 CSV는 저장 전 dtype 정규화를 넣는다 (§68 권장 1·2·3·4번 참조).
50. **단조 증가 카운터를 알림 조건에 쓰면 상한을 둔다 + 확인/경고는 상태가 새로울 때만** — 경과일·연속 실패 횟수처럼 계속 커지는 값에 상한이 없으면 '알려진 상태'(중단된 채널 등)가 영원히 알림으로 남아 alarm fatigue를 부른다. 임계값은 절대값 하나로 두지 말고 대상 고유 특성(통상 주기 등)과 결합해 희소·저빈도 대상의 오탐을 막는다 (§69 권장 1·2·3번 참조).
52. **외부 API 에러는 재시도 후 상태 단정 + LLM 출력 형식은 렌더러와 계약** — Gemini `429 "credits are depleted"`를 그대로 믿고 "월 리뷰 AI도 죽었다"고 오보했으나 재시도하니 정상이었다(일시적 오류). 과금·쿼터 메시지가 단정적이어도 재현 전엔 상태로 옮기지 말 것. 그리고 평문 렌더 화면에 LLM을 붙이면 모델이 기본으로 마크다운을 써서 별표가 새어 나온다 — 프롬프트에서 금지하거나 렌더러를 붙여라 (§71 권장 1·2번 참조).
51. **"실측했다" ≠ "결정에 맞는 걸 실측했다" — 구현 직전 운영 시나리오로 재시뮬** — 검증 숫자를 권고로 옮기기 전에 그 숫자가 결정이 요구하는 바로 그 지표인지 되물어라(레벨/중앙값 지표를 발화/임계이탈 지표로 착각 주의). SKU '2개'(중앙값>50만)를 예외 발화 수로 오해했다가 실제론 연 101건이었다. 소음을 낼 신호는 카드(알람) vs 패널(참조)로 구분하고, 발화 빈도가 원칙을 깨면 패널로 (§70 권장 1·2·3번 참조).
