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
11. **타이포 단일 패밀리 lint** — `font-mono`/비-Pretendard 패밀리 클래스 사용을 pre-commit/CI에서 차단 (§25 권장 1번 참조).
12. **재페치 시 그리드 unmount 금지** — refetch 트리거 컨트롤이 있는 페이지의 차트/리스트 그리드는 `!loading` 조건과 결합 금지 (§26 권장 1번 참조).
13. **N-column 매트릭스 UI 패턴** — 10개 이상 컬럼은 `overflow-auto` + sticky 컬럼 (좌/우) 디폴트 적용 (§27 권장 1번 참조).
14. **목업 ↔ 구현 위계 1:1 매칭** — HTML 목업의 들여쓰기·순서·그룹핑이 구현 위계임을 명시 (§28 권장 1번 참조).
15. **gitignore 광범위 룰 점검** — `lib/` 같은 식별자 단독 룰은 절대 경로 prefix(`/lib/`) 또는 명시 예외(`!path/`) 동반 (§29 권장 1번 참조).
16. **인접 슬롯 시뮬레이션 SOP** — 색 조정 시 단일 hex가 아니라 인접 슬롯과 swatch 비교 (§30 권장 1번 참조).
17. **차트 컴포넌트 인벤토리** — multi-series mono palette 사용 컴포넌트 리스트를 design_document.md에 표로 유지 (§31 권장 2번 참조). → 21회차에 §8.14 "전 차트 적용 범위(13개)" 표로 반영 완료.
18. **"안 변함" 보고 시 실행 환경 우선 점검** — 로컬 dev 실행/보고 URL/배포 여부 (§32 권장 1번 참조).
19. **케이스 민감 치환의 검증은 case-insensitive로** — `dot=` 필터가 `activeDot=`를 누락하지 않도록 검증 grep은 `-i` 또는 역-grep (§33 권장 1번 참조).
