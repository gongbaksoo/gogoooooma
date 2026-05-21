# 🎨 Sales Analysis Site - 디자인 문서

> **문서 역할 (Role)**: 이 파일은 **이 앱의 설계 문서**입니다 — 페이지 구조, 컴포넌트, 차트 팔레트(§8.x) 등 실제 적용 내용. PDCA의 design 단계 문서에 해당합니다. 디자인의 **외부 기준(브랜드 레퍼런스)**은 별도 파일 [`Design/29CM-brand-reference.md`](../Design/29CM-brand-reference.md)에 있습니다. 그 파일이 "기준", 이 파일이 "적용".

## 1. 전체 디자인 컨셉

> **변경 이력**: 2026-05-18 — 29CM(에디토리얼 셀렉트샵) 기반 모노톤 톤으로 전환. 현재 컨셉은 **§8 29CM 디자인 시스템** 참조. 아래 표/이하 섹션은 이전 디자인 시점의 기록.

| 항목 | 이전 (2026-05-15까지) | 현재 (2026-05-18 ~) |
|------|----------------------|----------------------|
| **테마** | 프리미엄 분석 대시보드 (블루+그라데이션) | 29CM 에디토리얼 모노톤 |
| **색상 기조** | 화이트/슬레이트 + 블루 액센트 | 순백/순흑 + `#c4c4c4` outline + `#ff0066` 세일레드 액센트 |
| **폰트** | 시스템 기본 (sans-serif) | Pretendard Variable (400/700/800) |
| **레이아웃** | 반응형, 모바일 카드뷰 / 데스크탑 테이블뷰 | 동일 (반응형 유지) |
| **레퍼런스** | — | `Design/29CM-brand-reference.md` (29CM omd 0.1) |

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

| 파트 | 제목 | 시리즈 | 색 매핑 | 데이터 소스 |
|------|------|--------|---------|------------|
| `all` (전체) | 이커머스 vs 오프라인 | 이커머스 / 오프라인 (2) | `#000000` / `#5d5d5d` | `파트구분` 컬럼 |
| `ecommerce` | 주력채널 vs 쿠팡(사입) | 주력채널 / 쿠팡(사입) (2) | `#000000` / `#ff0066` | `주력 채널` 컬럼 (`주력` / `주력(쿠팡)`) |
| `offline` | 이마트 vs 롯데마트 vs 다이소 | 이마트 / 롯데마트 / 다이소 (3) | `#000000` / `#5d5d5d` / `#7d7d7d` | **R열 `거래처명`** (== `'이마트'` / `'롯데마트'` / `'다이소'`) |

**색 위계 차이**:
- `all` 모드: 두 파트의 카테고리 비교라 모노톤 2단계 (검정+회색).
- `ecommerce` 모드: 채널 내 쿠팡을 단일 강조 대상으로 보고 `#ff0066` 액센트 적용 (PPT 원본 의도 유지).
- `offline` 모드: 3개 거래처 비교라 모노톤 3단계 (§8.5 모노 4단계 중 상위 3개). 강조 단일색 없음.

**거래처 식별 영구 규약**: 거래처 단위 집계는 항상 **R열(`거래처명`, 0-indexed 17)** 기준 — C열(`거래처`)이 아님. (2026-05-19 사용자 합의)

**API 응답 구조** (N-series 가변 길이):
```json
"chart3": {
  "title": "이마트 vs 롯데마트 vs 다이소",
  "series_names": ["이마트", "롯데마트", "다이소"],
  "colors": ["#000000", "#5d5d5d", "#7d7d7d"],
  "data": [{"month": "2025-12", "values": [20100000, 6600000, 34400000]}, ...]
}
```

이전 array `[{month, main_channels, coupang_purchase}]` 구조와 2-series 고정 `{value1, value2}` 구조 모두 폐기. 프론트엔드는 `series_names.length`만큼 `<Line>` 동적 렌더.

**라벨 배치 (3-series 겹침 회피)**: 첫 시리즈(메인 검정)는 라인 `top`/`bold`, 나머지는 `bottom`/`normal` (Chart3 컴포넌트 내장 로직).

#### 2.3.3.3 Phase 2 종합 차트 (Chart 4~9, 2026-05-19 추가)

`종합` 섹션 아래에 `브랜드 종합` (chart 4·5·6) / `채널 종합` (chart 7·8·9) 2 섹션 추가. 각 섹션 3-column grid + 상단 헤더 `border-b border-[#c4c4c4]`.

| Chart | 종류 | 시리즈/카테고리 | X축 | 컬러 매핑 |
|-------|------|-----------------|-----|-----------|
| 4. 브랜드별 매출 트렌드 | LineChart (5-series, 12개월) | 마이비 / 누비 / 쏭레브 / 에코보 / 기타 | `YY.MM` | 모노 4단계 + 회색 (`#000` `#5d5d5d` `#7d7d7d` `#9d9d9d` `#b8b8b8`) |
| 5. 브랜드별 매출 비중 | PieChart (12개월 합) | 동일 5 카테고리 | — | 동일 |
| 6. 브랜드 월평균 vs 당월 | Grouped BarChart | 카테고리: 마이비/누비/쏭레브/마+누+쏭, 시리즈: 월평균·당월 | 카테고리 | 월평균 `#5d5d5d`, 당월 `#000` |
| 7. 채널별 매출 트렌드 | LineChart (4-series, 12개월) | 사입 / 위탁 / 자사몰 / 기타 | `YY.MM` | `#000` `#5d5d5d` `#7d7d7d` `#b8b8b8` |
| 8. 채널별 매출 비중 | PieChart (12개월 합) | 동일 4 카테고리 | — | 동일 |
| 9. 채널 월평균 vs 당월 | Grouped BarChart | 4 채널 카테고리, 시리즈: 월평균·당월 | 카테고리 | 월평균 `#5d5d5d`, 당월 `#000` |

#### 2.3.3.4 PieChart 외부 라벨 규약 (Chart 5/8)
- 라벨: `{name} {pct}%` 형식, **fontSize 10px, fill `#5d5d5d`** (보조 텍스트 토큰)
- `labelLine={false}` — 리더선 없이 라벨이 슬라이스 외부에 자동 배치
- `<Legend>` 미사용 — 외부 라벨이 카테고리명+비율 모두 표시하므로 중복 제거
- `outerRadius={100}` — Legend 제거로 확보된 공간 활용 (기본 80에서 25% 확대)

#### 2.3.3.5 Tooltip 시리즈명 표시 규약 (9개 차트 통일)
- formatter 시그니처: `(v, name) => [\`${v.toLocaleString()} 백만\`, name]` — Recharts가 dataKey를 `name`으로 전달
- 예외 Chart 1 (BarChart with single dataKey `value`): `formatter={(v, _n, item) => [..., item.payload.name]}` — payload에서 카테고리명("사업계획"/"실적") 추출
- 예외 Chart 2: 기존 closure 패턴 유지 (전년 라벨에 비교 월 추가 표시)

#### 2.3.3.6 브랜드 상세 섹션 (BrandSection, 2026-05-19 도입)

PPT slides 4~10의 마이비/누비/쏭레브 브랜드별 상세 분석을 단일 재사용 컴포넌트로 구현.

**레이아웃** (브랜드당 1 섹션, 헤더 + 2 row):
- Row 1 (1 + 2-wide grid):
  - **종합 트렌드 카드** (1열): 단일 라인 12개월
  - **주요 상품 라인 카드** (2열 wide): 사용자 선택 multi-line + 우측 상단 `표시 상품 수정 ▾` 버튼
- Row 2+ (3-col grid):
  - **개별 상품 카드들** (각 1열): 카드당 단일 상품 라인 차트 + `×` 제거 버튼
  - 마지막 슬롯: `+ 상품 추가` 카드 (dashed border, hover 시 highlight)

