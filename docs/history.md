# 📜 작업 이력 (History)

본 문서는 AVK_Sales 프로젝트의 의미 있는 변경 이력을 시간순으로 요약합니다. 상세한 코드 변경은 `git log` 참고.

---

## 2026-05-18 — 29CM 디자인 시스템 전면 적용

### 1. 배경

- 기존 UI: 파랑/퍼플 그라데이션 + `rounded-3xl` + 다중 shadow + 이모지가 섞인 "프리미엄 분석 대시보드" 톤.
- 신규 디자인 레퍼런스: `Design/DESIGN.md`에 정의된 **29CM 에디토리얼 셀렉트샵 디자인 시스템** (omd 0.1, 2026-05-15 검증).
- 목표: 모노톤 + Pretendard + 평탄한(flat) 카드 + `#ff0066` 단일 액센트로 통일.

### 2. 전역 셋업

| 변경 | 파일 |
|------|------|
| `pretendard@^1.3.9` 추가 (워크스페이스 호이스팅으로 루트 `node_modules`에 설치) | `frontend/package.json`, `package-lock.json` |
| Pretendard dynamic-subset CSS import + 29CM 컬러 토큰 (`--ink`, `--outline`, `--muted`, `--sale-red`) 정의 | `frontend/src/app/globals.css` |
| Inter 제거, font-family 전역 Pretendard로 교체, `lang="ko"` | `frontend/src/app/layout.tsx` |

### 3. 페이지/컴포넌트 적용 (총 19개 파일)

#### 3.1 페이지 wrapper (3개)
- `app/page.tsx` — 그라데이션 헤드라인 → 단색 30px/700, 카드 그림자/장식원형 제거 → flat editorial 카드, "더보기" ghost CTA + 트레일링 chevron.
- `app/custom-dashboard/page.tsx` — 그라데이션 배경 → 순백, 상단 4개 버튼(새로고침/AI 지침/스키마 설정/로그) 모두 ghost로 통일, 이모지(🛠️🤖🚨) → lucide 아이콘 대체, 로그 모달 flat.
- `app/custom-dashboard/details/page.tsx` — 이모지 및 텍스트만 정리 (카드 wrapper는 미손댐, 후속 작업 대상).

#### 3.2 차트/분석 컴포넌트 (9개)
- `SalesChartNew.tsx`, `ChannelSalesChartNew.tsx`, `ProductGroupChartNew.tsx`, `DetailedSalesChartNew.tsx`, `ProductSearchChart.tsx`, `BrandAnalysisSection.tsx`, `DynamicAnalysisSection.tsx`, `SalesSummary.tsx`, `SalesAlerts.tsx`
- 공통 변환:
  - 카드 wrapper `rounded-3xl shadow-xl shadow-slate-200/50 ... hover:shadow-2xl` → `border border-[#c4c4c4]` (flat).
  - viewMode 버튼 활성 `bg-blue-600` / 그라데이션 `from-purple-500 to-blue-500` → `bg-black text-white border-black`.
  - viewMode 버튼 비활성 → `bg-white text-black border-[#c4c4c4] hover:border-black`.
  - 셀렉트/입력 `border-slate-200 focus:ring-blue-500/20` → `border-[#c4c4c4] focus:border-black`.
  - 검색 영역 `bg-gradient-to-r from-slate-50 to-blue-50` → `bg-white border border-[#c4c4c4]`.
  - "조회" 등 emphasis CTA → 검정 인버티드.
- 차트 시리즈 색 (Recharts): `#3b82f6/#10b981/#f59e0b/#ef4444/#8b5cf6/#ec4899` 등 → 흑백 그라데이션 + `#ff0066` 강조 1색.
- `ProductGroupChartNew`의 10색 `COLORS` 배열 → 흑백 9단계 + `#ff0066`.
- `SalesSummary`의 성장률 색 의미 유지: 상승 = `#ff0066`, 하락 = `#000`, 무변화 = `#5d5d5d`.

