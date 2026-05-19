# 🎨 Sales Analysis Site - 디자인 문서

## 1. 전체 디자인 컨셉

> **변경 이력**: 2026-05-18 — 29CM(에디토리얼 셀렉트샵) 기반 모노톤 톤으로 전환. 현재 컨셉은 **§8 29CM 디자인 시스템** 참조. 아래 표/이하 섹션은 이전 디자인 시점의 기록.

| 항목 | 이전 (2026-05-15까지) | 현재 (2026-05-18 ~) |
|------|----------------------|----------------------|
| **테마** | 프리미엄 분석 대시보드 (블루+그라데이션) | 29CM 에디토리얼 모노톤 |
| **색상 기조** | 화이트/슬레이트 + 블루 액센트 | 순백/순흑 + `#c4c4c4` outline + `#ff0066` 세일레드 액센트 |
| **폰트** | 시스템 기본 (sans-serif) | Pretendard Variable (400/700/800) |
| **레이아웃** | 반응형, 모바일 카드뷰 / 데스크탑 테이블뷰 | 동일 (반응형 유지) |
| **레퍼런스** | — | `Design/DESIGN.md` (29CM omd 0.1) |

---

## 2. 페이지 구조

### 2.1 메인 페이지 (`/`)
- 포털 카드 레이아웃 (각 기능 진입점)
- 카드 1: **매출 분석 대시보드** → `/custom-dashboard`
- 카드 2: **월 리뷰** → `/monthly-review` ⭐ NEW
- 두 카드 동일한 ghost 스타일 — 헤딩 22px/700, 본문 15px/400, 더보기 ghost CTA

### 2.2 커스텀 대시보드 (`/custom-dashboard`)
- 상단: 파일 선택 UI + 네비게이션 버튼
- **월간 매출 현황 보고서** (SalesSummary)
- **알림 카드** (Sales Performance Alerts)
- **채널별 매출 차트** (ChannelSalesChart)
- **브랜드 분석 섹션** (BrandAnalysisSection)
- **상품 검색 차트** (ProductSearchChart)

#### 상태 영속성 (선택 파일 유지)
- 선택한 파일명은 `localStorage`의 `avk_selected_file` 키에 저장.
- 마운트 직후 `useEffect`에서 읽어 `selectedFile`/`filename` 복원 → 새로고침 후에도 직전 선택 유지.
- 파일 업로드 / FileSelector 변경 시 `persistSelectedFile()`로 동기 저장.
- SSR 안전: `typeof window !== "undefined"` 가드.

### 2.3 월 리뷰 (`/monthly-review`) ⭐ NEW

PPT 월간 리뷰 보고서를 화면에서 재현하고 PDF로 출력하는 정형 대시보드.

#### 2.3.1 레이아웃

```
┌──────────────────────────────────────────────────────┐
│  ← 뒤로  │  월 리뷰                                   │
├──────────────────────────────────────────────────────┤
│  매출 파일: [ 260210.csv ▾ ]   목표 파일: [ ... ▾ ]   │
│  대상 월:   [ 2026-04 ▾ ]                            │
│  파트:     [ 전체 ] [ 이커머스 ] [ 오프라인 ]          │
│                                  [ PDF 다운로드 ]    │
├──────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │  Chart 1   │  │  Chart 2   │  │  Chart 3   │     │
│  │  목표비    │  │  전년비    │  │  주력 vs   │     │
│  │  실적      │  │  트렌드    │  │  쿠팡사입  │     │
│  └────────────┘  └────────────┘  └────────────┘     │
└──────────────────────────────────────────────────────┘
```

데스크탑: 3열 그리드. 모바일: 1열 세로 스택.

#### 2.3.2 컨트롤 영역
| 컨트롤 | 스타일 | 비고 |
|---|---|---|
| 매출/목표 파일 선택 | Ghost Select (§8.3) | 기존 `FileSelector` 패턴 재사용 |
| 대상 월 드롭다운 | Ghost Select | `/api/monthly-review/months`에서 동적 로드 |
| 파트 토글 (3-segment) | Active=인버티드 검정 / Inactive=ghost | `SegmentedControl` 패턴 |
| PDF 다운로드 | Primary CTA (인버티드 검정) | 페이지당 1회 사용으로 위계 보강 |

#### 2.3.3 차트 디자인

| Chart | 종류 | 시리즈 | X축 | 컬러 매핑 |
|-------|------|--------|-----|-----------|
| 1. 목표비 실적 | BarChart (수직 2개) | 사업계획 / 실적 | 사업계획, 실적 | 사업계획 `#5d5d5d`, 실적 `#000000`, 달성률(%) 라벨 `#ff0066` |
| 2. 전년비 트렌드 | LineChart (12점) | 당해 / 전년 | **대상월 기준 직전 12개월** (`YY.MM` 라벨) | 당해 `#000000` 실선, 전년 `#5d5d5d` 점선 |
| 3. 파트별 동적 비교 | LineChart (12점) | **파트에 따라 전환** (아래 §2.3.3.2) | 최근 12개월 | 백엔드 응답에 포함 (동적) |