**상호작용**:
- `표시 상품 수정 ▾` → 모달 (해당 브랜드 S열 옵션 체크박스, 검색 가능)
- `+ 상품 추가` → 같은 모달 (단, 이미 추가된 항목은 옵션에서 제외)
- 카드 `×` → 즉시 individual 리스트에서 제거 + localStorage 저장
- 모든 selection 변경은 즉시 localStorage 저장 (적용 클릭 시)

**파일 구조**:
| 파일 | 역할 |
|---|---|
| `BrandSection.tsx` | 1 브랜드 = 종합 + 주요 + 개별 통합 |
| `ProductSelectionModal.tsx` | 모달 (검색 + 체크박스 리스트 + row 수 표기) |
| `brandSelectionStorage.ts` | localStorage CRUD + 기본값 + Brand 타입 |

**localStorage 규약** (2026-05-19 17회차 — 파트별 독립 저장으로 확장):
- 키: `avk_monthly_review_brand_selections`
- 구조 (v2): `{ all: BrandSelections, ecommerce: BrandSelections, offline: BrandSelections }`
  - 각 `BrandSelections = { 마이비: { mainLine: string[], individual: string[] }, 누비: {...}, 쏭레브: {...} }`
- 기본값: PPT 언급 상품 (마이비 5/누비 3/쏭레브 4) — 3 파트 모두 동일 default
- **마이그레이션**: 기존 v1 구조(`{마이비, 누비, 쏭레브}` 최상위) 감지 시 3 파트(`all/ecommerce/offline`)에 그대로 복사 후 v2로 재저장 → 다음 로드부터 마이그레이션 안 탐
- 마이그레이션 판별: 최상위 키에 `all/ecommerce/offline`가 없고 브랜드 키만 있으면 v1
- 의도: 이커머스/오프라인 탭에서 브랜드 상품 옵션 풀이 달라지므로 (백엔드가 `part` 파라미터로 필터링) 파트별 독립 selection이 의미 있음. ChannelSection의 part-scoped 패턴(§2.3.3.8)과 통일.
- 알려진 제약: 전체 탭 selection이 이커머스/오프라인 옵션 풀에 없으면 빈 selection으로 보일 수 있음 (§24 동일 패턴) — 해당 파트 탭에서 재선택 필요

**색 매핑**:
- 종합/개별 단일 라인: `#000000`
- 주요 상품 multi-line: 모노 7단계 팔레트 (`#000`, `#5d5d5d`, `#7d7d7d`, `#9d9d9d`, `#b8b8b8`, `#c4c4c4`, `#d0d0d0`) — 첫 시리즈만 2px, 나머지 1.5px

#### 2.3.3.8 채널 종합 섹션 (ChannelSection, 2026-05-19 14회차 동적화)

PPT slide 14의 채널 유형 분석을 단일 재사용 컴포넌트로 구현. 정적 chart 7/8/9 → ChannelSection 1개로 통합.

**구조 (1 컴포넌트, 3 차트 통합)**:
- 헤더: 좌 "채널 종합" + 우측 상단 `표시 채널 수정 ▾` 버튼 (모달 트리거)
- 3-column grid:
  - 트렌드 (multi-line, 선택된 채널들, 12개월)
  - 비중 (PieChart, 외부 라벨 `name pct%`, 12개월 합계)
  - 월평균 vs 당월 (Grouped Bar, 카테고리=선택된 채널들, 시리즈=월평균/당월)

**파트별 동적 옵션** (모달 옵션 풀):
| 파트 | 옵션 풀 (P열 unique values) | 기본 선택 |
|------|------------------------------|-----------|
| `all` | 전체 df의 P열 (16개) | 오픈마켓(사입) / 오픈마켓(위탁) / 자사몰 / 할인점 |
| `ecommerce` | 이커머스 파트 row의 P열 (10개) | 오픈마켓(사입) / 오픈마켓(위탁) / 종합몰 / 버티컬커머스 / 자사몰 |
| `offline` | 오프라인 파트 row의 P열 (5개) | 할인점 / 다이소 / 오프라인 대리점 |

**디자인 일관성**: 이커머스 모드도 P열 unique values로 통일 (이전 4 그룹 카테고리 폐기). 3 파트 동일 패턴이라 UX·코드 단순화. PPT의 "위탁=오픈마켓위탁+종합몰+버티컬"은 default 선택에 3개 P열을 모두 포함시켜 의미 유지.

**파일 구조**:
| 파일 | 역할 |
|---|---|
| `ChannelSection.tsx` | 트렌드/파이/막대 3 차트 + 모달 트리거 통합 |
| `channelSelectionStorage.ts` | localStorage CRUD + 기본값 + Part 타입 |
| (재사용) `ProductSelectionModal.tsx` | 동일 모달 컴포넌트 사용 (option 풀만 다름) |

**localStorage 규약**:
- 키: `avk_monthly_review_channel_selections`
- 구조: `{ all: string[], ecommerce: string[], offline: string[] }`
- 마이그레이션: 옛 selection 값이 새 옵션 풀에 없으면 자동 무시 (filter 단계). 결과적으로 빈 selection이면 "표시할 채널을 선택해주세요" 안내.

**색 매핑**: 모노 8단계 팔레트 (`#000`, `#5d5d5d`, `#7d7d7d`, `#9d9d9d`, `#b8b8b8`, `#c4c4c4`, `#d0d0d0`, `#dcdcdc`) 순서대로 적용. 첫 시리즈 2px / 나머지 1.5px.

**API 응답 구조 (백엔드)**:
```json
"channel_options": {
  "all":       [{"name": "오픈마켓(사입)", "row_count": 5289, "values": [...12], "monthly_avg": 249100000, "current_month": 270500000}, ...],
  "ecommerce": [...],
  "offline":   [...]
},
"channel_defaults": { "all": [...], "ecommerce": [...], "offline": [...] },
"channel_months":   ["2025-01", ..., "2025-12"]
```

이전 chart7/8/9 응답 키는 폐기. 프론트는 채널 + 12개월 데이터를 한 번에 받아 selection 변경 시 즉시 동기 렌더.

#### 2.3.3.9 Sticky 컴팩트 바 (2026-05-19 16회차 도입)

긴 보고서 스크롤 중 빈번하게 조작하는 컨트롤만 상단 고정.

**노출 조건**:
- IntersectionObserver로 원본 컨트롤 영역(`controlsRef`)의 화면 가시성 감지
- 원본이 화면 밖으로 나가는 순간 `stickyVisible=true` → `opacity` 200ms transition으로 fade-in
- 페이지 상단(원본이 보이는 동안)은 sticky 안 보이므로 UI 중복 없음 (B안 + 스크롤 트리거)

**포지셔닝**:
- `fixed top-0 left-0 right-0 z-40`
- 흰 배경 + 하단 `border-b border-[#c4c4c4]` + 미세 `shadow-sm`
- 내부 컨테이너 `max-w-6xl mx-auto px-5 md:px-10 py-2`

**구성 요소 (좌→우)**:
1. **네비 그룹**: `← 뒤로` 링크 + **월 리뷰** 타이틀 (우측 `border-r` 구분선)
2. **대상 월** dropdown (원본과 동일 state `month` 공유)
3. **파트** 토글 (전체/이커머스/오프라인, 원본과 동일 state `part` 공유)
4. **우측**: `차트 표시` 버튼 + **PDF 다운로드** 버튼 (검은 배경 강조)

**원본 컨트롤과 관계**:
- 동일 React state를 참조 → 어느 쪽에서 변경하든 즉시 동기화
- 매출 파일/목표 파일은 sticky에 미포함 (한 번 선택 후 자주 변경되지 않는 입력)

