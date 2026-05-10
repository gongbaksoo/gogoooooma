# 📜 작업 이력 (History)

본 문서는 AVK_Sales 프로젝트의 의미 있는 변경 이력을 시간순으로 요약합니다. 상세한 코드 변경은 `git log` 참고.

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
