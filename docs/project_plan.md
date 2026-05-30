# 📋 Sales Analysis Site - 프로젝트 플랜 문서

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | Vibe Sales - Premium Analytics Dashboard |
| **목적** | 매출 CSV/XLSX 파일을 업로드하여 다양한 차트와 테이블로 매출 분석 |
| **프로젝트 경로** | `/Users/gongbaksoo/Desktop/Vibe Coding/AVK_Sales/` |
| **GitHub** | `https://github.com/gongbaksoo/gogoooooma.git` |
| **배포** | Vercel (프론트엔드) + Mac Mini + Cloudflare Tunnel (백엔드 API) |
| **프론트 URL** | `https://gogoooooma.vercel.app` |
| **백엔드 URL** | `https://api.gongbaksoo.com` |

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| **프론트엔드** | Next.js, React, TypeScript, Tailwind CSS |
| **백엔드** | Python, FastAPI, Pandas, NumPy |
| **차트 라이브러리** | Recharts (프론트엔드) |
| **배포** | Vercel (프론트), Mac Mini + Cloudflare Tunnel (백엔드) |
| **데이터 캐싱** | Parquet 파일 캐시 + 인메모리 캐시 (`df_cache`) |

---

## 3. 디렉토리 구조

```
sales-analysis-site/
├── api/                          # 백엔드 (Python/FastAPI)
│   ├── index.py                  # API 라우터 (엔드포인트 정의)
│   ├── dashboard.py              # 핵심 비즈니스 로직 (매출 계산)
│   ├── monthly_review.py         # 월 리뷰 집계 로직 ⭐ NEW
│   ├── metadata.db               # SQLite — 업로드 파일 BLOB 저장 ⚠️ git 추적 금지(운영 런타임 데이터)
│   ├── uploads/                  # 업로드 파일 디스크 fallback ⚠️ git 추적 금지(.gitkeep만 추적)
│   │   ├── cache/                # Parquet 캐시 파일
│   │   └── targets/              # 월 리뷰용 목표 파일 ⭐ NEW
│   └── verify_daily_api.py       # API 검증 스크립트
├── frontend/                     # 프론트엔드 (Next.js)
│   ├── src/
│   │   ├── app/                  # 페이지 라우팅
│   │   │   ├── page.tsx          # 메인 페이지 (포털 카드 — 매출 분석 / 월 리뷰)
│   │   │   ├── custom-dashboard/ # 대시보드 페이지
│   │   │   ├── monthly-review/   # 월 리뷰 페이지 ⭐ NEW
│   │   │   └── coupang-orders/   # 쿠팡 주문 페이지
│   │   └── components/           # React 컴포넌트들
│   │       ├── SalesSummary.tsx           # 월간 매출 현황 보고서 테이블
│   │       ├── ProductSearchChart.tsx     # 상품 검색 차트
│   │       ├── ChannelSalesChartNew.tsx   # 채널별 매출 차트 (현행)
│   │       ├── BrandAnalysisSection.tsx   # 브랜드 분석 섹션
│   │       ├── SalesChartNew.tsx          # 채널별 매출 차트 (메인)
│   │       ├── ProductGroupChartNew.tsx   # 품목그룹별 매출 차트
│   │       ├── DetailedSalesChartNew.tsx  # 3단계 필터 매출 차트
│   │       ├── monthly-review/            # 월 리뷰 전용 차트 묶음 ⭐ NEW
│   │       │   ├── Chart1Achievement.tsx  # 목표비 실적 막대
│   │       │   ├── Chart2YoYTrend.tsx     # 전년비 트렌드 라인
│   │       │   └── Chart3MainVsCoupang.tsx# 주력 vs 쿠팡사입 라인
│   │       └── ...
│   └── package.json
└── README.md
```

---

## 4. 주요 기능 목록

### 4.1 파일 업로드 및 관리
- CSV/XLSX 파일 업로드 (`/api/upload`)
- 업로드된 파일 목록 조회
- 파일 선택 시 대시보드 자동 로드
- **저장 구조**: 업로드 파일은 SQLite `api/metadata.db`의 `uploaded_files` 테이블에 **BLOB으로 저장**(DB 불가 시 `api/uploads/` 디스크 fallback). 목록은 `list_files_in_db()`(최신순), 최대 5건 유지(`cleanup_old_files_in_db`).
- ⚠️ **운영 데이터 git 추적 금지 (2026-05-23 29회차)**: `metadata.db`·`api/uploads/` 데이터 파일은 **소스가 아니라 운영 런타임 데이터**다. git에 추적되면 배포(`git pull`) 때 저장소의 빈/구버전 DB로 **덮어써져 업로드가 전부 유실**된다(실제 발생, `docs/error.md §44`). `.gitignore`에 등록되어 있어야 하며, `.gitkeep`만 추적한다.
- ⚠️ **소스 CSV 인코딩 규약 — EUC-KR(cp949) (2026-05-30 36회차)**: 업로드되는 매출 원본 CSV는 **EUC-KR(cp949)** 인코딩이다(UTF-8 아님, 첫 바이트 `0xC0`). 모든 운영 CSV 리더는 인코딩 폴백을 갖춰야 한다 — `index.py`(업로드)·`dashboard.py`·`monthly_review.py`는 `['utf-8','utf-8-sig','cp949','euc-kr']` 순차 시도, `chat.py`(AI 채팅)는 `UnicodeDecodeError` 시 cp949 폴백. 폴백 누락 시 `'utf-8' codec can't decode byte 0xc0` 에러로 기능 전체가 죽는다. 신규 `read_csv` 추가 시 동일 폴백 적용 + `grep -rn read_csv`로 누락 점검. 상세: `docs/error.md §51`.

