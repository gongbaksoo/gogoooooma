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
│   ├── uploads/                  # 업로드된 CSV/XLSX 파일 저장
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
  - **Chart 4 — 브랜드별 매출 트렌드** (LineChart, 5-series, 12개월): 마이비/누비/쏭레브/에코보/기타 (모노 4단계 + 회색)
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
- **레이아웃**: 4개 섹션 — `종합` (chart 1~3) / `브랜드 종합` (chart 4~6) / `채널 종합` (ChannelSection) / `브랜드 상세` (BrandSection × 3). 각 섹션 자체 헤더 + grid.
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
