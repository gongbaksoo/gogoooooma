"""일 리뷰 (Daily Review) 집계 모듈 — 「직전 코어 계상일 점검표」.

이 모듈은 '어제 하루의 매출 성적표'를 만들지 않는다.
CSV의 '일별'은 소비자 주문일이 아니라 ERP 매출계상일이며(D2C 자사몰조차 주말 계상이 거의 없다),
전사 순매출의 약 60%가 배치 계상(쿠팡 사입 = 주로 월요일, 다이소 = 정수배 단위)이라
일 단위로 해석할 수 없다.

그래서 이 모듈이 산출하는 것은 세 가지뿐이다.
  1) 데이터가 도착했는가 (가장 흔한 이상은 매출이 아니라 업로드 누락이다)
  2) 일 단위로 해석 가능한 채널(A군)에서 같은 요일 8주 범위를 벗어난 항목
  3) 월 목표 대비 지금이 기대 누계 밴드 안인가

전일비(DoD) · 전년 동일자 비교 · 착지 예상 금액 · B군 일별 금액 시계열은
**응답 스키마에 필드 자체를 만들지 않는다.** 만들 수 없으면 그릴 수 없다.

모든 상수는 260615.csv(418,049행) 3중 독립구현 백테스트로 확정했다. 근거는 각 상수 옆 주석 참조.
"""
import calendar
import logging
import os
import re
from datetime import date, datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from dashboard import get_dataframe, _resolve_file_hash
# 인프라 헬퍼는 월리뷰와 공유한다(복제 금지). monthly_review는 daily_review를 import하지 않으므로 순환 없음.
from monthly_review import _ensure_file_on_disk, _load_targets, _resolve_api_key