### 4.2 월간 매출 현황 보고서 (SalesSummary)
- **API**: `/api/dashboard/summary`
- **함수**: `get_monthly_summary()` in `dashboard.py`
- **표시 데이터**:
  - 당월 누적 매출 / 당일 매출 / 당월 일평균
  - 전월 누적 / 일평균
  - 전월 대비 성장률
  - **최근 3개월 월평균 매출 / 일평균** (당월 제외)
  - **전년 동월 누적 / 일평균**
- **카테고리**: 전체, 이커머스, 오프라인, 마이비, 누비, 쏭레브

### 4.3 채널별 매출 차트 (ChannelSalesChart)
- **API**: `/api/dashboard/channel-sales`
- **함수**: `get_channel_sales_chart_data()` in `dashboard.py`
- 이커머스 vs 오프라인 월별 매출 추이
- 이익률 듀얼 축 표시
- 일평균 매출 표시

### 4.4 브랜드별 매출 차트 (BrandAnalysisSection)
- **API**: `/api/dashboard/monthly-sales-by-channel`, `/api/dashboard/monthly-sales-by-product-group`
- 마이비, 누비, 쏭레브 등 품목그룹별 매출
- 이익률 차트

### 4.5 상품 검색 차트 (ProductSearchChart)
- **API**: `/api/dashboard/product-search-sales`
- **함수**: `get_product_search_sales()` in `dashboard.py`
- 키워드로 상품 검색
- 검색 결과 체크박스 필터링 (품목코드 기반)
- 월별 매출/이익 차트

### 4.6 알림 카드 (Sales Performance Alerts)
- **API**: `/api/dashboard/performance`
- **함수**: `analyze_sales_performance()` in `dashboard.py`
- 전월 대비, 3개월 평균 대비, 전년 동월 대비 일평균 매출 변동 분석
- 이커머스/오프라인/해외 등 세그먼트별 분석
- 거래처별 세부 분석 (쿠팡, 이마트 등)

### 4.7 월 리뷰 (Monthly Review) ⭐ NEW

- **페이지**: `/monthly-review`
- **목적**: 월간 매출 리뷰용 정형 대시보드 — PPT 보고서를 화면에서 재현하고 PDF로 출력
- **데이터 소스**:
  - 매출 데이터: 기존 업로드 CSV/XLSX 재사용 (`/api/files/`)
  - 목표 데이터: 별도 업로드 (포맷: `월,파트,목표`, 단위: 원)
- **컨트롤**:
  - 매출 파일 / 목표 파일 / 대상 월 (드롭다운, 데이터의 가용 월 자동 추출)
  - 파트 토글: 전체 / 이커머스 / 오프라인
- **Phase 1 차트 (운영 배포 완료, 2026-05-19)**:
  - **Chart 1 — 목표비 실적** (BarChart): 사업계획 vs 실적 + 달성률(%)
  - **Chart 2 — 전년비 트렌드** (LineChart): **대상월 기준 직전 12개월** vs **같은 기간 1년 전** (예: 대상월 26-02 → X축 25.03~26.02, 전년 라인은 24.03~25.02 동일 월 값)
  - **Chart 3 — 파트별 동적 비교** (LineChart, 최근 12개월): 파트 필터에 따라 자동 전환
    - `part=all` (전체) → **이커머스 vs 오프라인** (파트구분 기반, 2-series, 색 `#000`/`#5d5d5d`)
    - `part=ecommerce` → **주력채널 vs 쿠팡(사입)** (주력채널 컬럼 기반, 2-series, 색 `#000`/`#ff0066`)
    - `part=offline` → **이마트 vs 롯데마트 vs 다이소** (거래처명 R열 기준, 3-series, 색 `#000`/`#5d5d5d`/`#7d7d7d`)
    - 백엔드 응답: `{title, series_names, colors, data: [{month, values: number[]}]}` — N-series 가변 길이로 일반화 (프론트가 series_names.length만큼 Line 동적 렌더)