**PDF 출력 영향 없음**:
- `html2canvas`는 `chartGridRef` 영역만 캡처. sticky 바는 `fixed` 포지셔닝으로 grid 바깥에 위치하여 PDF 결과물에 포함되지 않음.

#### 2.3.3.11 주요 채널 이슈 섹션 (ChannelIssueSection, 2026-05-20 19회차 신설)

PPT slide 3 "매출 리뷰 - 주요채널 이슈"를 채널 그룹 단위 동적 컴포넌트로 구현. **3 컬럼 × 2 row = 6 차트** 기본 구성, 사용자가 그룹 수·이름·소속 채널 모두 편집 가능.

**구조 (N그룹 × 2 차트)**:
- 헤더: 좌 "주요 채널 이슈" + 우측 상단 `그룹 설정 ▾` 버튼 (모달 트리거)
- N-column grid (그룹 수에 따라 동적 — 1/2/3+):
  - 각 컬럼 = 사용자 정의 그룹 (예: 사입몰 / 위탁몰 / 자사몰)
  - 그룹 라벨 (`그룹 이름` text + 채널 미지정 경고)
  - **상단 차트** = 거래처별 매출 트렌드 (R열 거래처명, 그룹 내 채널 필터 집계)
  - **하단 차트** = 브랜드별 매출 트렌드 (D열 `품목그룹1`, 그룹 내 채널 필터 집계)
- 각 차트는 자체 `표시 거래처/브랜드 수정 ▾` 버튼 → ProductSelectionModal 재사용

**그룹 정의 (사용자 편집)**:
- `그룹 설정 ▾` → `GroupConfigModal` (신규)
- 테이블 매트릭스: 행 = 그룹, 열 = P열 채널구분 unique values, 셀 = 체크박스 (포함 여부)
- 기능: 그룹 이름 변경 / 추가(`+ 그룹 추가`) / 삭제(`×`) / 순서 변경(`↑↓`)
- **좌측(그룹 이름) / 우측(순서·삭제) 컬럼은 sticky** — 채널 18개 가로 스크롤 시 항상 보이게 (가독성 fix, error §27)

**기본 그룹 (3개, 모든 파트 공통)**:
| 그룹 이름 | 소속 채널 (P열) |
|---|---|
| 사입몰 | 오픈마켓(사입) |
| 위탁몰 | 오픈마켓(위탁) / 종합몰 / 버티컬커머스 |
| 자사몰 | 자사몰 |

**파트별 독립 저장**: ChannelSection·BrandSection 패턴 따라 `all/ecommerce/offline` 3 파트가 각각 별도 그룹 정의 + selection 보유. 파트 토글 시 즉시 전환.

**파일 구조**:
| 파일 | 역할 |
|---|---|
| `ChannelIssueSection.tsx` | N그룹 동적 grid + 그룹별 vendor·brand 집계 + 모달 트리거 |
| `GroupConfigModal.tsx` | 그룹 추가/삭제/이름변경/순서변경 + P열 매핑 매트릭스 |
| `channelIssueStorage.ts` | localStorage CRUD + PartScopedGroups + defaults |
| (재사용) `ProductSelectionModal.tsx` | 표시 거래처/브랜드 수정 모달 |

**localStorage 규약**:
- 키: `avk_monthly_review_channel_issue`
- 구조: `{ all: GroupDef[], ecommerce: GroupDef[], offline: GroupDef[] }`
- 각 `GroupDef = { id, name, channels: string[], vendorSelection: string[], brandSelection: string[] }`

**색 매핑**: 모노 8단계 팔레트 (ChannelSection과 동일). 첫 시리즈 2px / 나머지 1.5px.

**백엔드 응답 신규 필드** (`api/monthly_review.py`):
```json
"channel_issue": {
  "all": {
    "channels": [
      {
        "name": "오픈마켓(사입)",
        "row_count": 23048,
        "vendors": [{"name": "쿠팡(로켓)", "row_count": 22150, "values": [...12]}, ...],
        "brands":  [{"name": "마이비", "row_count": 5289, "values": [...12]}, ...]
      },
      ...
    ]
  },
  "ecommerce": {...},
  "offline": {...}
},
"channel_issue_months": ["2025-06", ..., "2026-05"]
```

프론트는 그룹 정의의 `channels[]`에 해당하는 channel을 모두 더해 vendor / brand 별로 합산해 차트 렌더링.

#### 2.3.3.12 차트 표시 모달 평면 구조 + 섹션 토글 통합 (2026-05-20 19회차)

기존 모달이 "종합·브랜드 종합" (chart 토글) vs "섹션 표시" (브랜드 상세/채널 종합/주요 채널 이슈) 2단 분리 구조였음. 사용자 피드백 ("토글이 목업과 다르다"): 평면 리스트로 재구성.

**신규 구조 (모달 내부, 위→아래)**:
```
☑ 종합           (섹션 토글, bold)
   ☑ 목표비 실적 (Chart 1)
   ☑ 전년비 트렌드 (Chart 2)
   ☑ 파트별 동적 비교 (Chart 3)
☑ 브랜드 종합   (섹션 토글, bold)
   ☑ 브랜드별 트렌드 (Chart 4)
   ☑ 브랜드별 비중 (Chart 5)
   ☑ 브랜드 월평균 vs 당월 (Chart 6)
☑ 브랜드 상세   (섹션 토글, bold)
☑ 채널 종합     (섹션 토글, bold)
☑ 주요 채널 이슈 (섹션 토글, bold)
```

**규약**:
- **5섹션 모두 section-level 체크박스** (bold, 동일 위계)
- 종합·브랜드 종합은 sub-chart 토글 들여쓰기 (ml-6)
- **섹션 토글 OFF 시 sub-chart 토글 자동 disabled** (시각적 disabled + click 비활성)
- `SectionId = "overview" | "brandOverview" | "brandDetail" | "channelOverview" | "channelIssue"`
- localStorage 키 그대로 (`avk_monthly_review_visible_charts`) — 키만 추가, 기존 chart1~6 유지

**page.tsx 영향**:
- `visibility.overview === false` → 종합 섹션 통째 숨김 (chart1/2/3 visibility 무시)
- `visibility.brandOverview === false` → 브랜드 종합 섹션 통째 숨김

#### 2.3.3.13 표시 항목 우선순위(순서) 설정 (2026-05-20 22회차)