축·그리드·툴팁 모두 §8.5 차트 팔레트 규약 따름.

**Chart 2 시간축 규약** (2026-05-18 전환):
- X축 라벨은 **그 시점의 매출** (예: `25.03`은 2025년 3월 매출).
- "전년" 시리즈는 **같은 X축 위치에서 1년 전 매출** (예: X축 `25.03`의 전년 값 = 2024년 3월 매출).
- 빈 칸 없이 12개월 전부 채워짐. 이전 캘린더 연도 고정(1~12월) 방식에서 trailing 12-month로 전환.

#### 2.3.3.2 Chart 3 파트별 동적 전환 (2026-05-19 도입)

파트 필터 값에 따라 차트 내용·제목·시리즈명이 자동 전환. 백엔드가 `{title, series_names, colors, data}` 메타데이터까지 반환하면 프론트엔드는 그대로 렌더.

| 파트 | 제목 | 시리즈 1 (메인) | 시리즈 2 | 색 매핑 | 데이터 소스 |
|------|------|---------------|----------|---------|------------|
| `all` (전체) | 이커머스 vs 오프라인 | 이커머스 | 오프라인 | `#000000` / `#5d5d5d` | `파트구분` 컬럼 |
| `ecommerce` | 주력채널 vs 쿠팡(사입) | 주력채널 | 쿠팡(사입) | `#000000` / `#ff0066` | `주력 채널` 컬럼 (`주력` / `주력(쿠팡)`) |
| `offline` | 주력채널 vs 쿠팡(사입) | 주력채널 | 쿠팡(사입) | `#000000` / `#ff0066` | `주력 채널` 컬럼 (오프라인 파트에는 쿠팡 사입이 0인 게 정상) |

**색 위계 차이**: `all` 모드는 두 파트의 카테고리 비교라 모노톤 (검정+회색). `ecommerce/offline` 모드는 채널 내 쿠팡을 단일 강조 대상으로 보고 `#ff0066` 액센트 적용 (PPT 원본 의도 유지).

**API 응답 구조**:
```json
"chart3": {
  "title": "이커머스 vs 오프라인",
  "series_names": ["이커머스", "오프라인"],
  "colors": ["#000000", "#5d5d5d"],
  "data": [{"month": "2025-03", "value1": 380900000, "value2": 66500000}, ...]
}
```

기존 array `[{month, main_channels, coupang_purchase}]` 구조는 폐기.

#### 2.3.3.1 차트 전환 애니메이션
- **§8.10 차트 등장 애니메이션 통일 규약** 적용 (Recharts 기본 활성화 + `animationDuration={1500}` `animationEasing="ease-out"`).
- 데이터 시그니처 기반 `key` (월 리뷰는 `month` 또는 `data[0].month + data.length`)로 파트·월 전환 시 차트 remount → 애니메이션 재생.
- 이전 도입했던 `chart-fade-in` CSS 클래스와 `isAnimationActive={false}` 패턴은 §8.10에 의해 폐기 (2026-05-18 6차 적용).

#### 2.3.4 목표 파일 포맷

```csv
월,파트,목표
2026-04,전체,500000000
2026-04,이커머스,250000000
2026-04,오프라인,250000000
2026-05,전체,520000000
...
```

- 단위: 원 (정수)
- 파트 값: `전체` | `이커머스` | `오프라인` (한글 그대로)
- 월 포맷: `YYYY-MM`

#### 2.3.5 PDF 출력 정책

| 항목 | 값 |
|---|---|
| 라이브러리 | `html2canvas` + `jspdf` (클라이언트 사이드) |
| 캡처 대상 | 차트 그리드 영역 (컨트롤 영역 제외) |
| 출력 포맷 | A4 가로, PNG 이미지 임베드 |
| 파일명 | `monthly-review-{YYYY-MM}-{part}.pdf` |

#### 2.3.6 빈 상태 / 에러 상태
- 매출 파일 미선택: "매출 파일을 선택해주세요" — `#5d5d5d` 텍스트, 차트 자리 비움
- 목표 파일 미선택: chart 2,3는 정상 표시, chart 1 자리에 "목표 데이터를 업로드하세요" 안내
- 데이터 없음: 차트 영역에 "데이터가 없습니다" — 토큰 §8.6 비활성 상태 사용

---

## 3. SalesSummary 테이블 디자인

### 3.1 테이블 열 구성 (좌→우)

| 열 | 너비 | 배경색 | 설명 |
|----|------|--------|------|
| 구분 | 10% | 기본 | 카테고리명 (전체, 이커머스 등) |
| 당월 누적 | 12% | 기본 | 당월 누적 매출 (백만 단위) |
| 당일매출 | 8% | 기본 | 최신일 매출 |
| 당월 일평균 | 12% | 기본 | 당월 일평균 + 데이터 일수 |
| 전월 대비 | 12% | 기본 | 성장률 (초록/빨강 배지) |
| 전월 | 14% | 기본 | 전월 누적 / 일평균 |
| 최근 3개월 | 16% | `bg-blue-50/50` | 월평균 매출 / 일평균 + 일수 |
| 전년 동월 | 13% | `bg-amber-50/50` | 전년 동월 누적 / 일평균 |