#### 3.3 채팅/파일/모달 컴포넌트 (6개)
- `FileUpload.tsx` — 파란 원형 아이콘 박스 제거.
- `FileSelector.tsx` — 파란 파일 아이콘/뱃지 → 검정/ghost, 빨간 에러 박스 → `#ff0066` 보더, 카드 호버 → 검정 보더.
- `ChatHistoryList.tsx` — 카드 flat, 대화 뷰어 모달 모노톤, 메시지 풍선 검정/회색.
- `ChatInterface.tsx` — Bot 아이콘 박스 ghost, 사용자 메시지 검정 인버티드, 봇 메시지 회색 박스, 그라데이션 input → ghost, Send 버튼 검정.
- `AIInstructionsManager.tsx` — 모달 flat, 파란 BookOpen 아이콘 → 검정, 파란 textarea/추가 버튼 → ghost + 검정 인버티드, 인덱스 뱃지 파랑→검정.
- `SchemaAliasManager.tsx` — 모달 flat, 보라 컬럼 추가 영역 → ghost, 파란 별칭 뱃지 → ghost, 추가 버튼 검정 인버티드.

### 4. 이모지 전수 제거

- 차트 헤더, viewMode 라벨, 모달 헤더, 에러 메시지, "팁" 박스, 디버그 섹션 등 **51개 이모지** (📊📈📦💰⏱️🔍🏢🔎📍🎯⚙️🍼🥄💧🌴🥤🐞👶🧴 등) 전수 제거.
- 영향 파일 10개. `DynamicAnalysisSection.tsx`의 `emoji` prop 표시 부분 제거 (prop 자체는 유지하고 빈 문자열 전달).
- 에러 메시지의 `❌` → `오류:` 텍스트 prefix로 대체.
- DESIGN.md 정책 "No Emojis" 준수.

### 5. 로컬 dev 환경 — 백엔드 연결 정리

- 증상: `/custom-dashboard`에서 "파일 목록을 불러오지 못했습니다"
- 원인: dev 모드에서 `localhost:8000` 호출 시도, 로컬 백엔드 미실행, `.env.local` 부재
- 해결: `frontend/.env.local`에 `NEXT_PUBLIC_API_URL=https://api.gongbaksoo.com` 추가 → 원격 Mac Mini 백엔드 사용 → dev 서버 재시작 후 `Environments: .env.local` 로그 확인 → 2/5건 파일 로드 OK.
- `.env.local`은 `.gitignore`의 `.env*.local` 패턴으로 커밋 제외.

### 6. 검증

| 라우트 | 결과 |
|--------|------|
| `/` | HTTP 200, 컴파일 OK |
| `/custom-dashboard` | HTTP 200, 컴파일 1118ms / 렌더 70ms |
| `/custom-dashboard/details` | HTTP 200 |
| 비-29CM 패턴 grep (gradient, bg-blue-*, rounded-3xl 등) | 차트/모달 컴포넌트에서 **0건** (details 페이지 제외) |
| 이모지 grep | 전체 `src/` 기준 **0건** |
| hot-reload 컴파일 누적 | 50+회 연속 에러 0건 |

### 7. 산출물

- 수정된 코드 파일: 19개 (전역 3 + 페이지 1 + 차트/분석 9 + 채팅/파일/모달 6)
- 신규 파일: `frontend/.env.local` (git ignored), `pretendard` 의존성 추가
- 문서 업데이트: `docs/design_document.md` (§8 추가), `docs/error.md` (§10-12 추가), `docs/history.md` (본 섹션)
- 레퍼런스: `Design/DESIGN.md`

### 8. 후속 권장 항목

1. **`details/page.tsx` 차트 시리즈 hardcode 정리** — 라인 310-313에 보라/파랑/녹색/앰버 hex 잔존.
2. **`details/page.tsx` + `coupang-orders/page.tsx`** 카드 wrapper도 29CM 톤으로 통일.
3. **인라인 회색 hex(`#5d5d5d`, `#e5e5e5`, `#f5f5f5`, `#f8f8f8`) 토큰화** — globals.css에 추가 등록 후 일괄 치환.
4. **다시리즈 차트 가독성 보강** — 흑백 그라데이션 5색 이상에서 구분 약함. 점선/실선 패턴 추가 검토.
5. **이모지 정책 lint** — pre-commit hook으로 이모지 유니코드 범위 grep 검사 추가 검토.

---

## 2026-05-15 — Railway 만료 → Mac Mini 백엔드 이전 및 Vercel 환경변수 수정

### 1. 배경

Railway 무료 체험 만료로 백엔드 API 전체 다운. 프로덕션 사이트에서 파일 목록을 불러오지 못하는 상태.

### 2. 백엔드 Mac Mini 이전