차트에 표시하기로 체크한 항목들의 **표시 순서(우선순위)를 사용자가 직접 지정**. 순서는 트렌드 차트의 **선 색상 매핑·범례 순서**에 반영된다 (1번 항목 = 주 색상 #000000).

**적용 범위 (scope b — 모든 선택 모달)**:
- 브랜드 상세 `표시 상품 수정` (BrandSection, 주요 상품 라인)
- 채널 종합 `표시 채널 수정` (ChannelSection)
- 주요 채널 이슈 `표시 거래처/브랜드 수정` (ChannelIssueSection)
- 위 3곳 모두 공통 `ProductSelectionModal` 사용 → 모달 한 곳 수정으로 일괄 반영

**모달 UI (`ProductSelectionModal.tsx`)**:
- 내부 draft를 `Set<string>` → **순서 있는 `string[]`** 로 변경 (체크 = 맨 뒤 추가, 해제 = 제거 → 순서 보존)
- 상단 "표시 순서" 영역: 체크된 항목만 순번과 함께 나열
  - **▲▼ 버튼** (위/아래 1칸 이동, 첫/마지막 항목 자동 disabled) + **드래그(≡) 정렬** (HTML5 native drag-and-drop, 외부 라이브러리 없음)
- `적용` 시 사용자 순서 그대로 반환 — 기존의 `options.filter(...)`(row 수 기준 재정렬) 제거

**차트 렌더링 — 선택 순서 그대로**:
- `ChannelSection` / `ChannelIssueSection`: 기존 `options.filter(o => set.has(o.name))`(원본=row 수 순) → **`selected` 배열을 map**(`byName.get(name)`)으로 변경하여 사용자 순서 보존
- `BrandSection`: 기존부터 `selection.mainLine.map(...)`으로 이미 선택 순서 렌더 → 모달 수정만으로 자동 반영
- 채널 종합의 **비중 파이·월평균 막대**도 동일 `selectedOptions`를 공유 → 트렌드와 같은 순서로 묶임 (사용자 합의: "함께 같은 순서")

**recharts v3 Legend 정렬 끄기** (필수):
- recharts v3 `<Legend>`는 기본값 `itemSorter: 'value'` → 범례를 라벨 가나다순 자동 정렬 (선 색상은 맞아도 범례 텍스트만 어긋남)
- 트렌드 차트 3곳 Legend에 **`itemSorter={null}`** 적용 → 범례도 선택 순서대로
- ⚠️ `itemSorter={undefined}`는 React defaultProps(`'value'`)로 되돌아가 효과 없음 → 반드시 `null`. 타입도 `LegendItemSorter | null` 허용 (`docs/error.md §34` 참조)

**저장 구조**: 변경 없음. selection 배열(`string[]`)이 이미 순서를 보유하므로 localStorage 키/스키마·백엔드 응답 모두 그대로. 재정렬을 제거하고 순서를 "표시 우선순위"로 의미 부여한 것이 핵심.

#### 2.3.3.14 편집 모드 (보기 ↔ 편집 분리, 2026-05-20 23회차)

월 리뷰는 평소 **보기 전용(read-only)** 화면으로 두고, 편집 버튼은 **편집 모드를 켰을 때만** 노출. 보고서 열람 시 깔끔한 화면 + 의도치 않은 편집 방지.

**버튼 / 진입점**:
- 기존 `차트 표시` 버튼 → **`편집 모드`** 로 명칭 변경 (헤더 + sticky 바 2곳, 모달 제목도 변경)
- 클릭 → 기존 `ChartVisibilityModal` 모달이 열리고, 상단에 **"편집 모드 활성화" 스위치** 추가 (그 아래 기존 5섹션 show/hide 토글 유지)
- 스위치는 모달 draft 패턴 — `적용` 클릭 시 반영 (visibility 토글과 함께 저장/적용)
- 편집 모드 ON이면 `편집 모드` 버튼이 **검정 배경(active)** 으로 표시 → 현재 상태 시각 피드백

**숨김/노출 대상 (편집 모드 OFF→ON, scope = 모든 편집 버튼)**:
| 컴포넌트 | 편집 UI |
|---|---|
| `BrandSection` | `표시 상품 수정 ▾`, 개별 카드 `×` 제거, `+ 상품 추가` 카드 |
| `ChannelSection` | `표시 채널 수정 ▾` |
| `ChannelIssueSection` | `그룹 설정 ▾`, `표시 거래처/브랜드 수정 ▾` (MiniLineChart) |

**상태 관리**:
- `page.tsx`의 `editMode: boolean` state → 자식 컴포넌트(`BrandSection`/`ChannelSection`/`ChannelIssueSection`)에 prop으로 하향 전달, 각 편집 버튼을 `{editMode && (...)}`로 게이팅
- `ChartVisibilityModal`에 `editMode` + `onEditModeChange` prop 추가, 내부 `draftEditMode`로 관리 후 `handleApply`에서 `onEditModeChange(draftEditMode)` 호출
- **비영속 (transient)**: 새로고침 시 기본 **OFF** — "평소엔 숨김" 의도에 맞춤. localStorage 저장 안 함 (visibility는 저장, editMode는 미저장)

#### 2.3.3.15 주요 채널 이슈 — 표시 항목에 상·하위 레벨 동시 노출 (2026-05-20 24회차)

"표시 거래처/브랜드 수정" 모달에서 기존 한 레벨만 보이던 것을, **그룹핑 레벨 + 세부 레벨을 함께** 옵션으로 제공. 한 차트에 채널 합계 라인과 거래처 라인을 섞어 올리고 순서도 통합 정렬.

**컬럼 위계 (엑셀)**: `P열(채널구분)` = `R열(거래처명)`의 그룹 / `D열(품목그룹1)` = `S열(품목 구분)`의 그룹.

| 모달 | 묶음 (위) | 묶음 (아래) |
|---|---|---|
| 표시 거래처 수정 | **채널 (P열)** — 그룹 채널별 합계 라인 | 거래처 (R열) — 기존 |
| 표시 브랜드 수정 | **브랜드 (D열)** — 기존 | 상품 (S열) — 세부 |

> 거래처 모달은 상위(P)를 위에, 브랜드 모달은 상위(D)를 위에 — 양쪽 모두 **그룹핑(상위) 레벨을 위**로 통일.

**백엔드 (`_build_channel_issue`)**: 채널별로 `values`(채널 12개월 합계 → P열 라인용) + `products`(S열 `품목 구분` unique × 12개월) 추가. 기존 `vendors`(R열)/`brands`(D열) 유지.

**집계**:
- P열 옵션 = 그룹의 각 채널(채널 합계, 그룹 채널 순서 유지) — 가로 합산 없음
- R/D/S열 옵션 = 그룹 채널들을 가로질러 이름 기준 합산 (기존 `aggregate` 방식, row 수 내림차순)

**ProductSelectionModal 확장**:
- `ProductOption`에 `id`(선택 식별자, 미지정 시 name) + `group`(묶음 라벨) 추가
- 옵션 목록을 group별 헤더 + 구분선으로 분리 렌더. 단일 묶음(브랜드 상세·채널 종합)은 기존과 동일
- **선택 식별을 id 기준**으로 (같은 이름이 P/R 또는 D/S에 동시 존재 가능) — 표시 순서·체크·toggle 모두 id
- "표시 순서" 영역은 묶음 구분 없이 **한 통합 리스트** (요구사항: 섞어서 정렬)

**저장 (`channelIssueStorage`)**: `vendorSelection`/`brandSelection`에 **타입 태그 id** 저장 — `P:<채널>` / `R:<거래처>` / `D:<브랜드>` / `S:<품목구분>`. 기존 평문(접두 없는) 값은 로드 시 `vendorSelection→R:`, `brandSelection→D:`로 자동 마이그레이션 (`SEL_PREFIXES`, `tagSelection`).

**recharts 충돌 회피**: `<Line dataKey={id} name={표시이름} />` — dataKey는 고유 id(이름 충돌 방지), 범례·툴팁은 `name`(표시 이름). chartData row 키도 id.

**배포**: 백엔드 변경 포함 → Mac Mini 재배포 필요. 운영 백엔드 미반영 시 P열 `values`·S열 `products`가 없어 P열 라인=0/빈값·S열 옵션 없음으로 graceful degrade (프론트 optional 처리). `docs/error.md §22` 동시 배포 원칙.

**성능 규약 (24회차 후속, 2026-05-20)**:
- `_build_channel_issue`의 항목별 12개월 집계는 **`groupby([key, "월구분"]).sum().unstack()` 1회 + `reindex(last12).fillna(0)`** 패턴 필수. 항목·월마다 `df[df["월구분"]==월].sum()` 불리언 스캔 반복 **금지** (S열 107개 추가 시 요청당 ~7s로 회귀 → `docs/error.md §37`).
- 빈 이름 필터는 행 단위 문자열 처리(`astype(str).str.strip()`) 대신 `dropna(subset=[key])` + value_counts unique 값 단위로.
- **channel_issue는 요청 `part`만 빌드** (`channel_issue[part] = _build_channel_issue(df_part)`, 나머지 파트는 `{"channels": []}`). 프론트가 `summary.channel_issue?.[part]`만 사용하고 part 변경 시 재페치하므로 충분. 3파트 전부 빌드 금지.
- 측정 결과: all 7.3→2.4~3.0s / ecommerce 7.1→1.7s / offline 6.7→1.3s.

#### 2.3.3.16 주요 채널 이슈 — 부모 그룹핑 + 부모-자식 교차필터 (2026-05-21 26회차)

24회차의 "상·하위 동시 노출"을 **부모(그룹) 헤더 아래에 [부모 합계 + 자식 항목(가나다순)]을 통합**하는 구조로 재구성하고, **선택된 부모가 자식 라인을 동적으로 스코프**하도록 변경.

**모달 구조 (브랜드 차트 / 거래처 차트 동일)**

| 차트 | 그룹 헤더(부모) | 헤더 아래 |
|---|---|---|
| 표시 브랜드 수정 | 브랜드 (D열) | 그 브랜드 합계 라인(`D:<브랜드>`) + 그 브랜드 상품(S열) 가나다순 |
| 표시 거래처 수정 | 채널 (P열) | 그 채널 합계 라인(`P:<채널>`) + 그 채널 거래처(R열) 가나다순 |

- 브랜드 그룹 순서 = 브랜드 row 수 내림차순, 채널 그룹 순서 = 그룹의 채널 지정 순서.
- 자식은 **속한 모든 부모 그룹에 각각 표시** (체크박스는 id 1개로 동기화 → `ProductOption.groups[]`).
- 그룹별 row 수: 여러 부모에 걸친 자식(예: `대상 X`)은 **각 그룹 몫**으로 표시 (`ProductOption.rowCountByGroup`). 마이비 그룹의 `대상 X`=377(전체 2,048 아님).

**차트 표시 규칙 (교차필터)** — `MiniLineChart.selectedSeries`:
- 자식 라인 값 = 선택된 부모(같은 차트 prefix)에 따라 동적 합산
  - 부모 **미선택** → 자식의 **전체 부모 합산** (예: `물티슈` = 데일리케어 물티슈 + 라포레띠 물티슈)
  - 부모 **선택됨** → `(선택 부모 ∩ 자식 소속 부모)` 합산 (예: `라포레띠`+`물티슈` = 라포레띠 물티슈만)
  - 교집합 **없음** → 0 라인 (예: `마이비`+`물티슈`, 마이비엔 물티슈 없음)
- 부모 라인 값 = 그 부모 합계(`parentTotals`).

**핵심 데이터 모델**: 같은 이름이라도 소속 부모가 다르면 **다른 매출**. 데일리케어 물티슈 ≠ 라포레띠 물티슈 → 이름만으로 합산 금지.
- 백엔드 `_series_by_pair(cdf, "품목 구분", "품목그룹1")`: products를 `(품목그룹1, 품목 구분)` 2개 키로 묶고 각 항목에 `brand` 부착. 브랜드 NaN 행은 `(미분류)`로 보존. (거래처는 백엔드가 이미 채널별로 내려줌 → 변경 없음)
- 프론트 `buildChartModel`: 그룹 채널들을 가로질러 `parentTotals`(부모 12개월 합계) + `childByParent`(자식→부모→12개월 값) + `childRowByParent`(자식×부모 row 수) 구성. 같은 (자식,부모)는 채널 가로질러 합산(같은 항목이므로 정상).

**식별자 스킴 불변**: 자식 토큰은 여전히 이름 기준(`S:<품목구분>`, `R:<거래처>`) — 값만 선택에 따라 동적 스코프. 따라서 **저장 선택값 마이그레이션 불필요**(24회차 태그 스킴 그대로).

**배포**: 백엔드 변경 포함 → Mac Mini 재배포 필요(`brand` 필드). 운영 백엔드 미반영 시 브랜드 그룹이 `(undefined)`로 보일 수 있어 **프론트(Vercel)와 동반 배포** 필요. `docs/error.md §22`.

#### 2.3.3.17 종합/브랜드 종합 차트 편집 모드 + 헤더·높이 정리 (2026-05-21 27회차)

편집 모드를 **종합/브랜드 종합 영역의 3개 차트**로 확장하고(기존엔 브랜드 상세·채널 종합·주요 채널 이슈만), 헤더 문구와 카드 높이를 정리.

**편집 대상 차트 (백엔드 무변경 — payload에 이미 시리즈별 데이터 존재)**

| 차트 | 시리즈 | 선택 저장 | 편집 버튼 |
|---|---|---|---|
| 이커머스 vs 오프라인 (chart3) | 파트별 상이(전체: 이커머스/오프라인, 이커머스: 주력채널/쿠팡(사입), 오프라인: 이마트/롯데마트/다이소) | 파트별 독립 | 있음 |
| 브랜드별 매출 트렌드 (chart4) | 마이비/누비/쏭레브/에코보/기타 | chart4·chart5 **공유** | 있음 |
| 브랜드별 매출 비중 (chart5) | 〃 (동일 브랜드) | 〃 공유 | **없음** (트렌드 선택을 따라감) |

- **패턴 재사용**: `ProductSelectionModal`(체크 선택 + 표시 순서) + `getMultiSeriesStyle(i)`(§8.5 B-6 팔레트)로 선택 순서가 선 색·범례 순서·파이 색을 결정. 다른 편집 섹션과 완전 일관.
- **트렌드·비중 공유**: chart4에서 편집 → chart4(라인)·chart5(파이) 동시 반영. chart5는 자체 버튼·모달 없이 `selected` prop만 받아 렌더(파이 비율은 선택 시리즈 합계로 재계산).
- **chart3 파트 독립**: 파트마다 시리즈가 달라 파트별로 선택을 따로 저장.

**저장 모듈** `overviewSelectionStorage.ts` (키: `avk_monthly_review_overview_selections`)
- 구조: `{ chart3: Partial<Record<Part,string[]>>, brand: Partial<Record<Part,string[]>> }`
- 값 의미: 파트 키 **없음(undefined)** = 미편집 → 백엔드 시리즈 전체를 원래 순서대로 표시(기존 동작 유지) / **빈 배열([])** = 전부 해제 → 차트 비움(안내 문구) / **배열** = 선택 시리즈를 그 순서로.
- 식별자 = 시리즈명(브랜드명/채널명) 기준 → 마이그레이션 불필요.

**`ProductSelectionModal` 변경**: `row_count`를 옵셔널화 → 미지정 시 "n row" 표기 숨김(시리즈는 row 개념 없음). 기존 호출부(브랜드/채널/이슈) 영향 없음.

**헤더·높이 정리**
- 버튼 라벨 `표시 항목 수정 ▾` → **`수정 ▾`**(헤더 줄바꿈 방지, `whitespace-nowrap`).
- chart3 오프라인 제목 `이마트 vs 롯데마트 vs 다이소` → **`EM vs LM vs 다이소`**(백엔드, 범례는 원명 유지).
- `최근 12개월` 헤더 문구 제거: 전년비 트렌드(chart2)·이커머스 vs 오프라인(chart3)·브랜드별 매출 트렌드(chart4) → `단위: 백만`만.
- 브랜드별 매출 비중(chart5): 제목의 `(최근 12개월)` 제거(백엔드) + 우측 메타를 `월 평균 대비 실적`과 통일해 **`최근 12개월 (단위: 백만)`**.
- 목표비 실적(chart1) 차트 높이 `220→260→227`로 조정. 카드에 "달성률" footer(약 33px)가 있어 chart=260이면 카드가 옆 차트보다 33px 큼 → chart=**227**로 세 카드 외곽 높이를 **329px로 통일**(footer 유지, 막대 영역만 약간 짧음). `docs/error.md §41`.
- 목표비 실적(chart1) **양 막대 모두 값 레이블 표시**: 기존엔 `LabelList content`가 `index === 마지막`(실적)에만 렌더 → `index` 가드 제거로 사업계획·실적 둘 다 레이블 노출. chart1 단독 변경(다른 차트 무영향).

#### 2.3.3.18 종합 섹션 실적 요약 라인 (2026-05-21 27회차 후속)

"종합" 섹션 제목 바로 아래(밑줄과 차트 카드 사이)에 대상월 실적 한 줄 요약을 추가. **현재 선택 파트 기준**(summary가 파트별로 로드되므로 전체/이커머스/오프라인 전환 시 자동 갱신).

**표시 형식**
```
실적 : 241 백만 (목표비 41.0% , 전월비 ▼61.8% , 직전 3개월비 ▼59.3% , 전년비 ▼45.9%)
```

**지표 정의** (모두 기존 `chart1`+`chart2` payload로 프론트 계산 — 백엔드 무변경)

| 지표 | 계산 | 데이터 출처 |
|---|---|---|
| 실적 | 대상월 판매액 ÷ 1e6 (반올림, 백만) | `chart1.actual` |
| 목표비 | 실적/목표×100 (**비율**, 차트1 달성률과 동일) | `chart1.achievement_rate` |
| 전월비 | (대상월 − 직전월) / 직전월 ×100 (**증감률**) | `chart2[n-2].current_year` |
| 직전 3개월비 | (대상월 − 직전 3개월 평균) / 평균 ×100 (**증감률**) | `chart2[n-2..n-4].current_year` 평균 |
| 전년비 | (대상월 − 작년 동월) / 작년 동월 ×100 (**증감률**) | `chart2[n-1].prev_year` |

- `chart2`는 과거→최신 순서이며 마지막 원소(`n-1`)가 대상월. **직전 3개월 = 대상월 제외** 앞 3개월(예: 대상월 4월 → 1·2·3월 평균, 4월 자신은 평균에서 제외).
- **부호 표기**: 증감률 3종은 `+`/`-` 대신 **양수 `▲`, 음수 `▼`** + 절댓값%. 목표비는 비율이라 부호 없음.
- **방어**: 기준값이 `null` 또는 `≤0`이면 `-` 표시. 목표 미연결 시 목표비 `-`.
- 컴포넌트 `OverviewSummaryLine`(page.tsx 모듈 레벨), 렌더는 `section.title === "종합"`일 때만. **프론트 단독**(Mac Mini 재배포 불필요).

#### 2.3.3.19 종합 섹션 사용자 코멘트 (2026-05-21 27회차 후속)

종합 요약 라인 바로 아래에 사용자가 자유 입력하는 코멘트(메모) 영역. **편집 모드일 때만 입력 가능**, **대상 월 × 파트 조합별 독립 저장**.

**동작**

| 모드 | 내용 있음 | 내용 없음 |
|---|---|---|
| 보기 모드 | 텍스트만 표시(`whitespace-pre-wrap`로 줄바꿈 유지) | **아무것도 표시 안 함** |
| 편집 모드 | textarea에 저장값 + 수정 + `저장` 버튼 | 빈 textarea + `저장` 버튼 |

- **입력 형태**: 여러 줄 `textarea`(rows=3, resize-y).
- **저장 방식**: 자동 저장 아님 — `저장` 버튼 클릭 시에만 반영(변경 없으면 버튼 `disabled`). 미저장 상태로 월/파트 전환 시 초안은 버려지고 저장값으로 리셋.
- **저장 모듈** `overviewNotesStorage.ts` (키: `avk_monthly_review_overview_notes`)
  - 구조: `Record<"${month}|${part}", string>` (flat 키).
  - 빈 문자열 저장 = 키 삭제 → 보기 모드에서 아무것도 안 보임.
- 컴포넌트 `OverviewNote`(page.tsx 모듈 레벨). 로컬 초안(`draft`) 상태, `note`/`month`/`part` 변경 시 `useEffect`로 초안 리셋. 렌더는 `section.title === "종합"`일 때 요약 라인 다음. **프론트 단독**(재배포 불필요).

#### 2.3.3.20 종합 섹션 AI 매출 분석 (2026-05-21 28회차)

대상 월을 선택한 상태에서 "AI 분석" 버튼 → 모달 팝업이 떠서, **사용자가 미리 작성한 분석 가이드(프롬프트)**대로 Gemini가 그 달의 매출을 분석. **백엔드 변경 포함(엔드포인트 신규) → Mac Mini 재배포 필요** (`docs/error.md §22` 동시 배포 SOP).

**구성**
- 종합 섹션, 사용자 코멘트 아래에 `AI 분석` 버튼(1px `#c4c4c4` 아웃라인 ghost, **이모지 금지** — §6.1 디자인 규약). 클릭 시 모달 오픈.
- 모달(`AIAnalysisModal.tsx`):
  - **편집 모드**: 분석 가이드 `textarea`(rows=6) + `프롬프트 저장` 버튼. 미저장 변경(`dirty`) 시 분석 비활성 + "변경사항을 저장해야 분석에 반영" 안내.
  - **보기 모드**: 프롬프트 편집 영역 숨김(미작성 시 안내 문구). `분석하기` 버튼 + 결과(`whitespace-pre-wrap`).
  - 분석은 **백엔드에 저장된 프롬프트 기준**(편집 중 초안 아님).

**프롬프트 저장 (파트별, 백엔드 파일)**
- 파일 `api/analysis_prompts.json` → `{ "all": "...", "ecommerce": "...", "offline": "..." }`.
- `GET /monthly-review/analysis-prompt/?part=` → `{ part, prompt }`.
- `POST /monthly-review/analysis-prompt/` (body: `part`, `prompt`) → 저장.

**AI 분석 실행**
- `POST /monthly-review/ai-analysis/` (body: `month`, `part`, `summary`, `api_key`).
- 프론트가 **화면에 표시 중인 `summary`(종합+트렌드+채널이슈)를 그대로 전송** → 백엔드가 한국어 데이터 컨텍스트(`_build_analysis_context`: chart1 종합 / chart2 12개월 트렌드 / channel_issue[part] 채널·상위 거래처·브랜드)로 변환 → 저장된 파트 프롬프트와 합쳐 Gemini(`gemini-2.0-flash-exp`) 호출.
- 키: 기존 `load_server_api_key()` 패턴 재사용(env `GOOGLE_API_KEY` → `security_config.json`). 프론트는 `"server_managed"` 전송.
- 가드: 잘못된 파트 400, 키 미설정 400, 프롬프트 미작성 400.
- summary 재계산 없음(프론트 데이터 그대로) → "화면에 보이는 값을 그대로 분석".

#### 2.3.3.10 스크롤 위치 보존 규약 (2026-05-19 17회차)

파트 토글·월 변경 등 재페치 트리거 시 페이지 스크롤 위치가 맨 위로 리셋되지 않도록 차트 그리드를 **언마운트하지 않는** 패턴 적용.

**원칙**:
- 조건부 렌더는 `{summary && loading && (...)}` 처럼 loading을 차트 그리드 가시성에 결합하지 않을 것
- 차트 그리드의 마운트 조건은 **데이터 존재 여부(`summary`)** 만으로 결정

**구현 패턴** (`page.tsx`):
```tsx
{salesFile && !summary && loading && <div>불러오는 중...</div>}  // 초기 로드만
{summary && (() => { /* 차트 그리드 — loading=true여도 그대로 유지 */ })()}
```

**효과**:
- 파트 클릭 → `loading=true`로 전환되지만 기존 `summary`는 유지 → 차트 그리드 mount 유지
- fetch 완료 → `summary` 갱신 → Recharts가 부드럽게 재렌더 (§8.10 애니메이션 적용)
- 페이지 높이 변동 없음 → 브라우저 스크롤 위치 그대로

**금지**: 데이터 새로고침 도중 `{summary && !loading}` 같은 조건으로 차트 그리드 자체를 unmount하는 패턴 (페이지 높이 급감 → 스크롤 리셋, `docs/error.md §25` 참조)

#### 2.3.3.7 HTML 목업 SOP (2026-05-19 도입)

복잡한 UI 변경(레이아웃 전체 재구성, 신규 인터랙션 도입 등) 전 **HTML 목업 → 사용자 피드백 → 구현** 워크플로우 도입.

- 위치: `docs/mockups/<feature>-mockup.html` — 단일 파일, 정적, 브라우저로 직접 열기
- 포함: 레이아웃, 인터랙션 표현(버튼/모달 시각화), 색·간격 토큰, 상호작용 메모 (placeholder 차트는 SVG 미니 라인)
- 효과: 코드 작성 후 의도 어긋남 ↓, rework 1라운드 절약. 본 §2.3.3.6 구현 전 검증 (참조: `docs/mockups/brand-detail-mockup.html`).

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

레퍼런스: `Design/29CM-brand-reference.md` (29CM omd 0.1, 2026-05-15 검증)

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

> **변경 이력 (2026-05-20 후속, 21회차)**: 위 표의 `strokeWidth`/`dot r`/`activeDot r` 값은 §8.14의 **점·선 크기 통일 규약으로 대체됨** — 전 차트 공통 `strokeWidth 2`, `dot r 1.5`, `activeDot r 3.5`. 메인 위계 강조(sw 2.5, dot r 4)는 폐지. 색·명도·실/점 패턴 매핑만 본 표 유지.

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

### 8.12 일간 모드 X축 라벨 — 월별 1일만 표시 (2026-05-19 적용)

#### 배경

이전 일간 모드 X축은 모든 날짜를 `MM.DD` 형식으로 표시 → 17개월(약 500일) 기간 조회 시 라벨이 모두 중첩되어 가로축이 검게 보이는 가독성 문제.

#### 규약

일간 모드(`timeUnit === 'day'` 또는 `isDaily`)에서는 **각 월의 1일에만** X축 라벨을 표시. 나머지 날짜는 빈 문자열 반환하여 tick은 유지하되 글자만 숨김.

#### 표기 포맷

```
"25/1", "25/2", ... "25/12", "26/1", ... "26/5"
```

- 형식: `YY/M` (월은 leading-zero 없음)
- 17개월 조회 시 총 17개 라벨만 표시.

#### 표준 패턴

```javascript
if (timeUnit === 'day') {
    if (!value) return value;
    const [yyyy, mm, dd] = value.split('-');
    if (dd !== '01') return '';
    return `${yyyy.slice(2)}/${parseInt(mm)}`;
}
```

#### 적용 범위 (5개 파일)

| 파일 | 위치 |
|------|------|
| `ChannelSalesChartNew.tsx` | `formatXAxisTick` 함수 (일간 분기) |
| `DetailedSalesChartNew.tsx` | `formatXAxisTick` 함수 (일간 분기) |
| `ProductSearchChart.tsx` | `formatXAxisTick` 함수 (일간 분기) |
| `DynamicAnalysisSection.tsx` | 인라인 `tickFormatter` (isDaily 분기) |
| `app/custom-dashboard/details/page.tsx` | `formatXAxisTick` (10자 분기) + 페이지 로컬 인라인 `tickFormatter` |

월간 모드(`timeUnit === 'month'`/`!isDaily`)의 X축 라벨 로직은 기존 그대로 유지 (1월에만 연도 표시 `"25'1"` 형식).


### 8.13 타이포그래피 단일 패밀리 강제 — `font-mono` 사용 금지 (2026-05-19 적용)

#### 배경

§8.2 타이포그래피 규약은 "**단일 패밀리: Pretendard Variable**"을 명시하고 있으나, 일부 화면에서 ID/코드 컬럼 또는 디버그/콘솔 출력에 Tailwind `font-mono` 클래스가 잔존하여 등폭 글꼴이 혼용됨. ProductSearchChart 검색 결과 테이블의 품목코드 셀에서 사용자가 시각 불일치를 지적 (스크린샷).

#### 규약

- **전체 UI에서 `font-mono`(또는 등가의 monospace family) 사용 금지.**
- ID/코드 컬럼은 정렬이 필요하면 셀 `text-align` + 고정폭 컨테이너로 해결. 글꼴은 Pretendard 유지.
- 콘솔 로그·디버그 패널도 예외 없음 (이전엔 "터미널 느낌"이 의도라고 판단했으나, 디자인 시스템 단일 패밀리 원칙 우선).

#### 적용 (4개 파일, 4개소 모두 제거)

| 파일 | 위치 | 이전 컨텍스트 |
|------|------|---------------|
| `components/ProductSearchChart.tsx:675` | 품목코드 셀 | 검색 결과 테이블 |
| `app/coupang-orders/page.tsx:165` | 주문 ID 셀 | 쿠팡 주문 목록 |
| `app/custom-dashboard/page.tsx:250` | 로그 출력 컨테이너 | 검정 배경 콘솔 (배경/색은 유지) |
| `components/SalesChartNew.tsx:503` | 디버그 `<details>` | 개발 환경 전용 |

#### 검증

```bash
grep -rn "font-mono" frontend/src --include="*.tsx" --include="*.ts"
# → 잔여 없음
```

#### 관련 항목

- §8.2 타이포그래피 단일 패밀리 규약 (원 규약)
- error.md §25 (디자인 시스템 드리프트 회고)


### 8.14 다중 시리즈 차트 팔레트 — B-6 (검정/네이비/베이지/회색) 14 슬롯 (2026-05-20 도입)

#### 배경

§8.5 v4(2026-05-18 도입)의 "데이터 종류별 4단계 명도 × 실선/점선 = 8-pattern"은 매출/일평균 다중 시리즈 차트에서 인접 명도(`#7d7d7d`~`#b8b8b8`) 차이가 모니터 환경에 따라 시각적으로 작아 보이는 가독성 문제 발생. 사용자 지적: "그래프의 색이 너무 구분안가긴 하는데" (2026-05-19).

해결책으로 `docs/mockups/chart-palette-{a,b,c,b1,b2,b3,b4,b5,b6}.html` 9가지 안을 mockup으로 비교 → **B-6 (검정/네이비/베이지/회색 4 hue × 실/점)** 채택.

#### 규약

다중 시리즈(시리즈 ≥ 4개) 차트에서 시리즈 순서 i번째에 다음 슬롯을 매핑.

| 슬롯 | 색 | 패턴 | hex |
|------|-----|------|-----|
| 1 | 검정 진 | 실선 | `#000000` |
| 2 | 네이비 진 | 실선 | `#475d78` |
| 3 | 베이지 진 | 실선 | `#a08e7a` |
| 4 | 회색 | 실선 | `#9d9d9d` |
| 5 | 검정 진 | 점선 | `#000000` |
| 6 | 네이비 진 | 점선 | `#475d78` |
| 7 | 베이지 진 | 점선 | `#a08e7a` |
| 8 | 회색 | 점선 | `#9d9d9d` |
| 9 | 검정 연 | 실선 | `#3d3d3d` |
| 10 | 네이비 연 | 실선 | `#7d92b0` |
| 11 | 베이지 연 | 실선 | `#c4b5a0` |
| 12 | 검정 연 | 점선 | `#3d3d3d` |
| 13 | 네이비 연 | 점선 | `#7d92b0` |
| 14 | 베이지 연 | 점선 | `#c4b5a0` |

회색은 더 연한 단계 추가 시 인접 옅음(`#c4c4c4`)과 식별 약화되어 9~14에서 제외. 14 슬롯 초과 시 마지막 슬롯 반복(권장은 차트 분할 또는 호버 강조).

#### 의미색 보존

§8.5 v4의 데이터 종류 매핑은 다음 케이스에 한해 유지:

- **이익률** (`profit_only`, `profitRate` viewMode): `#ff0066`/`#ff3385`/`#ff66a3`/`#ff99c1` 분홍 4단계 (단일 데이터 종류, 4-step × dashed 8-pattern)
- **증감률** (`growth` viewMode): `#065f46`/`#10b981`/`#34d399`/`#6ee7b7` 녹색 4단계 (단일 데이터 종류, 29CM 모노 예외 1개 — 의미 분기 위해 유지)

B-6은 **다중 시리즈 매출/일평균 차트**에만 적용. 이익률/증감률 색조와 분홍 슬롯이 충돌하지 않도록 B-6 2번 슬롯을 네이비로 설정.

#### 구현

`frontend/src/lib/chartPalette.ts` 단일 유틸로 통합:

```typescript
export function getMultiSeriesStyle(i: number): SeriesStyle;
export function getDataTypeSeriesStyle(i: number, key: 'profitRate' | 'growth'): SeriesStyle;
```

각 차트 컴포넌트는 import 후 시리즈 매핑 시 `getMultiSeriesStyle(i)` 호출. 반환값에 `stroke`, `strokeDasharray`, `strokeWidth`, `dotR`, `activeR` 포함.

#### 적용 범위 (5개 컴포넌트)

| 파일 | 적용 viewMode/모드 |
|------|-----------------|
| `components/monthly-review/BrandSection.tsx` | 다중 시리즈 (브랜드별 주요 상품 라인) |
| `components/monthly-review/ChannelSection.tsx` | 다중 시리즈 (채널 종합) |
| `components/monthly-review/ChannelIssueSection.tsx` | 다중 시리즈 (채널 이슈) |
| `components/ProductGroupChartNew.tsx` | sales / daily (profitRate/growth는 §8.5 v4 유지) |
| `components/DynamicAnalysisSection.tsx` | sales/daily/avg (profit_only는 §8.5 v4 유지) |
| `app/custom-dashboard/details/page.tsx` | 주력채널 브랜드 비교 차트 (4 hue 직접 인라인) |

#### 점·선 크기 통일 규약 (2026-05-20 후속, 21회차)

전 차트 공통으로 점(dot)·선(strokeWidth) 크기를 통일. 사용자 지적: "표식(동그란 점)이 너무 크고, 선마다 원 크기가 서로 다르다" → 작게·일정하게, 선두께는 메인선 강조 없이 통일.

| 속성 | 통일 값 | 비고 |
|------|---------|------|
| `dot` r | **1.5** | 메인/보조 구분 없이 동일. daily/일별 보기는 점 숨김(`dot={false}`) 동작 유지 |
| `activeDot` r (hover) | **3.5** | |
| `strokeWidth` | **2** | 메인선 강조 폐지. 기존 2~2.5와 1차 시도값 1.5의 중간 |

- 팔레트 기반 차트는 `chartPalette.ts`의 `getMultiSeriesStyle`/`getDataTypeSeriesStyle` 반환값 한 곳에서 통일(`strokeWidth 2`, `dotR 1.5`, `activeR 3.5`).
- 팔레트를 쓰지 않는 하드코딩 차트(아래 "전 차트 적용 범위")도 동일 값으로 일괄 치환.
- SVG 검색 아이콘의 `strokeWidth="2.5"`(`<path>`)는 차트 선이 아니므로 미변경.

#### 전 차트 적용 범위 (점·선 크기 통일, 13개 컴포넌트)

| 파일 | 비고 |
|------|------|
| `components/monthly-review/BrandSection.tsx` | 종합·주요라인·개별 |
| `components/monthly-review/ChannelSection.tsx` | |
| `components/monthly-review/ChannelIssueSection.tsx` | |
| `components/monthly-review/Chart2YoYTrend.tsx` | |
| `components/monthly-review/Chart3MainVsCoupang.tsx` | |
| `components/monthly-review/Chart4BrandTrend.tsx` | |
| `components/ProductGroupChartNew.tsx` | 팔레트 기반 |
| `components/SalesChartNew.tsx` | 팔레트 기반 |
| `components/DynamicAnalysisSection.tsx` | 팔레트 + 하드코딩 라인 |
| `components/ChannelSalesChartNew.tsx` | 하드코딩 + daily 분기 |
| `components/DetailedSalesChartNew.tsx` | 하드코딩 + daily 분기 |
| `components/ProductSearchChart.tsx` | 하드코딩 + daily 분기 |
| `app/custom-dashboard/details/page.tsx` | 주력채널 브랜드 비교 (인라인) |

#### 호버 툴팁 폰트 크기 통일 (2026-05-20 후속, 21회차)

전 차트 Recharts `<Tooltip>`의 텍스트 크기를 **컨트롤 버튼(`text-xs` = 12px)과 동일하게 통일**. 사용자 지적: 큰 차트 툴팁이 너무 큼 → 버튼 텍스트 크기만큼 축소.

- 큰 차트 8개 툴팁은 `contentStyle`에 `fontSize`가 없어 브라우저 기본값(~14px+)으로 크게 렌더 → `fontSize: 12` 추가.
  (ProductGroupChartNew, SalesChartNew, DetailedSalesChartNew, ChannelSalesChartNew, ProductSearchChart, DynamicAnalysisSection, custom-dashboard/details ×2)
- monthly-review 중 `fontSize: 11`이던 2개(BrandSection 개별, ChannelIssueSection)는 12로 통일.
- 결과: 차트 툴팁 contentStyle 16개 전부 `fontSize: 12`.
- **축 라벨(XAxis/YAxis tick)·범례(Legend)의 11px는 툴팁이 아니므로 미변경.**

#### 범례 실선/점선 구분 — `iconType="plainline"` (2026-05-20 후속, 25회차)

다중 시리즈에서 같은 색이 실선/점선으로 재사용되는데(예: 슬롯 1 검정 실선 vs 슬롯 5 검정 점선), recharts **기본 범례 아이콘(`iconType` 미지정 → `'line'`)은 strokeDasharray를 무시**하고 곡선 아이콘만 그려서 두 시리즈가 범례에서 **동일하게(검정 실선처럼) 보임**. 사용자 지적: "범례에서 마이비(실선)와 얼룩제거제(점선)가 같아 보인다".

**규약**: 팔레트(`getMultiSeriesStyle`/`getDataTypeSeriesStyle`)를 쓰는 차트의 `<Legend>`에 **`iconType="plainline"`** 적용.
- `plainline`은 `<line>` + `strokeDasharray`(payload)로 그려져 **범례에서도 실선/점선이 구분**됨 (recharts `DefaultLegendContent` 확인).
- **차트 선 패턴(dasharray)은 기존 `4 4` 그대로 유지** — 선 자체를 더 잘게 쪼개지 않음. 구분 강화는 "범례 아이콘이 패턴을 반영"하는 것으로 충분 (사용자 요구: `docs/error.md §38`).
- 적용 6개: BrandSection / ChannelSection / ChannelIssueSection / DynamicAnalysisSection / ProductGroupChartNew / SalesChartNew.

#### 관련 항목

- §8.5 차트 팔레트 v4 (데이터 종류 기반, 이익률/증감률 의미색 정의)
- 목업 비교 자료: `docs/mockups/chart-palette-*.html` (9개 안)



