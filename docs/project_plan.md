# 📋 Sales Analysis Site - 프로젝트 플랜 문서

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | Vibe Sales - Premium Analytics Dashboard |
| **목적** | 매출 CSV/XLSX 파일을 업로드하여 다양한 차트와 테이블로 매출 분석 |
| **프로젝트 경로** | `/Users/gongbaksoo/Desktop/Vibe Coding/AVK_Sales/` |
| **GitHub** | `https://github.com/gongbaksoo/gogoooooma.git` |
| **배포** | Vercel (프론트엔드) + Railway (백엔드 API) |
| **프론트 URL** | `https://gogoooooma.vercel.app` |
| **백엔드 URL** | `https://gogoooooma-production.up.railway.app` |

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| **프론트엔드** | Next.js, React, TypeScript, Tailwind CSS |
| **백엔드** | Python, FastAPI, Pandas, NumPy |
| **차트 라이브러리** | Recharts (프론트엔드) |
| **배포** | Vercel (프론트), Railway (백엔드) |
| **데이터 캐싱** | Parquet 파일 캐시 + 인메모리 캐시 (`df_cache`) |

---

## 3. 디렉토리 구조

```
sales-analysis-site/
├── api/                          # 백엔드 (Python/FastAPI)
│   ├── index.py                  # API 라우터 (엔드포인트 정의)
│   ├── dashboard.py              # 핵심 비즈니스 로직 (매출 계산)
│   ├── uploads/                  # 업로드된 CSV/XLSX 파일 저장
│   │   └── cache/                # Parquet 캐시 파일
│   └── verify_daily_api.py       # API 검증 스크립트
├── frontend/                     # 프론트엔드 (Next.js)
│   ├── src/
│   │   ├── app/                  # 페이지 라우팅
│   │   │   ├── page.tsx          # 메인 페이지 (파일 업로드)
│   │   │   ├── custom-dashboard/ # 대시보드 페이지
│   │   │   └── coupang-orders/   # 쿠팡 주문 페이지
│   │   └── components/           # React 컴포넌트들
│   │       ├── SalesSummary.tsx           # 월간 매출 현황 보고서 테이블
│   │       ├── ProductSearchChart.tsx     # 상품 검색 차트
│   │       ├── ChannelSalesChartNew.tsx   # 채널별 매출 차트 (현행)
│   │       ├── BrandAnalysisSection.tsx   # 브랜드 분석 섹션
│   │       ├── SalesChartNew.tsx          # 채널별 매출 차트 (메인)
│   │       ├── ProductGroupChartNew.tsx   # 품목그룹별 매출 차트
│   │       ├── DetailedSalesChartNew.tsx  # 3단계 필터 매출 차트
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
> Railway 컨테이너의 디스크는 휘발성. `uploads/cache/*.parquet`은 매 배포마다 사라지므로 첫 요청에서 원본 파일을 다시 파싱한다 (정합성에는 영향 없음, 일시적 응답 지연만).

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
# - Railway: GitHub push 시 자동 빌드/배포 (백엔드)
# - 배포 완료까지 약 1-2분 소요
```