### 3.2 셀 내부 레이아웃

```
┌──────────────────┐
│  누적 485 백만    │  ← 상단: 누적/월평균 (큰 텍스트)
│  일평균 15 백만   │  ← 하단: 일평균 (작은 텍스트, 회색)
│          92일     │  ← 일수 표시 (더 작은 텍스트)
└──────────────────┘
```

### 3.3 행 구분

| 행 | 스타일 |
|----|--------|
| 전체 매출 | `bg-slate-50/50`, 볼드, 파란 세로선 ❌ (제거됨) |
| 이커머스 | 기본 배경 |
| 오프라인 | 기본 배경 |
| 마이비/누비/쏭레브 | 기본 배경 |

### 3.4 성장률 배지 색상

```
양수 (성장): 초록 배경 (bg-emerald-50), 초록 텍스트
음수 (감소): 빨강 배경 (bg-rose-50), 빨강 텍스트
```

### 3.5 모바일 대응
- 테이블은 가로 스크롤 (`overflow-x-auto`)
- 카드뷰로 전환되는 별도 모바일 UI도 존재

---

## 4. 차트 디자인

### 4.1 공통 차트 스타일
- Recharts 라이브러리 사용
- 툴팁: 커스텀 스타일 (반투명 배경, 그림자)
- 레전드: 차트 상단
- 반응형 (`ResponsiveContainer`)

### 4.2 채널별 매출 차트
- **Bar Chart**: 이커머스(파란) + 오프라인(회색) 스택형
- **Line Chart**: 이익률 듀얼 축 (우측 Y축)
- 필터: 파트구분 / 채널구분 / 거래처명 드롭다운

### 4.3 브랜드별 매출 차트
- **Multi-Line Chart**: 품목그룹별 라인
- 브랜드별 색상 구분
- 이익률 차트 별도 표시

### 4.4 상품 검색 차트
- 검색 입력 → 상품 목록 체크박스
- 선택한 상품 기준 매출 차트 업데이트
- 채널 필터 (파트/채널/거래처) 조합 가능

---

## 5. 알림 카드 디자인

| 상태 | 색상 | 의미 |
|------|------|------|
| `good` | 초록 계열 | 매출 증가 |
| `bad` | 빨강 계열 | 매출 감소 |
| `neutral` | 회색 계열 | 변동 없음 |

카드 내용:
```
┌─────────────────────────────┐
│ 이커머스 - 쿠팡(로켓)         │
│ vs 전월                      │
│ 일평균 매출 15.3% 증가 ↑      │
│ 이익률 2.1%p 하락 ↓          │
│                              │
│ 현재: 45백만  기준: 39백만     │
└─────────────────────────────┘
```

---

## 6. 숫자 포맷 규칙

| 규칙 | 예시 |
|------|------|
| 백만 단위 표시 | 218,147,598 → `218 백만` |
| 소수점 반올림 | 소수점 없이 정수 표시 |
| 0인 경우 | `-` 표시 (특히 전년 동월) |
| 성장률 | `256.5%` (소수 1자리) |

---

## 7. 프론트엔드 컴포넌트 목록

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `SalesSummary` | `SalesSummary.tsx` | 월간 매출 현황 보고서 테이블 |
| `ProductSearchChart` | `ProductSearchChart.tsx` | 상품 검색 + 차트 |
| `ChannelSalesChart` | `ChannelSalesChart.tsx` | 채널별 매출 차트 |
| `BrandAnalysisSection` | `BrandAnalysisSection.tsx` | 브랜드 분석 섹션 |

### 7.1 SalesSummary 인터페이스

```typescript
interface SummaryData {
    current_total: number;       // 당월 누적
    current_daily_avg: number;   // 당월 일평균
    current_days: number;        // 당월 데이터 일수
    latest_day_sales: number;    // 최신일 매출
    growth_rate: number;         // 전월 대비 성장률
    prev_total: number;          // 전월 누적
    prev_daily_avg: number;      // 전월 일평균
    last_3months_total: number;  // 최근 3개월 월평균
    last_3months_daily_avg: number; // 최근 3개월 일평균
    last_3months_days: number;   // 최근 3개월 총 일수
    prev_year_total: number;     // 전년 동월 누적
    prev_year_daily_avg: number; // 전년 동월 일평균
}
```

---

## 8. 29CM 디자인 시스템 (현행, 2026-05-18 ~)

레퍼런스: `Design/DESIGN.md` (29CM omd 0.1, 2026-05-15 검증)

### 8.1 디자인 토큰

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--ink` | `#000000` | 본문/헤딩/인버티드 CTA 배경 |
| `--background` | `#ffffff` | 페이지 배경, ghost CTA 배경 |
| `--outline` | `#c4c4c4` | ghost 버튼·셀렉트·카드 보더 (1px) |
| `--muted` | `rgba(93,93,93,0.64)` | 보조 캡션, placeholder, 메타 텍스트 |
| `--sale-red` | `#ff0066` | 단일 액센트 — 성장률 상승, 차트 강조선, 인라인 에러 보더 |