router = APIRouter(prefix="/daily-review", tags=["daily-review"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- 확정 상수
CORE_MIN_CHANNELS = 6      # 코어 계상일 = 그날 계상된 채널 수 >= 6. 2026년 채널수 분포가 이봉형(1~3: 26일 / 4~5: 0일 / 6+: 109일)이라 골짜기가 비어 있다.
AB_WINDOW = 60             # A/B 판정 창 = 직전 60개 '정상 코어일'
A_DENSITY_MIN = 0.75       # A군 진입: 기록밀도
A_DAYS_MIN = 30            # A군 진입: 계상일수
A_NET_MIN = 10_000_000     # A군 진입: 60일 순매출 하한
EXIT_NET_MIN = 7_000_000   # A군 이탈: 히스테리시스 하한 (없으면 폐쇄몰이 10M 경계를 넘나들며 진동)
EXIT_DENSITY_MIN = 0.70    # A군 이탈: 히스테리시스 밀도
EXIT_STREAK = 3            # 이탈 조건이 연속 3 코어일 지속될 때만 강등. 이걸 넣어야 G3(전환<=2)를 통과한다(미적용 시 사내판매 4회).

GATE_CHANNEL = 2_000_000   # 예외 금액 게이트
GATE_ACCOUNT = 1_000_000
GATE_PRODUCT = 500_000     # 상품은 그림자 모드(flags 미노출)

REF_SLOTS = 8              # 참조표본: 같은 요일 직전 8개 정상 코어일
REF_MIN_VALID = 6          # 유효관측(0-채움 제외) 최소 개수
POST_GAP_DAYS = 4          # 직전 코어일과 4일 이상 간격이면 급증 판정 미실시(밀린 마감이 하루에 실린다)

BEVENT_DORMANT_DAYS = 30   # B군 계상 지연 '확인'은 지연이 새로울 때만. 이 일수를 넘으면 중단·휴면으로 보고 매일 '확인'을 띄우지 않는다(예: 발주를 접은 쿠팡 사입이 영원히 확인을 띄우는 것을 막는다).

PROFILE_MIN_MONTHS = 8     # 학습월이 이보다 적으면 pace 블록 전체 null
PROFILE_START = "2025-01"  # 2023~24는 월 전량이 1일에 계상(unique date=1), 2021~22는 회계 리듬이 달라(D10 36.2% vs 25.1%) 섞으면 왜곡된다.
PROFILE_MIN_UNIQUE_DAYS = 18
PACE_BAND_MIN_DOM = 10     # DOM 9 이하는 밴드 미표시
PACE_INDEX_MIN_DOM = 20    # 착지 오차가 DOM10 31.2% / DOM15 19.8% / DOM20 9.7%. 페이스 지수는 DOM20부터만.

PROVISIONAL_DAYS = 45      # ERP 소급 정정 창. 260707 vs 260713 대조 결과 2026-06 데이터가 7월 중순에도 변경됐다(06-30 자사몰 -20,927,184).
RETURN_BATCH_MIN = 5_000_000   # 반품 배치일 판정
RETURN_BATCH_RATIO = 0.5

ADJ_PRODUCT_CODE = "ZZZZ-ZZZZZ"   # 「금액 조정용」 ERP 조정 전표. 예외 계산에서만 제외한다.

TARGET_FILE = "full_targets_extracted.csv"   # _load_targets는 인자가 없으면 None을 반환한다(monthly_review.py:112-113).

NEEDED_COLS = ["일별", "채널구분", "거래처명", "품목그룹1", "품목코드", "품목명[규격]", "판매액"]
WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]
UNCLASSIFIED = "미분류"    # 채널구분이 비었거나 '0'인 행. 매출에는 남기되 채널로 세지 않는다.
BEVENT_GAP_MONTHS = 12     # B군 계상 지연 판정에 쓸 간격 표본 기간
TOP_VENDORS = 8            # 주요 거래처 감시 패널에 상시 표시할 A군 거래처 수(60일 순매출 상위)
TOP_PRODUCTS = 8           # 주요 상품 감시 패널에 표시할 A군 상품(SKU) 수
BRANDS = ["마이비", "누비", "쏭레브"]   # 월 리뷰의 3대 브랜드(품목그룹1). 상시 감시 대상.
# ★ 심화 감시(거래처/브랜드/상품)는 전부 A군 채널로 스코프한다. 배치 채널(쿠팡 사입·다이소)을 포함하면
#   브랜드 일별이 오염된다(마이비 전채널 CV 1.68 → A군 스코프 0.68). 48회차 재검증 결과.

# 거래처명(R열) → 사람이 아는 표시명. **표시 전용이다.** 집계·매칭은 항상 원본 R열 exact.
# ERP 거래처명이 사람이 부르는 이름과 다른 것만 매핑한다(CJ·롯데마트·이마트·다이소는 그대로라 불필요).
# 근거(260615, 최근60정상코어일): 11st=오픈마켓(위탁)·밀도77% / 이베이=오픈마켓(위탁)·78% /
# 스팜(제제지크)=자사몰·78% / 스팜(쏭레브)=자사몰·78% / 쿠팡=오픈마켓(위탁)·72%(사입 '쿠팡(로켓)'과 구분).
ACCOUNT_ALIAS = {
    "11st": "11번가",
    "이베이": "지마켓",
    "스팜(제제지크)": "제제스스",
    "스팜(쏭레브)": "쏭스스",
    "쿠팡": "쿠팡(위탁)",
    "베이비빌리(주식회사 빌리지베이비)": "베이비빌리",
}


def _alias(name: str) -> str:
    """거래처 표시명. 별칭이 없으면 원본 그대로. 매칭 로직에는 절대 쓰지 말 것(표시 전용)."""
    return ACCOUNT_ALIAS.get(name, name)


# ---------------------------------------------------------------- 로딩·전처리

def _latest_filename() -> str:
    """최신 파일. uploaded_at이 아니라 '파일명의 YYMMDD'로 고른다.

    수동 업로드라 과거 파일이 나중에 재업로드될 수 있어 uploaded_at 정렬은 신뢰할 수 없다.
    """
    from database import list_files_in_db
    files = list_files_in_db() or []
    names = [f["filename"] if isinstance(f, dict) else str(f) for f in files]
    dated = []
    for n in names:
        m = re.match(r"^(\d{6})\.csv$", os.path.basename(n))
        if m:
            dated.append((m.group(1), n))
    if not dated:
        raise HTTPException(status_code=404, detail="YYMMDD.csv 형식의 업로드 파일이 없습니다.")
    return max(dated)[1]


def _prep(filename: str) -> pd.DataFrame:
    """리뷰 집계용 프레임. get_dataframe의 공유 캐시를 in-place 변형하지 않는다."""
    if not _ensure_file_on_disk(filename):
        raise HTTPException(status_code=404, detail=f"파일 없음: {filename}")
    try:
        raw = get_dataframe(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"파일 없음: {filename}")

    missing = [c for c in NEEDED_COLS if c not in raw.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"CSV에 컬럼이 없습니다: {missing}")

    df = raw[NEEDED_COLS].copy()          # dashboard.py:695-705가 캐시 프레임을 in-place로 건드리는 전례가 있어 반드시 복사본을 쓴다
    if not pd.api.types.is_datetime64_any_dtype(df["일별"]):
        df["일별"] = pd.to_datetime(df["일별"], errors="coerce")
    df = df.dropna(subset=["일별"])
    df["판매액"] = pd.to_numeric(df["판매액"], errors="coerce").fillna(0.0)
    # 채널구분이 비었거나 '0'인 행이 존재한다. astype(str)만 하면 'nan'이 채널 하나로 잡혀
    # 코어일의 채널 수(nunique)를 부풀린다. 매출은 전사 총계에 살려두되 채널로는 세지 않는다.
    ch = df["채널구분"].astype(str).str.strip()
    df["채널구분"] = ch.mask(ch.isin(["nan", "None", "", "0"]), UNCLASSIFIED)
    df["거래처명"] = df["거래처명"].astype(str)   # 거래처 식별은 항상 R열(거래처명). C열 '거래처' 사용 금지.
    df["품목그룹1"] = df["품목그룹1"].astype(str)  # 브랜드
    df["품목코드"] = df["품목코드"].astype(str)
    return df


def _watch_row(piv_ref: pd.DataFrame, name, tgt: pd.Timestamp, refs: pd.DatetimeIndex) -> dict:
    """엔티티 하나의 '같은 요일 8주 범위 위치'. 심화 감시(거래처/브랜드/상품) 공통.

    유효관측(같은 요일 계상일) < REF_MIN_VALID면 위치를 단정하지 않고 '표본 부족'.
    """
    v = piv_ref[name].reindex(refs, fill_value=0.0).to_numpy(dtype=float)
    x = float(piv_ref.loc[tgt, name])
    ref_n = int((v != 0).sum())
    if ref_n < REF_MIN_VALID:
        pos = "표본 부족"
    elif x > v.max():
        pos = "범위 상단 초과"
    elif x < v.min():
        pos = "범위 하단 미만"
    else:
        pos = "범위 내"
    return {
        "net": x,
        "ref_min": float(v.min()), "ref_max": float(v.max()), "ref_median": float(np.median(v)),
        "ref_n": ref_n, "position": pos,
    }


def _core_days(df: pd.DataFrame) -> tuple[pd.DatetimeIndex, pd.DatetimeIndex]:
    """(코어 계상일, 정상 코어일). 정상 = 코어일 − 월말 마감 계상일."""
    real = df[df["채널구분"] != UNCLASSIFIED]     # 미분류는 채널이 아니므로 코어일 판정에서 세지 않는다
    nch = real.groupby("일별")["채널구분"].nunique()
    core = pd.DatetimeIndex(sorted(nch[nch >= CORE_MIN_CHANNELS].index))
    if len(core) == 0:
        return core, core
    is_eom = pd.Series(core).dt.is_month_end.values
    normal = pd.DatetimeIndex(pd.Series(core)[~is_eom])
    return core, normal


# ---------------------------------------------------------------- A/B군 판정

def _channel_stats(piv: pd.DataFrame) -> dict:
    """정상코어일 × 채널 순매출 피벗 → 60일 롤링 통계 (density / days_seen / net60 / mean / cv)."""
    nz = (piv != 0).astype(float)
    days_seen = nz.rolling(AB_WINDOW).sum()
    net60 = piv.rolling(AB_WINDOW).sum()
    sumsq = (piv ** 2).rolling(AB_WINDOW).sum()

    with np.errstate(invalid="ignore", divide="ignore"):
        mean = net60 / days_seen                       # 0인 날은 합에 기여하지 않으므로 = 계상일 평균
        var = (sumsq - days_seen * mean ** 2) / (days_seen - 1)
        cv = np.sqrt(var.clip(lower=0)) / mean
    return {
        "density": days_seen / AB_WINDOW,              # 분모는 항상 상수 60
        "days_seen": days_seen,
        "net60": net60,
        "mean": mean,
        "cv": cv,
    }


def _classify_with_hysteresis(piv: pd.DataFrame, stats: dict) -> pd.DataFrame:
    """정상코어일마다 A/B 상태를 확정. 진입은 즉시, 이탈은 연속 EXIT_STREAK회 위반 시에만."""
    channels = list(piv.columns)
    density, days_seen, net60, mean = stats["density"], stats["days_seen"], stats["net60"], stats["mean"]

    enter = (
        (density >= A_DENSITY_MIN)
        & (days_seen >= A_DAYS_MIN)
        & (net60 >= A_NET_MIN)
        & (mean > 0)
    ).fillna(False)
    breach_cond = ((net60 < EXIT_NET_MIN) | (density < EXIT_DENSITY_MIN)).fillna(True)

    E = enter.to_numpy(dtype=bool)                     # (일자 × 채널). get_loc을 루프 안에서 부르지 않는다.
    B = breach_cond.to_numpy(dtype=bool)
    n_days, n_ch = E.shape
    out = np.zeros((n_days, n_ch), dtype=bool)
    cur = np.zeros(n_ch, dtype=bool)
    breach = np.zeros(n_ch, dtype=int)
    for i in range(AB_WINDOW - 1, n_days):             # 창이 60개 미만인 구간은 판정 불가 → 전 채널 B
        entering = ~cur & E[i]
        breach = np.where(cur & B[i], breach + 1, 0)
        demote = cur & (breach >= EXIT_STREAK)
        cur = (cur | entering) & ~demote
        breach = np.where(demote | entering, 0, breach)
        out[i] = cur
    return pd.DataFrame(out, index=piv.index, columns=channels)


# ---------------------------------------------------------------- 월진행률 프로파일

def _month_curve(month_net: pd.Series, year: int, month: int) -> Optional[np.ndarray]:
    """한 달의 누적 진척 곡선을 '달력형'으로 만들어 진행률 그리드(0.01~1.00)에 보간.

    ★ 관측일에만 점을 찍고 갭을 직선 보간하면 주말 구간에서 곡선이 미리 상승해
      앵커가 2~8%p 부풀려진다(DOM12가 토·일인 달에서만 어긋난다). 계상 없는 날은 누적을 유지한다.
    """
    dim = calendar.monthrange(year, month)[1]
    daily = np.zeros(dim + 1)
    for d, v in month_net.items():
        daily[d.day] = float(v)
    cum = np.cumsum(daily)
    total = cum[dim]
    if total <= 0:
        return None
    xs = np.array([0.0] + [d / dim for d in range(1, dim + 1)])
    ys = np.array([0.0] + [cum[d] / total for d in range(1, dim + 1)])
    return np.interp(GRID, xs, ys)


GRID = np.arange(0.01, 1.0001, 0.01)


def _build_profile(df: pd.DataFrame, target_month: pd.Period) -> Optional[dict]:
    """학습창: 완결월 중 unique date >= 18 AND 월 >= 2025-01 AND 순매출 > 0. 대상월 제외."""
    data_max = df["일별"].max()
    g = df.groupby(df["일별"].dt.to_period("M"))
    curves, months = [], []
    for period, sub in g:
        if period >= target_month:
            continue
        if str(period) < PROFILE_START:
            continue
        if pd.Timestamp(period.end_time.date()) > data_max:      # 완결월만
            continue
        if sub["일별"].nunique() < PROFILE_MIN_UNIQUE_DAYS:
            continue
        net_by_day = sub.groupby("일별")["판매액"].sum()
        if net_by_day.sum() <= 0:
            continue
        c = _month_curve(net_by_day, period.year, period.month)
        if c is not None:
            curves.append(c)
            months.append(str(period))
    if len(curves) < PROFILE_MIN_MONTHS:
        return None

    arr = np.vstack(curves)
    med = np.maximum.accumulate(np.median(arr, axis=0))          # 단조 증가 보정을 셋 다에 적용해 구현 간 차이를 원천 제거
    p25 = np.maximum.accumulate(np.percentile(arr, 25, axis=0))
    p75 = np.maximum.accumulate(np.percentile(arr, 75, axis=0))
    return {"med": med, "p25": p25, "p75": p75, "months": months}


def _profile_at(profile: dict, progress: float) -> tuple[float, float, float]:
    """진행률(d/dim)에서 기대 진척률 중앙값·P25·P75. 반올림 금지, 선형보간."""
    return (
        float(np.interp(progress, GRID, profile["med"])),
        float(np.interp(progress, GRID, profile["p25"])),
        float(np.interp(progress, GRID, profile["p75"])),
    )


# ---------------------------------------------------------------- 예외 판정

def _entity_series(df: pd.DataFrame, days: pd.DatetimeIndex, keys: list[str]) -> pd.DataFrame:
    """(일자 × 엔티티) 순매출 피벗. 계상 없으면 0."""
    sub = df[df["일별"].isin(days)]
    if sub.empty:
        return pd.DataFrame(index=days)
    piv = sub.groupby(["일별"] + keys)["판매액"].sum().unstack(keys, fill_value=0.0)
    return piv.reindex(days, fill_value=0.0)


def _bevent_gap_status(days_since: int, gaps) -> dict:
    """B군 채널의 계상 간격을 3단계로 판정한다.

    - info(정상): 통상 리듬 안. 확인 안 띄움.
    - check(계상 지연): 지연이 '새로울 때'만. 통상 간격의 2배 초과 ~ 휴면 상한 이내.
    - info + dormant(중단·휴면): 상한을 넘어 오래 계상이 없음. 알려진 상태이므로 매일 확인을 띄우지 않는다.

    gaps = 최근 표본의 계상 간격(일). 3개 미만이면 판정하지 않고 info로 둔다.
    휴면 상한 = max(BEVENT_DORMANT_DAYS, thr×2) — 통상 주기가 긴 희소 채널을 오탐 휴면으로 몰지 않기 위함.
    """
    if len(gaps) < 3:
        return {"kind": "info", "dormant": False, "message": "계상 이벤트. 하루 성과로 해석 불가."}
    med = float(np.median(gaps))
    thr = max(med * 2, float(np.percentile(gaps, 90)))
    ceiling = max(BEVENT_DORMANT_DAYS, thr * 2)
    if days_since > ceiling:
        return {"kind": "info", "dormant": True,
                "message": f"장기 미계상 — 직전 계상 후 {days_since}일 경과(중단·휴면 추정). 재계상되면 자동 해제됩니다."}
    if days_since > thr:
        return {"kind": "check", "dormant": False,
                "message": f"계상 지연 — 최근 12개월 통상 간격({med:.0f}일) 대비 {days_since}일 경과."}
    return {"kind": "info", "dormant": False, "message": "계상 이벤트. 하루 성과로 해석 불가."}


def _detect(piv: pd.DataFrame, target: pd.Timestamp, refs: pd.DatetimeIndex,
            gate: float, allow_surge: bool) -> list[dict]:
    """같은 요일 8슬롯 참조표본 대비 범위 이탈 + 절대금액 게이트."""
    out = []
    if len(refs) == 0 or target not in piv.index:
        return out
    ref_vec = piv.reindex(refs, fill_value=0.0)
    tgt = piv.loc[target]

    for ent in piv.columns:
        v = ref_vec[ent].to_numpy(dtype=float)
        valid = int((v != 0).sum())                  # 0-채움 값은 유효관측으로 세지 않는다
        if valid < REF_MIN_VALID:
            continue
        x = float(tgt[ent])
        lo, hi, med = float(v.min()), float(v.max()), float(np.median(v))   # min/max/median은 8슬롯 전부로 계산
        if allow_surge and x > hi and (x - med) >= gate:
            kind = "surge"
        elif x < lo and (med - x) >= gate:
            kind = "drop"
        else:
            continue
        if isinstance(ent, str):
            entity = entity_display = ent          # 채널 레벨: 별칭 없음
        else:
            entity = " · ".join(map(str, ent))     # 원본(참조·매칭용)
            parts = list(map(str, ent))
            parts[-1] = _alias(parts[-1])          # 마지막 = 거래처명(R열) → 표시명만 치환
            entity_display = " · ".join(parts)
        out.append({
            "entity": entity,
            "entity_display": entity_display,
            "kind": kind,
            "value": x,
            "ref_min": lo,
            "ref_max": hi,
            "ref_median": med,
            "ref_valid": valid,
            "gap": (x - hi) if kind == "surge" else (lo - x),
        })
    return sorted(out, key=lambda r: -abs(r["gap"]))


# ---------------------------------------------------------------- 엔드포인트

@router.get("/summary/")
def get_daily_review_summary(
    filename: Optional[str] = Query(None, description="미지정 시 파일명 YYMMDD가 가장 큰 파일"),
    target_date: Optional[str] = Query(None, description="YYYY-MM-DD. 미지정 시 최신 코어 계상일"),
):
    fname = filename or _latest_filename()
    df = _prep(fname)
    file_hash = _resolve_file_hash(fname, os.path.join(BASE_DIR, "uploads", fname))

    core, normal = _core_days(df)
    if len(normal) < AB_WINDOW:
        return {"status": "no_data", "meta": {"filename": fname},
                "message": f"정상 코어일이 {len(normal)}개뿐입니다(최소 {AB_WINDOW}개 필요)."}

    data_max = df["일별"].max()
    latest_core = core[-1]

    # ---- 대상일 결정
    if target_date:
        try:
            tgt = pd.Timestamp(datetime.strptime(target_date, "%Y-%m-%d").date())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"잘못된 날짜 포맷: {target_date} (YYYY-MM-DD)")
        if tgt not in core:
            prior = core[core < tgt]
            return {
                "status": "non_core_day",
                "meta": {"filename": fname, "target_date": target_date,
                         "weekday": WEEKDAY_KO[tgt.weekday()]},
                "suggestion": str(prior[-1].date()) if len(prior) else None,
                "message": f"{target_date}({WEEKDAY_KO[tgt.weekday()]})은 계상일이 아닙니다.",
            }
        target_source = "user"
    else:
        tgt = latest_core
        target_source = "auto_latest"

    dim = calendar.monthrange(tgt.year, tgt.month)[1]
    dom = tgt.day
    progress = dom / dim
    is_eom = (dom == dim)
    prior_core = core[core < tgt]
    gap_days = (tgt - prior_core[-1]).days if len(prior_core) else None
    post_gap = gap_days is not None and gap_days >= POST_GAP_DAYS

    # ---- A/B 판정 (정상 코어일 기준, 히스테리시스 적용)
    normal_upto = normal[normal <= tgt]
    piv_ch = (df[df["일별"].isin(normal_upto)]
              .groupby(["일별", "채널구분"])["판매액"].sum()
              .unstack(fill_value=0.0)
              .reindex(normal_upto, fill_value=0.0))
    stats = _channel_stats(piv_ch)
    state = _classify_with_hysteresis(piv_ch, stats)

    # 대상일이 정상코어일이 아니면(=월말) 직전 정상코어일의 판정을 쓴다
    class_day = tgt if tgt in normal_upto else normal_upto[-1]
    ci = normal_upto.get_loc(class_day)

    channels = []
    for c in piv_ch.columns:
        j = piv_ch.columns.get_loc(c)
        is_a = bool(state.iat[ci, j])
        cv = float(stats["cv"].iat[ci, j]) if pd.notna(stats["cv"].iat[ci, j]) else None
        days_seen = int(stats["days_seen"].iat[ci, j]) if pd.notna(stats["days_seen"].iat[ci, j]) else 0
        if c == UNCLASSIFIED or days_seen == 0:
            continue          # 미분류 · 창 안에서 한 번도 계상되지 않은 죽은 채널(공통/마케팅팀 등)은 화면에 올리지 않는다
        channels.append({
            "name": c,
            "group": "A" if is_a else "B",
            "density": round(float(stats["density"].iat[ci, j]), 3),
            "days_seen": days_seen,
            "cv": round(cv, 2) if cv is not None else None,
            "high_variance": bool(cv is not None and cv > 1.0),
            "net_60d": float(stats["net60"].iat[ci, j]),
            "allow_daily_series": is_a,
        })
    a_channels = [c["name"] for c in channels if c["group"] == "A"]

    # ---- 계상 현황 (총매출 / 반품 / 순매출 3분할, A군·B군 각각)
    day_df = df[df["일별"] == tgt]

    def split(sub):
        pos = float(sub.loc[sub["판매액"] > 0, "판매액"].sum())
        neg = float(sub.loc[sub["판매액"] < 0, "판매액"].sum())
        return {"gross": pos, "returns": neg, "net": pos + neg}

    a_df = day_df[day_df["채널구분"].isin(a_channels)]
    b_df = day_df[~day_df["채널구분"].isin(a_channels)]
    snap = {"a_group": split(a_df), "b_group": split(b_df), "total": split(day_df)}

    # ---- 참조표본: 같은 요일 · 직전 8개 정상 코어일
    same_wd = normal[(normal < tgt) & (pd.Series(normal).dt.weekday.values == tgt.weekday())]
    refs = pd.DatetimeIndex(same_wd[-REF_SLOTS:])
    ref_days = pd.DatetimeIndex(list(refs) + [tgt])

    ch_piv_ref = _entity_series(df, ref_days, ["채널구분"])
    a_rows = []
    for c in a_channels:
        if c not in ch_piv_ref.columns:
            continue
        v = ch_piv_ref[c].reindex(refs, fill_value=0.0).to_numpy(dtype=float)
        x = float(ch_piv_ref.loc[tgt, c])
        pos = "범위 내"
        if len(v) and x > v.max():
            pos = "범위 상단 초과"
        elif len(v) and x < v.min():
            pos = "범위 하단 미만"
        j = piv_ch.columns.get_loc(c) if c in piv_ch.columns else None
        a_rows.append({
            "channel": c,
            "net": x,
            "ref_min": float(v.min()) if len(v) else None,
            "ref_max": float(v.max()) if len(v) else None,
            "ref_median": float(np.median(v)) if len(v) else None,
            "ref_n": int((v != 0).sum()),
            "position": pos,
            "high_variance": bool(j is not None and pd.notna(stats["cv"].iat[ci, j]) and stats["cv"].iat[ci, j] > 1.0),
        })
    snap["a_channels"] = sorted(a_rows, key=lambda r: -r["net"])
    snap["ref_dates"] = [str(d.date()) for d in refs]
    snap["footnote"] = "일별은 ERP 매출계상일입니다. 실제 주문일·출고일이 아닙니다."

    # ---- 주요 거래처 감시 (A군 채널 소속 거래처 top-N, 상시). 월리뷰가 상시 파는 거래처 축을 일 단위로.
    # 채널 표와 같은 '같은 요일 8주 범위 위치' 규약. 별칭은 표시 전용, 매칭은 R열 exact.
    a_only = df[df["채널구분"].isin(a_channels)]
    win60 = normal_upto[-AB_WINDOW:] if len(normal_upto) >= AB_WINDOW else normal_upto
    a_win = a_only[a_only["일별"].isin(win60)]
    net_by_vendor = a_win.groupby("거래처명")["판매액"].sum().sort_values(ascending=False)
    # 거래처 → 대표 채널(창 안 최빈)
    ven_channel = (a_win.groupby("거래처명")["채널구분"]
                   .agg(lambda s: s.value_counts().index[0]) if not a_win.empty else {})
    top_names = [n for n in net_by_vendor.head(TOP_VENDORS).index if net_by_vendor[n] > 0]
    ven_piv_ref = _entity_series(a_only, ref_days, ["거래처명"])
    vendor_rows = []
    for name in top_names:
        if name not in ven_piv_ref.columns:
            continue
        vendor_rows.append({
            "account": name,
            "account_display": _alias(name),
            "channel": str(ven_channel[name]) if name in ven_channel else None,
            "net_60d": float(net_by_vendor[name]),
            **_watch_row(ven_piv_ref, name, tgt, refs),
        })
    snap["top_vendors"] = vendor_rows

    # ---- 주요 브랜드 감시 (3대 브랜드, A군 스코프). 월 리뷰의 1차 조직축을 일 단위로.
    # A군 스코프 필수: 마이비 순매출 67.9%가 배치라 전 채널로는 오염. A군 한정 시 일CV 마이비 0.68/누비 0.65(48회차).
    a_brand = a_only[a_only["품목그룹1"].isin(BRANDS)]
    br_piv_ref = _entity_series(a_brand, ref_days, ["품목그룹1"])
    br_win = (a_brand[a_brand["일별"].isin(win60)]
              .groupby(["일별", "품목그룹1"])["판매액"].sum().unstack("품목그룹1", fill_value=0.0)
              .reindex(win60, fill_value=0.0))
    brand_rows = []
    for b in BRANDS:                                  # 고정 순서(매출 축이 아니라 브랜드 정체성 축)
        if b not in br_piv_ref.columns:
            continue
        col = br_win[b] if b in br_win.columns else pd.Series(0.0, index=win60)
        nz = col[col != 0]
        cv = float(nz.std(ddof=1) / nz.mean()) if len(nz) > 1 and nz.mean() != 0 else None
        brand_rows.append({
            "brand": b,
            "net_60d": float(col.sum()),
            "cv": round(cv, 2) if cv is not None else None,
            "high_variance": bool(cv is not None and cv > 1.0),
            **_watch_row(br_piv_ref, b, tgt, refs),
        })
    snap["top_brands"] = brand_rows

    # ---- 주요 상품 감시 (A군 상품 top-N, 60일 순매출 상위). 월 리뷰가 파는 SKU 축을 일 단위로.
    # 예외 카드로 올리지 않는다: 상품 예외는 연 101건(0건인 날 45%)이라 '조용한 날은 짧게' 원칙을 깬다(48회차).
    # 감시 패널로만 — 히어로 SKU가 움직이면 보이되 예외 소음은 안 만든다.
    prod_win = a_only[a_only["일별"].isin(win60)]
    net_by_prod = prod_win.groupby("품목코드")["판매액"].sum().sort_values(ascending=False)
    name_by_code = a_only.drop_duplicates("품목코드").set_index("품목코드")["품목명[규격]"]
    top_codes = [c for c in net_by_prod.head(TOP_PRODUCTS).index if net_by_prod[c] > 0]
    pr_piv_ref = _entity_series(a_only, ref_days, ["품목코드"])
    product_rows = []
    for code in top_codes:
        if code not in pr_piv_ref.columns:
            continue
        product_rows.append({
            "code": code,
            "name": str(name_by_code.get(code, code)),
            "net_60d": float(net_by_prod[code]),
            **_watch_row(pr_piv_ref, code, tgt, refs),
        })
    snap["top_products"] = product_rows

    # ---- 반품 배치일 / 월말 마감 플래그
    tot = snap["total"]
    return_batch = (abs(tot["returns"]) >= RETURN_BATCH_MIN
                    and abs(tot["returns"]) >= tot["gross"] * RETURN_BATCH_RATIO)
    flags = []
    if is_eom:
        flags.append("month_end_batch")
    if post_gap:
        flags.append("post_gap")
    if return_batch:
        flags.append("return_batch")

    # ---- 예외 판정 (A군 한정, 조정 전표 제외)
    anomalies, suppressed = [], None
    if is_eom:
        suppressed = "월말 마감 계상일 — 전 채널이 동시 계상되므로 예외 판정을 실시하지 않습니다."
    else:
        adj_free = df[(df["품목코드"] != ADJ_PRODUCT_CODE) & (df["채널구분"].isin(a_channels))]
        allow_surge = not post_gap
        ch_piv = _entity_series(adj_free, ref_days, ["채널구분"])
        ac_piv = _entity_series(adj_free, ref_days, ["채널구분", "거래처명"])
        for r in _detect(ch_piv, tgt, refs, GATE_CHANNEL, allow_surge):
            r["level"] = "channel"
            anomalies.append(r)
        for r in _detect(ac_piv, tgt, refs, GATE_ACCOUNT, allow_surge):
            r["level"] = "account"
            anomalies.append(r)
        anomalies.sort(key=lambda r: -abs(r["gap"]))
        if post_gap:
            suppressed = f"직전 계상일과 {gap_days}일 간격 — 밀린 마감이 하루에 실릴 수 있어 급증 판정을 실시하지 않습니다."

    # ---- B군 계상 이벤트 (금액 추이 없음. 이벤트만.)
    b_events = []
    gap_since = tgt - pd.DateOffset(months=BEVENT_GAP_MONTHS)
    for c in [x["name"] for x in channels if x["group"] == "B"]:
        s = df[df["채널구분"] == c].groupby("일별")["판매액"].sum()
        s = s[(s != 0) & (s.index <= tgt)]
        if s.empty:
            continue
        last = s.index.max()
        days_since = int((tgt - last).days)
        # 계상 간격은 최근 12개월 표본으로만 본다. 전 기간을 쓰면 과거의 다른 계상 리듬이 섞인다.
        recent = s[s.index >= gap_since]
        gaps = np.diff([d.toordinal() for d in recent.index])
        status = _bevent_gap_status(days_since, gaps)
        b_events.append({
            "channel": c,
            "kind": status["kind"],
            "dormant": status["dormant"],
            "today_net": float(s.get(tgt, 0.0)),
            "last_accrual_date": str(last.date()),
            "last_accrual_net": float(s.loc[last]),
            "days_since": days_since,
            "message": status["message"],
        })
    # 확인(check) → 정상(info) → 휴면(dormant) 순. 죽어가는 채널은 맨 아래로.
    b_events.sort(key=lambda e: (e["kind"] != "check", e["dormant"], -abs(e["today_net"])))

    # ---- MTD 페이스
    m_start = tgt.replace(day=1)
    mtd_df = df[(df["일별"] >= m_start) & (df["일별"] <= tgt)]
    mtd = split(mtd_df)
    month_str = f"{tgt.year}-{tgt.month:02d}"

    targets = _load_targets(TARGET_FILE)
    tval = None
    if targets is not None:
        row = targets[(targets["월"] == month_str) & (targets["파트"] == "전체")]
        if not row.empty:
            tval = float(row["목표"].iloc[0])

    profile = _build_profile(df, pd.Period(month_str, freq="M"))
    stale = latest_core < tgt
    pace = {
        "month": month_str, "as_of_date": str(tgt.date()), "dom": dom, "days_in_month": dim,
        "progress_ratio": round(progress, 4), "mtd": mtd, "target": tval,
        "achievement_pct": round(mtd["net"] / tval * 100, 1) if tval else None,
        "is_month_final": bool(is_eom),
        "expected_share": None, "expected_mtd_band": None, "band_position": None,
        "pace_index": None, "base_rate": None, "learned_months": None, "suppressed_reason": None,
    }
    if profile is None:
        pace["suppressed_reason"] = "학습 가능한 완결월이 부족합니다."
    elif tval is None:
        pace["suppressed_reason"] = f"{month_str} 목표가 목표 파일에 없습니다."
    else:
        pace["learned_months"] = profile["months"]

        # base rate — 목표비를 신호등으로 못 쓰는 이유를 숫자로 병기한다(달성률 평균이 100%를 크게 밑돈다).
        # 밴드가 억제되는 날에도 반드시 보여야 하므로 밴드 계산 밖에서 구한다.
        rates = []
        for m in profile["months"]:
            r = targets[(targets["월"] == m) & (targets["파트"] == "전체")]
            if r.empty:
                continue
            t = float(r["목표"].iloc[0])
            actual = float(df[df["일별"].dt.to_period("M") == pd.Period(m, freq="M")]["판매액"].sum())
            if t > 0:
                rates.append(actual / t)
        if rates:
            pace["base_rate"] = {
                "mean_achievement": round(float(np.mean(rates)) * 100, 1),
                "hit_100_count": int(sum(1 for r in rates if r >= 1.0)),
                "n_months": len(rates),
            }

        if is_eom:
            # 진행률 100%면 기대 밴드가 목표 한 점으로 붕괴한다. 밴드가 아니라 달성률로 말해야 한다.
            pace["suppressed_reason"] = "월 최종일 — 기대 밴드 대신 달성률로 표시합니다."
        elif dom < PACE_BAND_MIN_DOM:
            pace["suppressed_reason"] = f"월초(DOM {dom})는 예측 오차가 30%를 넘어 밴드를 표시하지 않습니다."
        else:
            med, p25, p75 = _profile_at(profile, progress)
            low, high = tval * p25, tval * p75
            pace["expected_share"] = {"med": round(med * 100, 1), "p25": round(p25 * 100, 1), "p75": round(p75 * 100, 1)}
            pace["expected_mtd_band"] = {"low": low, "high": high}
            pace["band_position"] = ("밴드 하회" if mtd["net"] < low
                                     else "밴드 상회" if mtd["net"] > high else "밴드 내")
            if dom >= PACE_INDEX_MIN_DOM and med > 0:
                pace["pace_index"] = round(mtd["net"] / (tval * med) * 100, 1)
    if stale:
        pace["suppressed_reason"] = "데이터가 대상일까지 도착하지 않았습니다. 페이스 지표를 표시하지 않습니다."
        pace["expected_mtd_band"] = pace["band_position"] = pace["pace_index"] = None

    # ---- 데이터 신선도
    file_dt = None
    m = re.match(r"^(\d{2})(\d{2})(\d{2})\.csv$", os.path.basename(fname))
    if m:
        try:
            file_dt = date(2000 + int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            file_dt = None
    freshness = {
        "latest_core_date": str(latest_core.date()),
        "data_max_date": str(data_max.date()),
        "file_date": str(file_dt) if file_dt else None,
        "file_lag_days": (file_dt - latest_core.date()).days if file_dt else None,
        "stale": bool(stale),
        "provisional": bool((data_max - tgt).days <= PROVISIONAL_DAYS),
    }

    # ---- 침묵 로그 (판정하지 않은 것 — 접지 않고 노출한다)
    a_net_60 = sum(c["net_60d"] for c in channels if c["group"] == "A")
    all_net_60 = sum(c["net_60d"] for c in channels)
    silence = {
        "coverage_pct": round(a_net_60 / all_net_60 * 100, 1) if all_net_60 else None,
        "skipped_bgroup": [c["name"] for c in channels if c["group"] == "B"],
        "skipped_shadow_product": "상품 레벨은 1차 배포에서 카드로 올리지 않습니다(그림자 모드).",
        "note": "예외 판정 대상은 A군 채널뿐입니다. 나머지는 배치 계상이라 일 단위 이상 감지가 불가능합니다.",
    }

    return {
        "status": "ok",
        "meta": {
            "filename": fname, "file_hash": file_hash,
            "target_date": str(tgt.date()), "target_date_source": target_source,
            "weekday": WEEKDAY_KO[tgt.weekday()],
            "dom": dom, "days_in_month": dim, "progress_ratio": round(progress, 4),
            "day_flags": flags,
            "prior_core_date": str(prior_core[-1].date()) if len(prior_core) else None,
            "gap_days": gap_days,
        },
        "data_freshness": freshness,
        "channel_classification": {
            "window": {"start": str(normal_upto[max(0, ci - AB_WINDOW + 1)].date()),
                       "end": str(class_day.date()), "n": AB_WINDOW},
            "thresholds": {"density_min": A_DENSITY_MIN, "days_min": A_DAYS_MIN,
                           "net_60d_min": A_NET_MIN, "exit_net_min": EXIT_NET_MIN,
                           "exit_density_min": EXIT_DENSITY_MIN, "exit_streak": EXIT_STREAK},
            "channels": sorted(channels, key=lambda c: (c["group"], -c["net_60d"])),
        },
        "accrual_snapshot": snap,
        "mtd_pace": pace,
        "anomalies": {
            "flags": anomalies,
            "suppressed_reason": suppressed,
            "checked": {"channels": len(a_channels), "gates": {"channel": GATE_CHANNEL, "account": GATE_ACCOUNT}},
        },
        "bgroup_events": b_events,
        "silence_log": silence,
    }


# ================================================================ AI 분석
# 월 리뷰와 같은 구조(사용자 편집 지침 + Gemini)이나, **하드룰을 코드에 박는다**.
# 이 페이지의 설계 전체가 "일 매출을 성과로 읽지 마라"인데, LLM은 두면 반드시 그걸 한다.
# 지침은 사용자가 고치되 하드룰은 못 고친다.

DAILY_PROMPTS_FILE = os.path.join(BASE_DIR, "daily_prompts.json")   # 런타임 파일(gitignore). 사용자 override 전용.

# 기본 분석 지침은 **코드에 동봉**한다. 월 리뷰는 런타임 파일이 비면 400을 내는데(작성 강요),
# 일 리뷰는 매일 쓰는 화면이라 기본값으로 바로 동작해야 한다. 사용자가 저장하면 그 값이 우선.
DEFAULT_GUIDE = """- 오늘 확인이 필요한 것부터 쓴다.
- 예외가 있으면 심화 감시(거래처·브랜드·상품)에서 함께 움직인 것이 있으면 연결해 준다.
- 마지막에 월 페이스를 한 줄로 덧붙인다."""

# ★ AI에 일별 원시 시계열을 주지 않는다. 컨텍스트는 MTD·프로파일·플래그·예외카드·심화감시 요약뿐.
HARD_RULES = """[반드시 지킬 규칙 — 지침보다 우선]
1. 전일비(어제 대비)·전년 동일자 비교를 언급하지 마라. 이 데이터에 없고, 요일 효과가 259배라 의미가 없다.
2. B군(배치 계상) 채널의 일 변동을 성과로 해석하지 마라. 계상 타이밍일 뿐이다. 쿠팡 사입·다이소가 그렇다.
3. 행사·바이럴 등 활동을 매출의 원인으로 서술하지 마라. 활동 데이터가 없다.
4. 플래그(월말 마감·연휴 직후·반품 배치)가 있는 날의 증감은 회계 아티팩트로 다뤄라. 영업 성과로 읽지 마라.
5. 착지 예상 금액을 만들지 마라. 월초 예측 오차가 31%다.
6. 감시 범위(A군 비중)를 넘어 전사를 단정하지 마라. 나머지는 배치라 일 단위로 볼 수 없다.
7. [데이터]에 있는 수치만 써라. 계산해서 새 숫자를 만들거나 추측하지 마라.
8. 길이는 **예외 건수가 아니라 플래그와 심화 감시 신호**로 정한다.
   - 예외 0건 + 플래그 없음 + 심화 감시 범위 밖 없음 → "특이사항 없음" + 근거 한 줄로 끝낸다. 월 페이스는 한 줄만.
   - 예외 0건 + 플래그 없음 + 심화 감시에 범위 밖 있음 → **두 문장 이내(초과 금지)**. 범위 밖 항목만 다뤄라: 무엇이 범위 밖인지 · 다른 축에 동행이 있는지 · 무시해도 되는지.
   - 예외 0건 + 플래그 있음(월말 마감·연휴 직후·반품 배치) → **오독 방지가 목적이므로 길이 제한 없음.** 단 '무엇이 아티팩트인지'에만 쓰고, 범위 밖 항목을 전부 나열하지 말고 축별로 묶어 요약한다.
9. '일별'은 ERP 매출계상일이다. '어제 팔린 금액'이라고 쓰지 마라. '계상'이라고 써라.
10. [A군 채널 위치]와 [심화 감시]의 판정을 뒤집거나 뭉뚱그리지 마라. "전부 범위 내"라고 쓰려면 나열된 채널이 **모두** '범위 내'여야 한다. 하나라도 상단 초과/하단 미만이면 "전부"라는 단어를 쓰지 마라.
11. [확인 필요 예외]가 여러 건이고 같은 사건의 다른 축(채널과 그 채널의 거래처 등)이라고 판단되면 병합해 서술해도 된다. 단 "예외 2건(카드 기준) — 실질 1개 사건"처럼 **카드 건수를 먼저 밝히고** 병합 근거를 대라. 카드 건수와 다른 숫자를 단독으로 제시하지 마라.
12. 예외 카드는 "무엇이 얼마나 범위를 벗어났는지"를 이미 정확히 말한다. **그것을 다시 쓰지 마라.** 네가 쓸 것은 카드가 못 하는 세 가지뿐이다:
   ① 여러 축(채널·거래처·브랜드·상품)이 같은 사건인지 연결
   ② 게이트 미만이라 카드에 안 오른 심화 감시 항목 중 카드와 같은 방향인 것
   ③ 플래그일에 어떤 숫자를 무시해야 하는지
   이 셋 중 아무것도 없으면 쓰지 마라.
13. **'범위 내'인 항목을 금액과 함께 나열하지 마라.** 화면이 이미 표로 보여준다. 굳이 언급해야 하면 "나머지 채널은 범위 내" 한 마디로 끝내라. 정상인 것을 다시 쓰는 건 규칙 12 위반이다.
14. **마크다운 서식을 쓰지 마라.** 화면은 평문으로 그대로 보여주므로 `**`·`#`·표는 별표와 기호가 그대로 노출된다. 문단 나눔과 줄바꿈만 써라. 항목을 나눠야 하면 "- "로 시작하는 줄로 충분하다."""


def _load_daily_prompts() -> dict:
    if os.path.exists(DAILY_PROMPTS_FILE):
        try:
            with open(DAILY_PROMPTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_daily_prompts(prompts: dict) -> None:
    with open(DAILY_PROMPTS_FILE, "w", encoding="utf-8") as f:
        json.dump(prompts, f, ensure_ascii=False, indent=2)


def _man(v) -> str:
    """원 → '1,063만' 문자열. 일 리뷰는 만원 고정(백만원은 일 값을 0~수십으로 뭉갠다)."""
    try:
        return f"{round(float(v) / 10_000):,}만"
    except Exception:
        return "-"


def _build_daily_context(s: dict) -> str:
    """일 리뷰 응답(summary) → 한국어 데이터 컨텍스트. 원시 시계열은 넣지 않는다."""
    m, fr, snap = s.get("meta", {}), s.get("data_freshness", {}), s.get("accrual_snapshot", {})
    pace, anom = s.get("mtd_pace", {}), s.get("anomalies", {})
    L: list[str] = []

    flags = m.get("day_flags") or []
    flag_txt = " · ".join(FLAG_LABEL_KO.get(f, f) for f in flags) if flags else "없음"
    L.append(f"[기준일] {m.get('target_date')}({m.get('weekday')}) · DOM {m.get('dom')}/{m.get('days_in_month')} · 플래그: {flag_txt}")
    L.append(f"[데이터] 최종 계상일 {fr.get('latest_core_date')} · 파일 {m.get('filename')}"
             + (" · 데이터 미도착(stale)" if fr.get("stale") else "")
             + (" · 잠정(최근 45일은 ERP 소급 정정 대상)" if fr.get("provisional") else ""))

    a, b, t = snap.get("a_group", {}), snap.get("b_group", {}), snap.get("total", {})
    L.append("[계상 현황] " + f"A군(일 단위 해석 가능) 순매출 {_man(a.get('net'))} / B군(배치) {_man(b.get('net'))} / 전사 {_man(t.get('net'))}"
             + f" (전사 총매출 {_man(t.get('gross'))}, 반품 {_man(t.get('returns'))})")

    ach = snap.get("a_channels") or []
    if ach:
        L.append(f"[A군 채널 위치] 같은 {m.get('weekday')}요일 8주 범위 기준")
        for c in ach:
            L.append(f"  - {c.get('channel')}: 당일 {_man(c.get('net'))} (범위 {_man(c.get('ref_min'))}~{_man(c.get('ref_max'))}, 중앙값 {_man(c.get('ref_median'))}) → {c.get('position')}")

    flags_list = anom.get("flags") or []
    if flags_list:
        L.append(f"[확인 필요 예외] {len(flags_list)}건")
        for i, f in enumerate(flags_list, 1):
            over = (f.get("value", 0) - f.get("ref_max", 0)) if f.get("kind") == "surge" else (f.get("ref_min", 0) - f.get("value", 0))
            L.append(f"  {i}. {'급증' if f.get('kind') == 'surge' else '급감'} · "
                     f"{'채널' if f.get('level') == 'channel' else '거래처'} {f.get('entity_display')}: "
                     f"당일 {_man(f.get('value'))}, 8주 범위 {_man(f.get('ref_min'))}~{_man(f.get('ref_max'))}"
                     f"(중앙값 {_man(f.get('ref_median'))}), {'최대치' if f.get('kind') == 'surge' else '최소치'} {_man(abs(over))} "
                     f"{'초과' if f.get('kind') == 'surge' else '미달'}, 유효관측 {f.get('ref_valid')}/8")
    else:
        L.append("[확인 필요 예외] 0건" + (f" — {anom.get('suppressed_reason')}" if anom.get("suppressed_reason") else ""))

    # 월 페이스 — 착지 금액은 없다(스키마에 필드 자체가 없음)
    if pace:
        line = f"[월 페이스] {pace.get('month')} · MTD 순매출 {_man(pace.get('mtd', {}).get('net'))}"
        if pace.get("target"):
            line += f" / 월 목표 {_man(pace.get('target'))}"
        line += f" · 진행률 {pace.get('dom')}/{pace.get('days_in_month')}"
        L.append(line)
        band, es = pace.get("expected_mtd_band"), pace.get("expected_share")
        if band and es:
            L.append(f"  기대 누계 {_man(band.get('low'))}~{_man(band.get('high'))} (실측 진척률 중앙값 {es.get('med')}%) → {pace.get('band_position')}")
        elif pace.get("suppressed_reason"):
            L.append(f"  {pace.get('suppressed_reason')}")
        if pace.get("achievement_pct") is not None and pace.get("is_month_final"):
            L.append(f"  월 최종 달성률 {pace.get('achievement_pct')}%")
        br = pace.get("base_rate")
        if br:
            L.append(f"  참고 base rate: 최근 {br.get('n_months')}개월 평균 목표 달성률 {br.get('mean_achievement')}%, 100% 달성 {br.get('hit_100_count')}회 "
                     f"(밴드 하회는 흔하므로 경보로 읽지 말 것)")

    checks = [e for e in (s.get("bgroup_events") or []) if e.get("kind") == "check"]
    if checks:
        L.append("[B군 계상 이벤트 — 확인]")
        for e in checks:
            L.append(f"  - {e.get('channel')}: {e.get('message')}")

    # 심화 감시는 '범위 밖'만 (컨텍스트를 짧게)
    out_lines = []
    for label, key, namer in (("거래처", "top_vendors", lambda x: x.get("account_display")),
                              ("브랜드", "top_brands", lambda x: x.get("brand")),
                              ("상품", "top_products", lambda x: x.get("name"))):
        rows = [r for r in (snap.get(key) or []) if r.get("position") not in ("범위 내", "표본 부족")]
        for r in rows:
            out_lines.append(f"  - {label} {namer(r)}: 당일 {_man(r.get('net'))} (중앙값 {_man(r.get('ref_median'))}) → {r.get('position')}")
    if out_lines:
        L.append("[심화 감시 — 범위 밖] (게이트 미만이면 예외 카드로는 올리지 않은 것)")
        L.extend(out_lines)

    sl = s.get("silence_log") or {}
    if sl.get("coverage_pct") is not None:
        L.append(f"[감시 범위] A군 채널 = 전사 순매출의 {sl.get('coverage_pct')}%. "
                 f"나머지는 배치 계상(쿠팡 사입·다이소 등)이라 일 단위 이상 감지가 불가능하다.")
    return "\n".join(L)


FLAG_LABEL_KO = {
    "month_end_batch": "월말 마감 계상일",
    "post_gap": "연휴·결측 직후",
    "return_batch": "반품 배치일",
}


def _daily_guide() -> str:
    """사용자 저장 지침 우선, 없으면 코드 동봉 기본값."""
    return (_load_daily_prompts().get("default") or "").strip() or DEFAULT_GUIDE


def _needs_llm(s: dict) -> bool:
    """LLM을 부를 가치가 있는 날인가.

    규칙 12의 '카드가 못 하는 3가지'가 하나라도 있어야 부른다:
    ① 예외 카드 ② 심화 감시 범위 밖 ③ 플래그(월말·연휴직후·반품배치) / B군 확인.
    셋 다 없으면 LLM 없이 고정 문구 — 비용도 환각도 0.
    """
    if s.get("anomalies", {}).get("flags"):
        return True
    if s.get("meta", {}).get("day_flags"):
        return True
    if any(e.get("kind") == "check" for e in (s.get("bgroup_events") or [])):
        return True
    snap = s.get("accrual_snapshot", {})
    for key in ("top_vendors", "top_brands", "top_products"):
        if any(r.get("position") not in ("범위 내", "표본 부족") for r in (snap.get(key) or [])):
            return True
    return False


class DailyPromptRequest(BaseModel):
    prompt: str


class DailyAIRequest(BaseModel):
    summary: dict
    api_key: Optional[str] = None


@router.get("/analysis-prompt/")
def get_daily_prompt():
    saved = (_load_daily_prompts().get("default") or "").strip()
    return {"prompt": saved or DEFAULT_GUIDE, "is_default": not saved}


@router.post("/analysis-prompt/")
def set_daily_prompt(req: DailyPromptRequest):
    prompts = _load_daily_prompts()
    prompts["default"] = req.prompt
    try:
        _save_daily_prompts(prompts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프롬프트 저장 실패: {e}")
    return {"prompt": req.prompt, "is_default": False}


@router.post("/ai-analysis/")
def run_daily_ai_analysis(req: DailyAIRequest):
    s = req.summary or {}
    if s.get("status") != "ok":
        raise HTTPException(status_code=400, detail="분석할 수 있는 계상일 데이터가 아닙니다.")

    # 예외·플래그·범위밖이 하나도 없으면 LLM을 부르지 않는다(비용·환각 0).
    if not _needs_llm(s):
        pace = s.get("mtd_pace", {})
        line = ""
        if pace.get("band_position"):
            line = f" 월 페이스는 {pace['band_position']}입니다(밴드 하회는 흔하므로 경보로 읽지 마세요)."
        return {
            "analysis": f"특이사항 없음. A군 채널·거래처·브랜드·상품이 모두 같은 요일 8주 범위 안이고 플래그도 없습니다.{line}",
            "llm_called": False,
        }

    api_key = _resolve_api_key(req.api_key)
    if not api_key:
        raise HTTPException(status_code=400, detail="API Key가 설정되지 않았습니다. 관리자에게 문의하세요.")

    context = _build_daily_context(s)
    m = s.get("meta", {})
    full_prompt = (
        "당신은 매출 데이터 분석 전문가입니다.\n"
        f"아래 [데이터]는 {m.get('target_date')}({m.get('weekday')}) 계상 기준의 일 리뷰 집계입니다.\n"
        "[반드시 지킬 규칙]은 [분석 지침]보다 우선합니다. 한국어로 작성하세요.\n\n"
        f"{HARD_RULES}\n\n"
        f"[분석 지침]\n{_daily_guide()}\n\n"
        f"[데이터]\n{context}\n"
    )

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-3.5-flash")
        resp = model.generate_content(full_prompt)
        return {"analysis": resp.text, "llm_called": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 분석 실패: {e}")