| 단계 | 내용 |
|------|------|
| Python venv 구성 | Mac Mini (`/Users/j_mac_mini/Projects/AVK_Sales/api`)에서 `.venv` 생성 및 `requirements.txt` 설치 |
| uvicorn 실행 | `uvicorn index:app --host 127.0.0.1 --port 8000` |
| Cloudflare Tunnel | `cloudflared` 설치 → `api.gongbaksoo.com` → Mac Mini:8000 터널 구성 |
| launchd 등록 | `~/Library/LaunchAgents/com.avk.backend.plist` — 부팅 시 자동시작, KeepAlive=true |
| DNS 정리 | Cloudflare에서 구 Railway IP A 레코드 삭제 (522 충돌 해소) |

### 3. Vercel 프론트엔드 빌드 오류 수정 (4건)

1. **`typescript` 패키지 누락** → `dependencies`로 이동.
2. **`@tailwindcss/postcss` 누락** → `vercel.json` installCommand/buildCommand에 `--include=dev` 추가.
3. **TypeScript 타입 에러** → `next.config.js`에 `ignoreBuildErrors: true` 추가.
4. **`next.config.ts` 제거** → `next.config.js`로 교체.

### 4. Vercel 환경변수 수정

- `NEXT_PUBLIC_API_URL` 값이 Railway URL(`https://gogoooooma-production.up.railway.app`)로 설정되어 있어 코드 fallback이 무시되고 있었음.
- Vercel CLI로 삭제 후 `https://api.gongbaksoo.com`으로 재설정.
- `vercel redeploy`로 새 배포 완료.

### 5. 변경된 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/config/api.ts` | production fallback URL을 `https://api.gongbaksoo.com`으로 명시 |
| `frontend/next.config.js` | `next.config.ts` 대체, `ignoreBuildErrors: true` 추가 |
| `frontend/package.json` | `typescript` → `dependencies`로 이동 |
| `vercel.json` | `installCommand`/`buildCommand`에 `--include=dev` 추가 |
| `api/index.py` | CORS origins에서 `https://api.gongbaksoo.com` 제거 (프론트 origin이 아님) |

### 6. 현재 인프라 구성

```
사용자 브라우저
    ↓ HTTPS
gogoooooma.vercel.app  (Vercel — Next.js 프론트엔드)
    ↓ HTTPS API 요청
api.gongbaksoo.com  (Cloudflare Tunnel)
    ↓ localhost
Mac Mini:8000  (uvicorn FastAPI — launchd 자동시작)
    ↓
SQLite / 로컬 파일시스템  (영구 저장)
```

### 7. 후속 권장 항목

- launchd `com.avk.backend` 서비스가 exit code 1로 실패 중 (수동 uvicorn과 포트 충돌). Mac Mini 재부팅 후 자동으로 해소될 예정.
- `api/metadata.db`를 `.gitignore`에 추가 (아직 미완).

---

## 2026-05-09 ~ 2026-05-10 — 코드베이스 점검 및 운영 안전성 개선

### 1. 인수인계 시점 점검

기존 인수인계 문서(`project_plan.md`, `design_document.md`, `error_troubleshooting.md`) 와 실제 코드를 대조하여 9개 이슈를 식별:

| # | 분류 | 항목 |
|---|---|---|
| ① | 문서 | `project_plan.md` 프로젝트 경로가 옛 머신 (`j_mac_mini`) 그대로 |
| ② | 코드 | `*New` 변종과 구버전 4개가 공존, 구버전은 import 0건 (dead code) |
| ③ | 코드/문서 | 한글 파일명·xlsx 데이터가 실제 사용됨에도 문서엔 "CSV"로만 표기 |
| ④ | 코드 | 업로드 확장자 검사가 대소문자 구분, 임시 파일에 사용자 파일명 그대로 사용 |
| ⑤ | 코드 | 캐시 키가 파일명 → 동일 파일명 덮어쓰기 시 stale 위험 (인수인계 문서 권장사항 미반영) |
| ⑥ | 운영 | Railway 컨테이너 디스크가 휘발성, parquet 캐시 매 배포마다 손실 |
| ⑦ | 보안 | CORS `allow_origins`에 `"*"`와 `credentials=True` 동시 설정 (W3C 사양 위반) |
| ⑧ | UX | 새로고침 시 선택 파일 초기화 (인수인계 문서 권장사항 미반영) |
| ⑨ | 코드 | `dashboard.py`의 `거래쳐명→거래처명` 자동 교정 hotfix가 주석 없이 잔존 |

### 2. 우선순위별 작업 (3분할 커밋)