- **운영 동작 상태** (2026-05-19 최종 검증):
  - Mac Mini 백엔드 `launchctl kickstart -k gui/$(id -u)/com.avk.backend` 으로 코드 반영
  - `https://api.gongbaksoo.com/api/monthly-review/{months, targets, summary}` 모두 200 OK
  - chart3 신규 object 구조(`{title, series_names, colors, data}`) 응답 — `all`/`ecommerce` 양쪽 모드 검증 완료
  - Vercel 프론트 `https://gogoooooma.vercel.app/monthly-review` 200 OK + 차트 정상 렌더
  - **배포 운영 규칙**: API 응답 구조 변경 시 백엔드(Mac Mini)와 프론트(Vercel)를 **동시 배포** 필요 — 미스매치 시 client-side crash. 운영 절차는 `docs/error.md §22` 참조.
- **Phase 2 종합 차트 (2026-05-19 구현, chart 4~9)**:
  - **Chart 4 — 브랜드별 매출 트렌드** (LineChart, N-series, 12개월): D열(품목그룹1) 동적 — 개별 브랜드(판매액 desc) + 기타, 기본 상위 3개 표시 (30회차 변경, §2.3.3.22)
  - **Chart 5 — 브랜드별 매출 비중** (PieChart, 12개월 합): 카테고리 외부 라벨 `name pct%` 10px 표시, 하단 Legend 제거
  - **Chart 6 — 브랜드 월평균 vs 당월** (Grouped BarChart): 카테고리 마이비/누비/쏭레브/마+누+쏭, 시리즈 월평균(`#5d5d5d`) / 당월(`#000`)
  - ~~Chart 7/8/9 (정적)~~ → **ChannelSection** 동적 컴포넌트로 대체 (2026-05-19 14회차)
- **채널 종합 (ChannelSection, 2026-05-19 동적화)**:
  - 단일 컴포넌트가 트렌드/파이/막대 3 차트 동시 렌더 + 우측 상단 `표시 채널 수정 ▾` 모달
  - **파트별 동적 옵션 + 사용자 선택 가능** (P열 `채널구분` unique values, 파트구분으로 필터링):
    - `all`: 16개 옵션 (전체 df의 P열 unique) — 기본 4개 (오픈마켓(사입)/오픈마켓(위탁)/자사몰/할인점)
    - `ecommerce`: 10개 옵션 (이커머스 파트 P열) — 기본 5개 (오픈마켓(사입)/오픈마켓(위탁)/종합몰/버티컬커머스/자사몰, PPT 위탁 그룹의 P열 매핑)
    - `offline`: 5개 옵션 (오프라인 파트 P열) — 기본 3개 (할인점/다이소/오프라인 대리점)
  - **백엔드 응답 신규 필드**:
    - `channel_options`: `{ all: [...], ecommerce: [...], offline: [...] }` — 각 옵션 = `{name, row_count, values[12], monthly_avg, current_month}`
    - `channel_defaults`: 파트별 기본 선택 (백엔드·프론트 동기 명시)
    - `channel_months`: 12개월 라벨 배열
  - **localStorage 저장 키**: `avk_monthly_review_channel_selections` — `{ all: string[], ecommerce: string[], offline: string[] }`
  - 사용 안 하는 Chart7/8/9 컴포넌트 + chart7/8/9 응답 키 제거
- **레이아웃 (2026-05-20 19회차 재배치)**: 5개 섹션 — `종합` (chart 1~3) / `브랜드 종합` (chart 4~6) / `브랜드 상세` (BrandSection × 3) / `채널 종합` (ChannelSection) / `주요 채널 이슈` (ChannelIssueSection). 각 섹션 자체 헤더 + grid + 모달 토글.
- **주요 채널 이슈 (2026-05-20 19회차 신설)**:
  - PPT slide 3 "매출 리뷰 - 주요채널 이슈" 재현. N그룹 × 2차트 (거래처 / 브랜드) 동적 grid.
  - 기본 3 그룹: 사입몰(오픈마켓(사입)) / 위탁몰(오픈마켓(위탁)+종합몰+버티컬커머스) / 자사몰(자사몰).
  - 사용자 편집 가능: 그룹 추가/삭제/이름변경/순서변경 + P열 채널 매핑 매트릭스 (`GroupConfigModal`).
  - 각 차트별 표시 항목 사용자 선택 (거래처=R열, 브랜드=D열 `품목그룹1`).
  - 백엔드 응답 신규 필드: `channel_issue` (per-part × per-channel × vendor/brand 12개월 pivot) + `channel_issue_months`.
  - localStorage: `avk_monthly_review_channel_issue` (PartScopedGroups). 파트 토글 시 독립 저장.
  - 상세: `docs/design_document.md §2.3.3.11`
- **차트 표시 모달 평면 구조 (2026-05-20 19회차 재구성)**:
  - 5섹션 모두 평면 체크박스 (위계 통일) + 종합·브랜드 종합은 sub-chart 들여쓰기.
  - 섹션 OFF 시 sub-chart 자동 disabled.
  - `SectionId` 5개 추가: overview / brandOverview / brandDetail / channelOverview / channelIssue.
  - 상세: `docs/design_document.md §2.3.3.12`
