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
- CSV/XLSX 파일 업로드 UI
- 업로드된 파일 목록 표시
- 파일 클릭 → 대시보드로 이동

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

### 8.5 차트 팔레트 (Recharts)

- Grid: `#f0f0f0`
- Axis stroke: `#5d5d5d`
- 이익률 우측 Y축 / 이익률 라인 (점선): `#ff0066`
- Tooltip border: `#c4c4c4`, radius: 2px
- 시리즈 1순위: `#000000`
- 시리즈 2순위: `#5d5d5d`
- 시리즈 3~9순위: 흑백 단계 (`#3d3d3d`, `#7d7d7d`, `#9d9d9d`, `#b8b8b8`, `#c4c4c4`, `#d0d0d0`, `#dcdcdc`)
- 강조 시리즈 (합계/총매출/이익률/쿠팡 등 단일 강조 대상): `#ff0066`

#### 다시리즈 차트 컨텍스트별 매핑 (DynamicAnalysisSection 기준)

| 모드 | 시리즈 수 | 매핑 |
|------|----------|------|
| 전체 통합 (`total`) | 5 | 전체=`#000`, 이커머스=`#5d5d5d`, 오프라인=`#7d7d7d`, 쿠팡(강조)=`#ff0066`, 주력채널=`#b8b8b8` |
| 이커머스 (`ecommerce`) | 3 | 이커머스(메인)=`#000`, 쿠팡(강조)=`#ff0066`, 주력채널=`#5d5d5d` |
| 오프라인 (`offline`) | 1 | 오프라인=`#000` |
| Combined 모드 (월매출+이익률 등) | 2 | 판매액=`#000`(실선), 이익률=`#ff0066`(점선, 우축) |
| 브랜드 비교 (details 페이지) | 4 | 전체=`#000`, 마이비=`#5d5d5d`, 누비=`#c4c4c4`, 쏭레브(강조)=`#ff0066` |

- **한계**: 5개 이상 시리즈 동시 표시 시 색 구분 어려움 — 흑백 그라데이션의 알려진 트레이드오프. "강조 1색만 빨강" 원칙으로 정보 위계 보강.

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

**누적 총 21개 파일 수정** (1차 19개 + 2차 1개 + 3차 1개; 3차는 1차에서 손댄 파일에 추가 변경). 검증: dev `/`, `/custom-dashboard`, `/custom-dashboard/details?filename=...&type=ecommerce` 모두 HTTP 200.

#### 미적용 (잔여)

| 영역 | 파일 수 | 비고 |
|------|---------|------|
| 쿠팡 주문 페이지 | 1 | `app/coupang-orders/page.tsx` — 별도 작업 |

### 8.9 알려진 한계 / 후속 항목

1. **쿠팡 주문 페이지 미적용**: `app/coupang-orders/page.tsx`는 아직 미적용. 별도 작업 필요.
2. **차트 다시리즈 가독성**: 흑백 그라데이션이 5색 이상에서 시각적 구분 약함. 패턴(점선/실선) 추가나 라벨 강화 검토 필요.
3. **회색 인라인 hex 토큰화**: `#5d5d5d`, `#e5e5e5`, `#f5f5f5`, `#f8f8f8`이 인라인으로 흩어져 있음. globals.css에 추가 토큰 등록 권장.
4. **페이지 로컬 컴포넌트 정의 패턴**: `details/page.tsx`처럼 페이지 파일 내부에 컴포넌트를 직접 정의하는 패턴이 있어, 동명의 공용 컴포넌트(`components/DynamicAnalysisSection.tsx`)와 혼동을 일으킴. 향후 동명 컴포넌트는 공용으로 통합하거나 명확히 다른 이름으로 리네임 권장.