- 정의 위치: `frontend/src/app/globals.css`
- Tailwind v4 `@theme inline` 등록 (`--color-ink`, `--color-outline`, `--color-muted`, `--color-sale-red`)
- 추가 회색 단계는 hex 인라인 (`#5d5d5d`, `#e5e5e5`, `#f5f5f5`, `#f8f8f8`) — 정식 토큰화 보류

### 8.2 타이포그래피

- **단일 패밀리**: Pretendard Variable (`pretendard` npm 패키지, dynamic-subset CSS 로드)
- 폴백: `ui-sans-serif, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
- 웨이트: 400(본문/캡션), 700(타이틀/가격/CTA), 800(액티브 nav, 선택적)
- 이탤릭 사용 금지 — 강조는 weight로만

| 역할 | 사이즈 | 웨이트 | 비고 |
|------|--------|--------|------|
| 섹션 헤드라인 | 30px | 700 | 라틴/한글 혼용 |
| 에디토리얼 카드 타이틀 | 22px | 700 | line-height 29.92px (1.36) |
| 본문 / 카드 설명 | 15px | 400 | line-height 1.5 |
| ghost CTA "더보기" | 14px | 700 | 트레일링 chevron `>` |
| 푸터 헤딩 | 13px | 700 | 캡스 라틴 (NOTICE, ABOUT US 등) |
| 가격 / 카드 메타 | 12px | 700/400 | 가격은 제목보다 작게 |

### 8.3 컴포넌트 토큰

| 컴포넌트 | 스타일 |
|---------|--------|
| **Primary CTA** (인버티드 블랙) | `bg-black text-white rounded-sm` (2px) — 페이지당 1~2회만 |
| **Ghost CTA** (기본 컨트롤) | `bg-white text-black border border-[#c4c4c4] rounded` (4px), 호버 `border-black` |
| **Active Toggle 버튼** | `bg-black text-white border-black` |
| **Inactive Toggle 버튼** | `bg-white text-black border-[#c4c4c4] hover:border-black` |
| **Input / Select** | `border border-[#c4c4c4] rounded focus:border-black` (포커스 ring 없음) |
| **Card / Wrapper** | `bg-white border border-[#c4c4c4]` — 그림자 없음 |
| **Modal** | 동일 `border border-[#c4c4c4]`, 오버레이 `bg-black/60` |

### 8.4 라운드/그림자/장식 규칙

- **Border-radius 스케일**: 0 / 2px (인버티드 CTA) / 4px (ghost) — **8px 이상 금지, pill 금지**
- **Shadow**: 사용 안 함. 깊이는 색 대비(인버티드)와 보더로만 표현
- **Decorative iconography**: 마케팅 surface에 장식 아이콘 없음. lucide-react는 기능적 컨트롤(닫기, 새로고침, 화살표)에만
- **이모지**: 전면 금지 (UI/카피/에러 메시지 모두)

### 8.5 차트 팔레트 (Recharts) — **데이터 종류별 8-pattern 매핑 (2026-05-18 4차 적용)**

> **변경 이력 (2026-05-18 4차)**: 이전 "시리즈 위계 기반" 매핑(메인=검정/보조=회색/강조=빨강)에서 **"데이터 종류 기반" 매핑**으로 전환. 같은 종류 데이터는 어느 차트에서든 같은 베이스 색을 가지며, 다중 시리즈는 명도 단계 × 실선/점선의 8가지 패턴으로 구분.

#### 공통 토큰

| 항목 | 값 |
|------|-----|
| Grid stroke | `#f0f0f0` |
| Axis stroke | `#5d5d5d` |
| 이익률 우측 Y축 stroke | `#ff0066` |
| Tooltip border / radius | `#c4c4c4` / 2px |

#### 데이터 종류별 베이스 색 (4단계 명도)

| 데이터 종류 | 1단계 (진함) | 2단계 (중간) | 3단계 (옅음) | 4단계 (더옅음) |
|---|---|---|---|---|
| **매출 / 일평균** | `#000000` | `#5d5d5d` | `#7d7d7d` | `#b8b8b8` |
| **이익률** (다중 시리즈 시) | `#ff0066` | `#ff3385` | `#ff66a3` | `#ff99c1` |
| **증감률** | `#065f46` | `#10b981` | `#34d399` | `#6ee7b7` |

- 매출과 일평균은 동일 색조 (29CM 모노톤 원칙 유지). 차트 제목·Y축 라벨로 구분.
- 증감률은 29CM 모노톤 원칙에서 1개 예외(녹색 톤 도입) — 데이터 의미(+/- 변화)의 시각적 차별을 위한 절충.
- 이익률은 Combined view에서는 단일 `#ff0066` 실선 (보조 위계, sw 1.5).

#### 시리즈 순서 → 패턴 (8가지)

| 순서 (i) | 명도 단계 | 라인 패턴 | strokeWidth | dot r | activeDot r |
|---|---|---|---|---|---|
| 1 | 1단계 (진함) | 실선 | 2.5 | 4 | 6 |
| 2 | 1단계 (진함) | 점선 (`"4 4"`) | 1.5 | 3 | 5 |
| 3 | 2단계 (중간) | 실선 | 1.5 | 3 | 5 |
| 4 | 2단계 (중간) | 점선 | 1.5 | 3 | 5 |
| 5 | 3단계 (옅음) | 실선 | 1.5 | 3 | 5 |
| 6 | 3단계 (옅음) | 점선 | 1.5 | 3 | 5 |
| 7 | 4단계 (더옅음) | 실선 | 1.5 | 3 | 5 |
| 8 | 4단계 (더옅음) | 점선 | 1.5 | 3 | 5 |

- 1번째 시리즈만 메인 위계 (sw 2.5, dot r 4). 2번째 이후는 보조 위계로 통일.
- dot strokeWidth(테두리)는 사용하지 않음 (fill only).

#### 시리즈 순서 매핑 규칙

**원칙**: 합계/메인 데이터가 1번째 (가장 두드러진 진함 실선), 이후는 데이터 분해 순.

| 차트 | 1번 | 2번 | 3번 | 4번 | 5번 | 비고 |
|---|---|---|---|---|---|---|
| `SalesChartNew` (sales/daily/growth 모드) | 총매출 | 이커머스 | 오프라인 | — | — | profitRate 모드: 분홍 계열로 동일 매핑 |
| `ChannelSales/Detailed/ProductSearch` (단일 메인) | 메인 데이터 | (이익률, Combined view 시) | — | — | — | profitRate 단독: 분홍, growth: 녹색, sales/daily: 검정 |
| `ProductGroupChartNew` (동적 N개) | 합계 (마이비+누비+쏭레브) | 그룹 1 | 그룹 2 | ... | ... | N>8이면 4단계 명도가 반복 (현재 정책) |
| `DynamicAnalysisSection` single view (channel=total) | 전체 | 이커머스 | 오프라인 | 쿠팡(로켓) | 주력(쿠팡제외) | profit_only는 분홍 계열로 |
| `DynamicAnalysisSection` Combined view (total/avg/daily) | 매출 (메인 실선) | 이익률 (보조 실선) | — | — | — | 이익률은 단일 `#ff0066` |
| `details/page.tsx` 자체 컴포넌트 | 매출 | 이익률 | — | — | — | 동일 패턴 |
| `details/page.tsx` 브랜드 비교 | 전체 | 마이비 | 누비 | 쏭레브 | — | 매출 데이터 (검정 계열 4단계) |

- **한계**: 8개 초과 시리즈는 패턴 반복 (실제로 8개를 넘는 차트는 ProductGroup이 유일하며, 사용자가 토글로 제어).

### 8.6 상태 표현

| 상태 | 표현 |
|------|------|
| 매출 증가 ↑ | `#ff0066` 텍스트 + 보더 |
| 매출 감소 ↓ | 검정 텍스트 + 보더 |
| 변동 없음 | `#5d5d5d` + `#c4c4c4` 보더 |
| 인라인 에러 | `#ff0066` 보더 + `#ff0066` 텍스트 |
| 로딩 스피너 | `border-2 border-black border-t-transparent rounded-full animate-spin` |
| 비활성 (disabled) | `opacity-50` 또는 보더 유지 + 채도 다운 |

### 8.7 보이스 & 카피

- 한국어 우선, 영어는 매거진 섹션 라벨로만 (예: `AI Insight Chat`, `Auto-Refreshed`)
- 친근-격식 어미 (`~해요`, `~하세요`) — 코퍼레이트 `~합니다`는 법적 고지에만
- 금지 표현: `최저가`, `긴급세일`, `오늘만`, `SHOP NOW!`, 이모지, 우르겐시 카운트다운

### 8.8 적용 범위

#### 1차 적용 (2026-05-18 오전)

| 영역 | 파일 수 | 비고 |
|------|---------|------|
| 전역 (CSS·layout·홈) | 3 | `globals.css`, `layout.tsx`, `app/page.tsx` |
| 대시보드 페이지 | 1 | `app/custom-dashboard/page.tsx` |
| 차트/분석 컴포넌트 | 9 | Sales/Channel/ProductGroup/Detailed/ProductSearch/BrandAnalysis/DynamicAnalysis/SalesSummary/SalesAlerts |
| 채팅/파일/모달 | 6 | FileUpload, FileSelector, ChatHistoryList, ChatInterface, AIInstructionsManager, SchemaAliasManager |
| 미적용 | 2 | `app/custom-dashboard/details/page.tsx` (이모지·텍스트만 정리, 카드 wrapper 미손댐), `app/coupang-orders/page.tsx` |

#### 2차 적용 (2026-05-18 오후)

| 영역 | 파일 수 | 비고 |
|------|---------|------|
| 상세 분석 페이지 | 1 | `app/custom-dashboard/details/page.tsx` 전수 적용 (페이지 내부 자체 정의 `DynamicAnalysisSection` 포함) |

#### 4차 적용 (2026-05-18 심야) — 데이터 종류 기반 매핑 전환

차트 stroke의 의미 체계를 "시리즈 위계 기반"에서 "데이터 종류 기반 + 8-pattern"으로 전환.

| 영역 | 파일 수 | 비고 |
|------|---------|------|
| 데이터 종류별 베이스 색 정의 | — | 매출/일평균=검정 4단계, 이익률=분홍 4단계, 증감률=녹색 4단계 (§8.5 참조) |
| 8-pattern 시리즈 매핑 | — | 4단계 명도 × 실선/점선 = 8가지 (§8.5 참조) |
| `SalesChartNew` | 1 | sales/daily/profitRate/growth 4 viewMode × 3 시리즈 (총매출/이커머스/오프라인) viewMode 기반 동적 팔레트 |
| `ChannelSalesChartNew` / `DetailedSalesChartNew` / `ProductSearchChart` | 3 | 메인 라인 색이 viewMode에 따라 동적 (`#000`/`#ff0066`/`#065f46`), Combined view 이익률 점선 제거 → 실선 |
| `ProductGroupChartNew` | 1 | 동적 N개 시리즈, `PALETTES[viewMode]` + 합계 1번째 + 8-pattern 적용. 기존 10색 팔레트 제거 |
| `DynamicAnalysisSection` (공용) | 1 | single view (5/3/1 시리즈) 8-pattern IIFE 도입, Combined view 이익률 점선 제거 → 실선 |
| `details/page.tsx` | 1 | 자체 컴포넌트 이익률 점선 제거 → 실선, 브랜드 비교 4 시리즈 8-pattern (검정 진함실선/진함점선/중간실선/중간점선) |

**4차 누적**: 7개 파일 추가 변경 (1~3차에서 이미 손댄 파일 재변경). 검증: dev `/custom-dashboard`, `/details` HTTP 200, 컴파일 에러 0건.

#### 3차 적용 (2026-05-18 저녁) — 누락 보완

| 영역 | 파일 수 | 비고 |
|------|---------|------|
| 공용 `DynamicAnalysisSection` Recharts 시리즈 색 | 1 | `components/DynamicAnalysisSection.tsx` — 1차 라운드에서 토글 스타일은 손댔으나 차트 stroke 8색 누락. 보라/핑크/파랑/녹색/시안/오렌지/슬레이트/회색 → 모노 흑백 단계 + `#ff0066` |
| 모드별 시리즈 매핑 정의 | — | 전체 5색 / 이커머스 3색 / 오프라인 1색 / Combined 2색 (§8.5 표 참조) |
| 카드 wrapper | 4곳 | flat `border border-[#c4c4c4]`로 통일 |
| 모드 토글 (월매출/일평균/일매출) | 1세트 × 5인스턴스 | 검정 인버티드 + ghost |
| 컬러 박스 + 인라인 SVG 아이콘 | 4개 제거 | indigo-600 / emerald-500 / blue-500 / pink-500 박스 모두 제거 |
| 헤더 텍스트 내 이모지 | 2개 제거 | `🍼 누비`, `🧴 쏭레브` → 단순 텍스트 |
| `emoji` prop | 20개 모두 `""` | ✨/🥄/💧/🌴/🥤/🐞/👶/🧴/🧼 등 |
| 브랜드 비교 라인 차트 시리즈 | 4색 교체 | `#8b5cf6/#3b82f6/#10b981/#f59e0b` → `#000000/#5d5d5d/#c4c4c4/#ff0066` |
| 페이지 내부 자체 차트 시리즈 | 2색 교체 | 판매액 `#8b5cf6` → `#000000`, 이익률 `#ec4899` → `#ff0066` |
| 로딩 상태 | 3곳 | loading/no-data/Suspense fallback 모두 모노 |

**누적 파일 수**: 1차 19개 + 2차 1개 + 3차 1개 + 4차 7개 (1·2·3차에서 손댄 파일에 추가 변경). 검증: dev `/`, `/custom-dashboard`, `/custom-dashboard/details?filename=...&type=ecommerce` 모두 HTTP 200.

#### 미적용 (잔여)

| 영역 | 파일 수 | 비고 |
|------|---------|------|
| 쿠팡 주문 페이지 | 1 | `app/coupang-orders/page.tsx` — 별도 작업 |

### 8.9 알려진 한계 / 후속 항목

1. **쿠팡 주문 페이지 미적용**: `app/coupang-orders/page.tsx`는 아직 미적용. 별도 작업 필요.
2. **매출·일평균 동일 색조의 트레이드오프**: 두 데이터 종류가 같은 검정 계열을 공유하므로 viewMode 토글 시 차트 자체는 시각적으로 구분 불가 (제목·Y축 라벨로만 구분). 사용자가 합의한 절충안.
3. **이익률 다중 시리즈 케이스**: `DynamicAnalysisSection.profit_only + channel=total` 같은 5개 채널 이익률 동시 표시 시 분홍 4단계로 매핑 (§8.5). 단계 차이가 미세할 수 있음.
4. **8-pattern 한계**: 9개 이상 시리즈는 패턴 반복 발생 (ProductGroup만 해당, 사용자가 토글로 제어).
5. **회색 인라인 hex 토큰화**: `#5d5d5d`, `#7d7d7d`, `#b8b8b8`, `#e5e5e5`, `#f5f5f5`, `#f8f8f8`이 인라인으로 흩어져 있음. globals.css에 추가 토큰 등록 권장.
6. **녹색·분홍 명도 단계 토큰화**: `#065f46`/`#10b981`/`#34d399`/`#6ee7b7`, `#ff3385`/`#ff66a3`/`#ff99c1`도 토큰으로 빼면 일관성 강화.
7. **페이지 로컬 컴포넌트 정의 패턴**: `details/page.tsx`처럼 페이지 파일 내부에 컴포넌트를 직접 정의하는 패턴이 있어, 동명의 공용 컴포넌트(`components/DynamicAnalysisSection.tsx`)와 혼동을 일으킴. 향후 동명 컴포넌트는 공용으로 통합하거나 명확히 다른 이름으로 리네임 권장.

### 8.10 차트 등장 애니메이션 — 통일 규약 (2026-05-18 6차 적용)

#### 원칙

- **배경(축, 그리드, 컨테이너)은 정지**. 데이터 요소만 애니메이션.
- **Line** — 좌→우로 천천히 그려짐 (Recharts 내장 clip reveal)
- **Bar** — 아래(x축 baseline)→위로 천천히 자라남 (Recharts 내장 grow)
- mount(첫 로드)와 토글(viewMode 전환) 모두 동일하게 재생

#### 표준 props

모든 `<Line>`·`<Bar>`·`<Area>`에 다음 두 props를 일관 적용 (Recharts 기본 활성화 + 통일된 속도):

```jsx
animationDuration={1500}
animationEasing="ease-out"
```

- `isAnimationActive`는 명시하지 않음 (기본값 `true` 활용)
- 이전에 `isAnimationActive={false}`로 꺼져 있던 차트(ChannelSales/DetailedSales/ProductSearch)도 모두 활성화로 통일

#### 토글 시 재생

`viewMode`(또는 동등한 상태)가 바뀔 때 차트가 다시 마운트되어 애니메이션을 재생해야 함. 차트 컨테이너의 한 단계 바깥 div에 `key`를 부여:

```jsx
<div key={`${viewMode}-${...추가상태}`}>
  <ResponsiveContainer width="100%" height={400}>
    <ComposedChart ...>
      <Line ... animationDuration={1500} animationEasing="ease-out" />
    </ComposedChart>
  </ResponsiveContainer>
</div>
```

key 구성에 포함할 상태는 차트마다 다름:
- `SalesChartNew`: `viewMode + channelFilter`
- `ChannelSalesChartNew`: `viewMode + timeUnit + selectedChannel`
- `DetailedSalesChartNew`: `viewMode + timeUnit + selectedGroup + selectedCategory + selectedSubCategory + selectedChannel + selectedAccount`
- `ProductSearchChart`: `viewMode + timeUnit + searchKeyword + selectedChannel + selectedAccount + selectedProducts`
- `ProductGroupChartNew`: `viewMode + selectedGroups`
- `DynamicAnalysisSection`: `mode + channel`
- `monthly-review/Chart1`: `month`
- `monthly-review/Chart2/Chart3`: `data[0].month + data.length`
- `details/page.tsx` 1차 차트: `mode`
- `details/page.tsx` 브랜드 비교: `typeLabel + comparisonData.length`

#### 금지

- 차트 컨테이너 전체를 opacity/translateY로 움직이는 방식 (배경이 함께 움직여 정책 위반)
- 차트마다 다른 duration/easing 사용
- 어떤 차트는 끄고(`isAnimationActive={false}`) 어떤 차트는 켜는 비대칭

#### 적용 범위 (10개 파일 + globals.css)

| 파일 | 변경 |
|------|------|
| `SalesChartNew.tsx` | Line 1개 |
| `ChannelSalesChartNew.tsx` | Line 2개 (false → true) |
| `DetailedSalesChartNew.tsx` | Line 2개 (false → true) |
| `ProductSearchChart.tsx` | Line 2개 (false → true) |
| `ProductGroupChartNew.tsx` | Line 1개 |
| `DynamicAnalysisSection.tsx` | Line 3개 |
| `monthly-review/Chart1Achievement.tsx` | Bar 1개 |
| `monthly-review/Chart2YoYTrend.tsx` | Line 2개 |
| `monthly-review/Chart3MainVsCoupang.tsx` | Line 2개 |
| `app/custom-dashboard/details/page.tsx` | Line 6개 (페이지 차트 2 + 브랜드비교 4) |
| `app/globals.css` | `chart-fade-in` keyframe·class 제거 (시행착오 결과물 정리) |

총 `<Line>`·`<Bar>` 22개에 동일 props 적용. 1:1 매칭으로 누락 없음 검증 완료.

### 8.11 차트 데이터 값 레이블 — 최신 시점만 표시 규약 (2026-05-19 적용)

#### 원칙

차트가 시계열 데이터를 표시할 때, 각 데이터 포인트 위에 값을 모두 찍으면 글자가 겹치고 시각적으로 지저분해짐. **마지막(가장 최근) 데이터 포인트 하나에만** 값 레이블을 표시.

- 의도: 트렌드는 선/막대 그래프의 형상으로 충분히 전달되며, 사용자가 가장 알고 싶어 하는 값은 "지금/최근" 값.
- 적용: `LabelList`의 `content` 콜백에서 `index === lastIndex`일 때만 `<text>` 반환, 그 외 `null`.

#### 표준 패턴

각 차트 파일의 `CustomLabel` 컴포넌트에 `lastIndex` prop 추가:

```jsx
const CustomLabel = (props: any) => {
    const { x, y, value, fill, formatter, index, lastIndex } = props;
    if (value === undefined || value === null) return null;
    if (typeof lastIndex === 'number' && index !== lastIndex) return null;
    return (
        <text x={x} y={y} dy={-10} fill={fill} fontSize={10} textAnchor="middle" fontWeight="bold">
            {formatter ? formatter(value) : value}
        </text>
    );
};
```

사용처:

```jsx
<LabelList
    dataKey="..."
    position="top"
    content={<CustomLabel fill="#000" formatter={formatMillions} lastIndex={chartData.length - 1} />}
/>
```

#### 인라인 label prop은 LabelList로 변환

기존 `<Line label={{ position: 'top', formatter: ..., style: ... }} />` 인라인 패턴은 `<LabelList content={(p) => ...}>` 자식 패턴으로 통일. content 콜백 내에서 `index !== lastIdx`일 때 `null` 반환.

#### 적용 범위

| 파일 | 변경 |
|------|------|
| `SalesChartNew.tsx` | 인라인 `label` → `LabelList content` 변환, lastIndex 적용 |
| `ChannelSalesChartNew.tsx` | CustomLabel에 lastIndex prop, LabelList 2곳 |
| `DetailedSalesChartNew.tsx` | CustomLabel에 lastIndex prop, LabelList 2곳 |
| `ProductSearchChart.tsx` | CustomLabel에 lastIndex prop, LabelList 2곳 |
| `ProductGroupChartNew.tsx` | 인라인 `label` → `LabelList content` 변환, lastIndex 적용 |
| `DynamicAnalysisSection.tsx` | CustomLabel에 lastIndex prop, LabelList 2곳 |
| `monthly-review/Chart1Achievement.tsx` | LabelList content 콜백, 실적(마지막)에만 표시 |
| `app/custom-dashboard/details/page.tsx` | CustomLabel에 lastIndex prop, LabelList 2곳 |

브랜드 비교 차트(`details/page.tsx`의 4 Line) 및 `monthly-review/Chart2`·`Chart3`은 원래 데이터 값 레이블이 없어서 변경 없음.

#### 예외

`Chart1Achievement`은 시계열이 아니라 사업계획 vs 실적 비교(막대 2개). 규약을 그대로 적용하여 마지막(=실적)에만 값을 표시. 의도와 부합 (사업계획은 막대 높이와 달성률 %로 확인 가능).

#### 8.11-A 보강 (2026-05-19 추가) — 모든 차트·모든 모드에서 노출

초기 적용 후 자가검증 결과, 일부 차트가 여전히 마지막 라벨을 가리고 있던 것이 확인됨. 원인:

1. **mode 조건으로 차단** — `SalesChartNew`는 `showLabel = viewMode !== 'sales' && viewMode !== 'daily'`로 매출액/일평균 모드에서 라벨 자체를 막고 있었음.
2. **day/daily 모드 조건으로 차단** — `ChannelSalesChartNew`·`DetailedSalesChartNew`·`ProductSearchChart`는 `{timeUnit === 'month' && ...}`, `DynamicAnalysisSection`과 `details/page.tsx` 첫 차트는 `{!isDaily && ...}`로 일 모드에서 라벨 제거.
3. **LabelList 자체가 없는 차트** — `details/page.tsx`의 브랜드 비교 4 Line, `monthly-review/Chart2YoYTrend`, `Chart3MainVsCoupang`.

전제: 이전 조건들은 "데이터 포인트가 N개 다 찍히면 dense" 우려로 차단했던 것. 마지막 1개만 표시하는 현재 규약에서는 더 이상 유효하지 않음.

**보강 사항:**

- 모든 mode/timeUnit/isDaily 조건 제거 — 어떤 보기에서도 마지막 데이터 포인트의 라벨이 표시되도록 통일.
- 라벨이 없던 3개 차트(브랜드 비교 4 Line, Chart2YoYTrend 2 Line, Chart3MainVsCoupang 2 Line)에 LabelList 추가.
- Chart2YoYTrend와 Chart3MainVsCoupang은 라인 2개가 가까이 위치할 수 있어, 1번째 라인은 `position="top"`, 2번째 라인은 `position="bottom"`으로 겹침 방지.