- **표시 항목 우선순위(순서) 설정 (2026-05-20 22회차)**:
  - 차트에 표시할 항목을 체크한 뒤 **표시 순서를 사용자가 직접 지정** → 트렌드 차트 선 색상·범례 순서에 반영 (1번 = 주 색상 #000).
  - 적용 범위: 표시 상품(브랜드 상세) / 표시 채널(채널 종합) / 표시 거래처·브랜드(주요 채널 이슈) — 공통 `ProductSelectionModal`.
  - UI: 모달 상단 "표시 순서" 영역에 ▲▼ 버튼 + 드래그(≡) 정렬. 저장 구조·백엔드 변경 없음 (selection 배열이 순서 보유).
  - recharts v3 Legend 기본 정렬(`itemSorter:'value'`) → `itemSorter={null}`로 끔 (트렌드 차트 3곳).
  - 상세: `docs/design_document.md §2.3.3.13`, 에러: `docs/error.md §34`
- **편집 모드 — 보기 ↔ 편집 분리 (2026-05-20 23회차)**:
  - 평소 보기 전용 화면, 편집 버튼은 편집 모드 ON일 때만 노출 (상품 추가/표시 수정/그룹 설정/× 제거 전부).
  - `차트 표시` 버튼 → `편집 모드`로 명칭 변경. 클릭 시 모달 상단 "편집 모드 활성화" 스위치로 켤지 선택 (기존 5섹션 토글은 같은 모달 유지).
  - `editMode` state를 자식 컴포넌트에 prop 전달 → 편집 버튼 게이팅. 비영속(새로고침 시 기본 OFF).
  - 상세: `docs/design_document.md §2.3.3.14`, 에러: `docs/error.md §35`
- **주요 채널 이슈 — 상·하위 레벨 동시 표시 (2026-05-20 24회차)**:
  - 표시 거래처 수정: 채널(P열, 위) + 거래처(R열, 아래) / 표시 브랜드 수정: 브랜드(D열, 위) + 상품(S열, 아래). 구분선 분리, 표시 순서는 묶음 섞어서 통합 정렬.
  - 컬럼 위계: P열=R열 그룹, D열=S열 그룹. 그룹핑(상위) 레벨을 위로 통일.
  - 백엔드 `channel_issue` 채널별 `values`(P열 합계)+`products`(S열) 추가 → **Mac Mini 재배포 필요**.
  - selection은 타입 태그 id(`P:`/`R:`/`D:`/`S:`) 저장, 기존 평문 자동 마이그레이션. recharts dataKey=id/name=표시이름.
  - 상세: `docs/design_document.md §2.3.3.15`, 에러: `docs/error.md §36`
  - **성능 후속 (24회차 same-day)**: S열 추가로 summary가 part당 ~7s로 회귀 → ① 채널당 `groupby` 1회 집계 ② 요청 part만 빌드. all 3.0s/ecommerce 1.7s/offline 1.3s로 회복. 에러: `docs/error.md §37`. → **Mac Mini 재배포 필요**.
- **주요 채널 이슈 — 부모 그룹핑 + 교차필터 (2026-05-21 26회차)**: 표시 브랜드/거래처 수정 모달을 부모(브랜드 D열 / 채널 P열) 헤더 아래 [부모 합계 + 자식 가나다순] 구조로 재구성. **선택된 부모가 자식 라인을 동적 스코프** — 부모 미선택 시 전체 합산, 부모 선택 시 교집합만, 교집합 없으면 0. 데일리케어 물티슈 ≠ 라포레띠 물티슈를 위해 백엔드 products를 `(품목그룹1, 품목 구분)`로 분해(`brand` 필드). 여러 브랜드 걸친 상품의 모달 row 수는 그룹 몫으로 표시(`대상 X` 마이비=377). 식별자 스킴 불변 → 선택값 마이그레이션 불필요. 상세: `docs/design_document.md §2.3.3.16`. → **Mac Mini 재배포 필요**.
- **종합/브랜드 종합 차트 편집 모드 + 헤더·높이 정리 (2026-05-21 27회차)**: 편집 모드를 종합 영역 3개 차트(이커머스 vs 오프라인 / 브랜드별 매출 트렌드 / 브랜드별 매출 비중)로 확장 — `ProductSelectionModal`(체크 선택 + 표시 순서) + B-6 팔레트 재사용, 백엔드 무변경. **트렌드·비중은 선택 공유**(편집 버튼은 트렌드에만, 비중은 따라감), chart3은 파트별 독립 선택. 신규 `overviewSelectionStorage.ts`(미편집=전체 표시). `ProductSelectionModal.row_count` 옵셔널화. 디자인 정리: 버튼 라벨 `수정 ▾`, `EM vs LM vs 다이소` 제목, `최근 12개월` 헤더 제거(chart2/3/4·비중 제목)·비중 메타는 `최근 12개월 (단위: 백만)`, 목표비 실적 차트 높이 227px로 세 카드 329px 통일, 목표비 실적 양 막대(사업계획·실적) 모두 값 레이블 표시. 상세: `docs/design_document.md §2.3.3.17`, 높이 이슈 `docs/error.md §41`. 백엔드 제목 2건 변경 → **Mac Mini 재배포 필요**(레이블 변경은 프론트만).
- **종합 섹션 실적 요약 라인 (2026-05-21 27회차 후속)**: "종합" 제목 아래에 대상월 실적 한 줄 요약 추가 — `실적 : N 백만 (목표비 비율% , 전월비/직전3개월비/전년비 증감률)`. 목표비는 비율(달성률), 나머지 3종은 증감률(양수 `▲`/음수 `▼`). 직전 3개월비 기준 = 대상월 제외 직전 3개월 평균. 현재 파트 기준 자동 갱신, 기존 chart1+chart2 데이터로 프론트 계산. 상세: `docs/design_document.md §2.3.3.18`. **프론트 단독(재배포 불필요)**.
- **종합 섹션 사용자 코멘트 (2026-05-21 27회차 후속)**: 종합 요약 라인 아래 자유 입력 코멘트(여러 줄 textarea + `저장` 버튼). **편집 모드일 때만 입력**, 보기 모드는 텍스트만(없으면 미표시). **대상 월 × 파트 조합별 독립 저장**(신규 `overviewNotesStorage.ts`, localStorage). 상세: `docs/design_document.md §2.3.3.19`. **프론트 단독(재배포 불필요)**.
- **종합 섹션 AI 매출 분석 (2026-05-21 28회차)**: 대상 월 선택 후 `AI 분석` 버튼 → 모달에서 사용자가 작성한 **파트별 분석 프롬프트**대로 Gemini(`gemini-3.5-flash`)가 그 달 매출(종합+트렌드+채널이슈)을 분석. 프롬프트는 **백엔드 파일 저장**(`analysis_prompts.json`), 편집 모드에서만 편집. 신규 백엔드 엔드포인트 3개(`/analysis-prompt/` GET·POST, `/ai-analysis/` POST)·신규 컴포넌트 `AIAnalysisModal.tsx`. 상세: `docs/design_document.md §2.3.3.20`. **백엔드 변경 포함 → Mac Mini 재배포 필요(2026-05-21 수동 패치 완료)**.
- **품목 단위 차트 표시 단위 백만원 → 만원 (2026-05-24 30회차)**: 채널 이슈(`ChannelIssueSection`)·브랜드 상세(`BrandSection`)의 품목·거래처 차트가 백만원 정수 반올림이라 100만원 미만 항목(예: 2in1 컵 2026-04 = 262,018원)이 0으로 표시되던 문제 → 만원 단위(천원 반올림)로 변경. 집계 차트(브랜드 종합 트렌드 등)는 백만 유지. 상세: `docs/design_document.md §2.3.3.21`, `docs/error.md §45·§46`. **프론트 단독(재배포 불필요)**.
- **브랜드별 차트 D열 동적 전체 브랜드 (2026-05-24 30회차)**: chart4 트렌드·chart5 비중의 브랜드 목록을 고정 5개(마이비/누비/쏭레브/에코보/기타)에서 **D열(품목그룹1) 실제 브랜드 전체(개별 9 + 기타)로 동적화**, 판매액 desc 정렬, 기본 상위 3개 표시. BRAND_ETC(기타(타사)·부자재(공통)·구브랜드·빈값)만 기타로 묶음. 상세: `docs/design_document.md §2.3.3.22`. **백엔드 변경 포함 → Mac Mini 재배포 필요**.
- **브랜드 종합 요약 라인 + 트렌드 13개월 + 브랜드 목표 (2026-05-24 30회차)**: "브랜드 종합" 헤더 아래에 **선택 브랜드별 실적 요약 라인(줄바꿈)** 추가 — 실적·목표비·전월비·직전3개월비·전년비. 전년비 위해 브랜드 트렌드(chart4)를 **13개월(대상월-12~대상월)**로 확장(전년 동월 포함). 목표비는 '전사' 시트에서 추출한 브랜드 목표(`api/brand_targets.csv`, 마이비/누비/쏭레브/데일리케어/에코보) 기준 — **part=all에서만**, 그 외/목표없는 브랜드는 `-`. 상세: `docs/design_document.md §2.3.3.23`. **백엔드 변경 + 신규 데이터 파일 → Mac Mini 재배포 필요**.
- **브랜드 상세 헤더 실적 요약 + 섹션 13개월 (2026-05-24 31회차)**: "브랜드 상세"(마이비/누비/쏭레브) 각 브랜드 헤더 아래에 **브랜드 전체 요약 1줄(백만)** + **선택 주요 상품별 요약 N줄(만원)** 추가 — 목표 미보유라 전월비·직전3개월비·전년비만(목표비 제외). 전년비 위해 브랜드 상세 **전체 차트(종합 트렌드·주요 상품 라인·개별 상품)를 13개월로 확장**(채널 이슈 섹션 12개월은 유지). 상품 요약은 `selection.mainLine` 선택 순서, `brand_products` 기반. 상세: `docs/design_document.md §2.3.3.24`. **백엔드 13개월 확장 → Mac Mini 재배포 필요**(상품 요약 추가분은 프론트 전용·Vercel 자동).
- **채널 종합 요약 라인 + 트렌드 13개월 (2026-05-24 32회차)**: "채널 종합"(ChannelSection) 헤더 아래에 **선택 채널별 실적 요약 라인(백만)** 추가 — 목표 미보유라 전월비·직전3개월비·전년비만. 전년비 위해 **채널별 매출 트렌드 차트만 13개월로 확장**(비중 파이·월평균 막대는 12개월 유지). 백엔드 `_option_from_frame`에 `values13`(13개월) 필드 + 응답 `channel_months13` 신규. 상세: `docs/design_document.md §2.3.3.25`. **백엔드 변경 → Mac Mini 재배포 필요**.
- **주요 채널 이슈 레이아웃 컬럼형 → 행형 (2026-05-25 33회차)**: "주요 채널 이슈"(ChannelIssueSection)를 그룹=N컬럼(컬럼 안 두 차트 세로)에서 **그룹=N행**(그룹 헤더 + 거래처별 | 브랜드별 트렌드 가로 2열)으로 전치. 차트 데이터·편집 기능 무변경. 상세: `docs/design_document.md §2.3.3.11`. **프론트 전용 → Vercel 자동 배포**.
- **브랜드 상세 개별 상품 차트 단위 라벨 추가 (2026-05-25 34회차)**: 종합 트렌드(백만)와 개별 상품(만원) 단위가 다른데 개별 상품 카드에 단위 라벨이 없어 "상품 매출 > 브랜드 종합" 정합성 착시 발생(사용자 제보). 개별 상품 카드에 `13개월 (단위: 만)` 라벨 추가(데이터·계산 무변경). 상세: `docs/design_document.md §2.3.3.24`, `docs/error.md §49`. **프론트 전용 → Vercel 자동 배포**.
- **Sticky 컴팩트 바 (2026-05-19 16회차)**: 원본 컨트롤 영역이 화면 밖으로 나가면 페이지 상단에 고정 노출. 포함: `← 뒤로 / 월 리뷰` + `대상 월 / 파트` + `차트 표시 / PDF 다운로드`. 매출/목표 파일은 제외 (한 번 선택 후 자주 변경되지 않음). IntersectionObserver 기반 fade-in 200ms. 상세: `docs/design_document.md §2.3.3.9`
- **Phase 3 브랜드 상세 (2026-05-19 구현, 동적 컴포넌트)**:
  - 단일 컴포넌트 `BrandSection` × 3 (마이비 / 누비 / 쏭레브). 각 브랜드 섹션이 자체적으로 3종류 차트 그룹 렌더:
    - **종합 트렌드** (단일 line, 12개월) — 백엔드 `chart10/12/14`
    - **주요 상품 라인** (multi-line, 사용자 선택) — `brand_products`에서 selection.mainLine 만큼 동적 라인
    - **개별 상품 차트** (3-col grid, 각 카드 1 line) — selection.individual 만큼 동적 카드 + 우측 상단 `×` 제거 + 마지막 슬롯 `+ 상품 추가`
  - **사용자 선택은 R열 규약 아닌 S열(`품목 구분`) 기준** — 거래처가 아닌 상품 카테고리 식별이므로
  - **백엔드 응답 신규 필드**:
    - `brand_products`: `{ "마이비": [{name, row_count, values[12]}], "누비": [...], "쏭레브": [...] }` — 각 브랜드의 모든 S열 옵션 + 12개월 매출 데이터
    - `brand_products_months`: `["2025-01", ...]` 12개월 라벨 배열
  - **localStorage 저장 키**: `avk_monthly_review_brand_selections`
    - **v2 구조 (2026-05-19 17회차 — 파트별 독립 저장)**: `{ all: {마이비, 누비, 쏭레브}, ecommerce: {...}, offline: {...} }` 각 브랜드 = `{ mainLine, individual }`
    - **v1 → v2 마이그레이션**: 기존 단일 selection을 3 파트 모두에 복사 후 v2로 저장 (자동)
  - **기본 선택값** (PPT 언급 상품): 마이비 5(순한라인/얼룩제거제/삶기세제/건조기시트/구강티슈) / 누비 3(롱핸들/스텐 물병/정글 물병) / 쏭레브 4(키즈 샴푸/핸드워시/클렌징 젤/바디 크림)
- **차트 표시 모달 (ChartVisibilityModal)**:
  - 종합 / 브랜드 종합 / 채널 종합 (chart 1~9)만 토글 대상
  - 브랜드 상세는 BrandSection의 자체 모달(`ProductSelectionModal`)로 관리
- **매핑 규약**:
  - 파트 필터: `all` → 필터X / `ecommerce` → `파트구분 == '이커머스'` / `offline` → `파트구분 == '오프라인'`
  - 주력채널 정의: CSV의 `주력 채널` 컬럼 값이 `'주력'` 인 row 합산
  - 쿠팡(사입) 정의: `주력 채널 == '주력(쿠팡)'` (CSV 검증: 100% `오픈마켓(사입) + 쿠팡_사입(AVK)`)
  - **거래처 식별 — R열 기준 (영구 규약)**: 거래처 단위 매출 집계는 항상 **R열(`거래처명`, 0-indexed 17)** 사용. C열(`거래처`)이 아님. 이마트/롯데마트/다이소 매핑: `거래처명 == '이마트'` / `'롯데마트'` / `'다이소'` (R열에 이미 본부+점포가 통합된 정규화 값으로 들어옴)
- **PDF 출력**: 클라이언트 사이드 (`html2canvas` + `jspdf`), A4 가로

### 4.8 그래프 기간(날짜) 기기 간 유지 ⭐ NEW (35회차)
- 매출 분석 대시보드의 그래프 6종(`sales`/`channel`/`product-group`/`detailed`/`product-search`/`brand`)이 마지막으로 설정한 `시작월~종료월`을 **그래프별로 독립 저장**.
- **백엔드 저장**(`dashboard_dates.json`)이라 새로고침은 물론 **다른 기기/브라우저에서도 동일 복원**(선택 파일 유지의 `localStorage`와 달리 기기 공유).
- 저장 범위는 **날짜만**. 복원은 현재 데이터 월 목록에 존재할 때만(없으면 기본값 폴백). 월/일 토글 차트는 월 모드에서만 적용. 월 리뷰는 대상 아님.
- 상세 설계: `design_document.md §2.2`.

### 4.9 서버 로그 관리 (조회·비우기, 관리자 비번) ⭐ NEW (37회차)
- 매출 분석 대시보드(`/custom-dashboard`) "시스템 로그" 모달에서 백엔드 로그 2종(`chat_debug.log` AI 디버그 / `error.log` 시스템 에러)을 **조회**하고, 모달 하단 `로그 지우기`로 **내용 비우기(truncate)** 가능.
- **인증(L1 — 단일 공용 비밀번호)**: 조회·비우기 모두 `X-Admin-Password` 헤더 필요. 백엔드는 맥미니 `.env`의 `ADMIN_PASSWORD`(gitignore, 커밋 안 됨)와 `hmac.compare_digest`(utf-8 bytes)로 대조. 미설정 시 503, 불일치 시 401. 프론트는 비번 1회 입력 후 세션 메모리 캐시(새로고침 시 소멸, 401 시 폐기).
- 아이디/계정 체계 아님(로그인 없음). 로그가 보호 대상이라 위험 낮은 내부용 가드.
- 함정 기록: `hmac.compare_digest`는 비ASCII(한글) 비밀번호에서 TypeError → 반드시 bytes로 비교. 상세: `docs/error.md §52`.

---

## 5. 핵심 비즈니스 로직

### 5.1 일평균 매출 계산 규칙 ⭐ (매우 중요)

```
규칙:
- 당월 (파일의 최신월): 실제 데이터가 있는 일수로 나눔
- 과거 달: 해당 월의 달력 일수로 나눔 (1월=31, 2월=28/29 ...)
```

**예시** (파일 최신일: 2026년 2월 3일):

| 월 | 나누는 값 | 이유 |
|----|----------|------|
| 2026년 2월 (당월) | 3 | 실제 데이터 3일 |
| 2026년 1월 (전월) | 31 | 달력 일수 |
| 2025년 12월 | 31 | 달력 일수 |
| 2025년 2월 (전년 동월) | 28 | 달력 일수 |

### 5.2 최근 3개월 정의

```
최근 3개월 = 당월 제외, 이전 3개월
```

**예시** (당월: 2026년 2월):
- 최근 3개월 = 2025년 11월, 12월, 2026년 1월
- ❌ 2025년 12월, 2026년 1월, 2월 (당월 포함 안됨)

### 5.3 최근 3개월 매출 표시

```
- "누적" 칸: 3개월 합계 ÷ 3 = 월평균 매출
- "일평균" 칸: 3개월 합계 ÷ 달력 일수 합
```

### 5.4 데이터 캐싱 (SHA256 컨텐츠 해시 기반)

```
1. 인메모리 캐시 (df_cache): SHA256 해시를 키로 DataFrame 저장
2. Parquet 캐시: uploads/cache/{sha256}.parquet 형태로 저장
3. filename → hash 매핑: _filename_hash_cache (DB 조회 캐시) + DB 권위
4. 캐시 클리어: POST /api/cache/clear?filename=xxx (filename 인터페이스 유지)
```

#### 캐시 키 = 컨텐츠 해시인 이유
- 같은 파일명을 다른 내용으로 덮어쓸 때 파일명을 키로 쓰면 stale 캐시가 반환됨.
- DB의 `uploaded_files.file_hash` 컬럼이 권위 있는 hash 출처. 업로드 시 SHA256을 계산해 저장.
- 컨텐츠가 바뀌면 hash가 바뀌므로 캐시가 자연스럽게 분리됨 → stale 가능성 자체가 사라짐.
- 외부 API/프론트엔드 인터페이스는 그대로 `filename`을 사용 (하이브리드 방식).

#### 마이그레이션 / 백필
- `init_db()`가 `_ensure_file_hash_column()`을 호출 → 기존 테이블에 `file_hash` 컬럼이 없으면 `ALTER TABLE ADD COLUMN` (SQLite/PostgreSQL 호환).
- 직후 `backfill_file_hashes()`가 hash가 NULL인 row를 찾아 SHA256 계산 후 채움.

#### 업로드 시 정리
- 옛 hash의 parquet 파일이 있으면 새 hash로 바뀐 직후 `index.py:upload_file()`이 옛 parquet을 자동 삭제 → disk 누수 방지.

> [!NOTE]
> 백엔드는 Mac Mini 로컬에서 실행되므로 `uploads/cache/*.parquet`은 영구 보존된다. 재시작 후에도 캐시가 유지되어 응답 지연이 없다.

---

## 6. API 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/upload` | CSV/XLSX 파일 업로드 |
| GET | `/api/dashboard/summary` | 월간 매출 현황 보고서 |
| GET | `/api/dashboard/monthly-sales-by-channel` | 월별 채널별 매출 |
| GET | `/api/dashboard/monthly-sales-by-product-group` | 월별 품목그룹별 매출 |
| GET | `/api/dashboard/channel-sales` | 채널 매출 차트 데이터 |
| GET | `/api/dashboard/performance` | 매출 성과 알림 카드 |
| GET | `/api/dashboard/product-search-sales` | 상품 검색 매출 |
| POST | `/api/cache/clear` | 캐시 클리어 |
| GET | `/api/monthly-review/months` | 매출 파일에서 가용 월 목록 추출 ⭐ NEW |
| GET | `/api/monthly-review/summary` | 월 리뷰 종합 (chart 1~3 데이터) ⭐ NEW |
| POST | `/api/monthly-review/targets` | 목표 파일 업로드 ⭐ NEW |
| GET | `/api/monthly-review/targets` | 목표 파일 리스트 ⭐ NEW |
| GET | `/custom/dashboard-dates/` | 대시보드 그래프별 기간(날짜) 설정 조회 ⭐ NEW (35회차) |
| POST | `/custom/dashboard-dates/` | 대시보드 그래프별 기간(날짜) 설정 저장 ⭐ NEW (35회차) |
| POST | `/api/chat/` | AI 자연어 데이터 질의 (Gemini, `chat.py`) — EUC-KR(cp949) CSV 폴백 (36회차) |
| GET | `/logs/` | 서버 로그 2종 조회 (관리자 비번 `X-Admin-Password`) ⭐ NEW (37회차) |
| POST | `/logs/clear` | 서버 로그 비우기(truncate) (관리자 비번) ⭐ NEW (37회차) |

---

## 7. 배포 프로세스

```bash
# 1. 프론트엔드 빌드
cd frontend && npm run build

# 2. Git 커밋 & 푸시
git add -A
git commit -m "변경 내용 설명"
git push

# 3. 자동 배포
# - Vercel: GitHub push 시 자동 빌드/배포 (프론트엔드)
# - 배포 완료까지 약 1-2분 소요

# 4. 백엔드 (Mac Mini 로컬)
# - Mac Mini에서 launchd로 자동 실행 (com.avk.backend)
# - Cloudflare Tunnel을 통해 https://api.gongbaksoo.com 으로 노출
# - 백엔드 변경 시: Mac Mini에서 직접 코드 수정 후 uvicorn 재시작
# - 상태 확인: curl https://api.gongbaksoo.com/api/health
```

### 백엔드 인프라 (Mac Mini)

| 항목 | 내용 |
|------|------|
| **실행 방식** | launchd (`com.avk.backend`) — 부팅 시 자동시작 |
| **프로세스** | uvicorn `index:app --host 127.0.0.1 --port 8000` |
| **공개 URL** | Cloudflare Tunnel → `https://api.gongbaksoo.com` |
| **데이터 저장** | SQLite (`api/metadata.db`) + 로컬 파일시스템 (영구 보존) |
| **로그** | `api/uvicorn.log`, `api/uvicorn.error.log` |
