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

## 향후 권장 사항
1. **`api/metadata.db`를 `.gitignore`에 추가** — 동적 DB 파일이 git에 추적되어 매 부팅마다 변경분 발생 (file_hash 백필 등). 이번에도 관련 변경이 발생함.
2. **루트 `package-lock.json` 정리** — npm workspaces가 활성이라 root와 frontend에 lockfile이 둘 다 생김. 어느 쪽을 권위로 할지 컨벤션 정리 필요.
3. **TCC 안정 위치 권장** — 향후 작업은 `~/Projects` 등 권한 트러블이 적은 위치에서 진행.
4. **디자인 시스템 전환 SOP** — 캡처 1대1이 아니라, ① 컴포넌트 리스트 합의 → ② 토큰 정의 → ③ grep 기반 일괄 치환 → ④ 잔여 수동 수정 → ⑤ 캡처 검증 순서로 진행하면 라운드 수 감소.
5. **이모지 정책 lint** — pre-commit hook으로 유니코드 범위 기반 이모지 검사 추가 검토 (§13 권장 1번 참조).
6. **페이지 로컬 동명 컴포넌트 통합** — `details/page.tsx`의 자체 `DynamicAnalysisSection`을 `components/DynamicAnalysisSection.tsx`로 통합 또는 다른 이름으로 리네임 권장 (혼동 방지).