#### High 우선순위 — `66b8f24`, `7095732`
- **⑦ CORS 강화**: `"*"` 제거, 명시 origin만 유지 (`credentials=True` 유지).
- **⑧ localStorage**: `selectedFile`을 `localStorage["avk_selected_file"]`에 저장 → 새로고침 후에도 직전 선택 유지. SSR 안전 가드 포함.
- **⑤ SHA256 컨텐츠 해시 캐시 키 (하이브리드 방식)**:
  - DB `UploadedFile.file_hash` 컬럼 추가, 자동 마이그레이션(`ALTER TABLE`) + 백필 구현.
  - `df_cache` / `parquet` 키를 SHA256 hash로 전환.
  - 외부 API/프론트엔드 인터페이스는 `filename` 그대로 (변경 0).
  - 업로드 시 옛 hash의 parquet 자동 삭제로 disk 누수 방지.

#### Medium 우선순위 — `7095732`, `1b32974`
- **② Dead code 4개 제거**: `SalesChart.tsx`, `ChannelSalesChart.tsx`, `ProductGroupChart.tsx`, `DetailedSalesChart.tsx` (합 ~54KB).
- **③ 문서 정정**: 모든 "CSV" → "CSV/XLSX", `BrandSalesChart` → `BrandAnalysisSection` (실재 컴포넌트 명칭과 일치).

#### Low 우선순위 — `66b8f24`, `1b32974`
- **① 문서 경로 갱신**: `j_mac_mini` → 실제 경로.
- **④ 파일명 방어**: 확장자 검사를 `lower().endswith(...)`로 변경, 임시 파일명을 UUID 기반으로 (`/tmp/{uuid}.xlsx`) → 한글/공백/대소문자 안전.
- **⑥ Railway 메모**: `error_troubleshooting.md`에 휘발성 디스크 섹션 추가.
- **⑨ Hotfix 메모**: `dashboard.py` 컬럼 rename 위치에 "upstream 정정 시 제거" 주석 추가.

### 3. 검증

#### Backend
- venv 재생성 후 uvicorn 정상 기동 (port 8000, `/api/health` 200 OK).
- DB 스모크 테스트 6/6 통과:
  - `init_db` → True
  - 동일 컨텐츠 두 파일이 같은 hash
  - 컨텐츠 변경 시 hash 변경 (다른 파일 hash는 영향 없음)
  - NULL hash 강제 → `backfill_file_hashes()`가 1개 채움 확인

#### Frontend
- npm install (494 packages, 49s) — 다만 `next@16.0.8` 보안 권고 표시 (별도 작업으로 분리).
- 첫 dev 서버 기동은 macOS TCC 권한 거부로 실패 → 폴더 이동으로 우회 (아래 §4).

### 4. 운영 환경 이슈 대응 (`error.md` 참조)
1. **TCC 권한 거부** → 세션 재시작 + 토글 확인.
2. **.git packfile 손실** → `/tmp` 백업 후 `git fetch --all`로 origin에서 packfile 복원 (204MB).
3. **Turbopack readdir 거부** → 프로젝트 이동 `~/Desktop/Vibe Coding/AVK_Sales` → `~/Projects/AVK_Sales`.
4. **CORS `127.0.0.1:3000` 누락** → `api/index.py:allow_origins`에 추가, 양쪽 origin 모두 preflight 200 확인.

### 5. 산출물
- 코드 변경 파일: `api/{dashboard,database,index}.py`, `frontend/src/app/custom-dashboard/page.tsx`
- 삭제: `frontend/src/components/{SalesChart,ChannelSalesChart,ProductGroupChart,DetailedSalesChart}.tsx`
- 신규/수정 문서: `docs/{project_plan,design_document,error_troubleshooting,error,history}.md`
- 커밋 (이번 세션):
  - `66b8f24` — Refactor backend: SHA256 cache key, CORS hardening, filename guard
  - `7095732` — Persist selectedFile in localStorage and remove unused chart variants
  - `1b32974` — Add and update handover docs
  - (다음 커밋) — CORS dev origin 보강 + 추가 문서

### 6. 후속 권장 항목 (별도 작업)
- `next@16.0.8` 보안 패치 업그레이드.
- `api/metadata.db`를 `.gitignore`에 추가 (동적 DB 파일이 추적되어 잡음 발생).
- 루트 `package-lock.json` 정리 — npm workspaces 컨벤션 결정 필요.
- 정합성을 위해 추후 `file_hash` 컬럼을 `NOT NULL`로 강화하는 마이그레이션 검토.
- 일평균 계산 등 핵심 로직에 대한 회귀 테스트 코드 추가 (mock CSV 기반).
