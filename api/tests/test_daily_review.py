"""일 리뷰 골든 테스트.

여기 박힌 숫자는 260615.csv에 대한 회귀 테스트지 '진실'에 대한 테스트가 아니다.
ERP 스냅샷은 과거일을 소급 정정한다(260707 vs 260713에서 2026-06-30 자사몰 -20,927,184 확인).
그래서 fixture 파일을 260615.csv로 고정한다. 다른 파일로 돌리면 값이 달라지는 것이 정상이다.

기대값 출처: 3중 독립구현 백테스트(2026-07-13)로 확정.
실행: PYTHONPATH=api pytest api/tests/test_daily_review.py
"""
import pytest

from daily_review import get_daily_review_summary

FIXTURE = "260615.csv"


@pytest.fixture(scope="module")
def d0612():
    return get_daily_review_summary(filename=FIXTURE, target_date="2026-06-12")


# ---------------------------------------------------------------- A/B 판정

def test_a_group_is_exactly_six_channels(d0612):
    a = [c["name"] for c in d0612["channel_classification"]["channels"] if c["group"] == "A"]
    assert set(a) == {"자사몰", "오픈마켓(위탁)", "할인점", "종합몰", "버티컬커머스", "폐쇄몰"}


def test_ab_window_is_60_normal_core_days(d0612):
    w = d0612["channel_classification"]["window"]
    assert (w["start"], w["end"], w["n"]) == ("2026-03-13", "2026-06-12", 60)


@pytest.mark.parametrize("channel,density,net60", [
    ("자사몰", 1.000, 199_908_080),
    ("오픈마켓(위탁)", 1.000, 172_222_703),
    ("할인점", 0.983, 93_199_574),
    ("종합몰", 1.000, 36_970_206),
    ("버티컬커머스", 1.000, 24_477_299),
    ("폐쇄몰", 1.000, 17_477_345),
])
def test_a_channel_stats(d0612, channel, density, net60):
    c = next(x for x in d0612["channel_classification"]["channels"] if x["name"] == channel)
    assert c["density"] == pytest.approx(density, abs=0.001)
    assert c["net_60d"] == pytest.approx(net60, abs=1)


def test_coupang_density_counts_accrual_not_rows(d0612):
    """2026-06-12에 쿠팡 사입은 행이 26개 있으나 판매액이 전부 0원이다.

    '행 존재'로 세면 밀도 0.483, '순매출 != 0'으로 세면 0.433. 후자가 맞다.
    """
    c = next(x for x in d0612["channel_classification"]["channels"] if x["name"] == "오픈마켓(사입)")
    assert c["group"] == "B"
    assert c["density"] == pytest.approx(0.433, abs=0.001)


def test_junk_channels_are_not_listed(d0612):
    """채널구분이 비었거나('nan') 창 안에서 한 번도 계상되지 않은 채널은 화면에 올리지 않는다."""
    names = [c["name"] for c in d0612["channel_classification"]["channels"]]
    assert "미분류" not in names
    for dead in ("공통", "마케팅팀", "물류관리팀"):
        assert dead not in names
    assert all(c["days_seen"] > 0 for c in d0612["channel_classification"]["channels"])


def test_coverage_is_about_39_percent(d0612):
    """A군은 전사 순매출의 40% 안팎만 커버한다. 이 숫자는 화면에서 숨기지 않는다."""
    assert d0612["silence_log"]["coverage_pct"] == pytest.approx(39.2, abs=0.1)


# ---------------------------------------------------------------- 예외 판정

def test_20260612_has_exactly_two_anomalies(d0612):
    flags = d0612["anomalies"]["flags"]
    assert len(flags) == 2
    by_level = {f["level"]: f for f in flags}

    ch = by_level["channel"]
    assert ch["entity"] == "오픈마켓(위탁)" and ch["kind"] == "surge"
    assert ch["value"] == pytest.approx(6_454_562, abs=1)
    assert ch["ref_min"] == pytest.approx(451_532, abs=1)
    assert ch["ref_max"] == pytest.approx(4_004_088, abs=1)

    ac = by_level["account"]
    assert "11st" in ac["entity"] and ac["kind"] == "surge"
    assert ac["value"] == pytest.approx(5_843_645, abs=1)


def test_reference_dates_are_same_weekday(d0612):
    """참조표본은 같은 요일(금) 직전 8개 정상 코어일이다."""
    refs = d0612["accrual_snapshot"]["ref_dates"]
    assert refs == ["2026-04-10", "2026-04-17", "2026-04-24", "2026-05-08",
                    "2026-05-15", "2026-05-22", "2026-05-29", "2026-06-05"]


def test_quiet_day_has_no_anomalies():
    """판정일의 절반 이상은 예외 0건이어야 한다. 조용한 날은 화면이 짧다."""
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-06-11")
    assert r["anomalies"]["flags"] == []
    assert r["anomalies"]["suppressed_reason"] is None


def test_month_end_suppresses_anomalies():
    """월말 마감일은 전 채널이 동시 계상되므로 예외 판정을 하지 않는다.

    억제하지 않으면 2026-04-30에 10건이 뜨고 최상단을 ERP 조정 전표가 차지한다.
    """
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-05-31")
    assert "month_end_batch" in r["meta"]["day_flags"]
    assert r["anomalies"]["flags"] == []
    assert "월말" in r["anomalies"]["suppressed_reason"]


def test_post_gap_suppresses_surge():
    """연휴 직후 첫 계상일은 밀린 마감이 하루에 실린다. 급증 판정을 하지 않는다."""
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-02-19")
    assert "post_gap" in r["meta"]["day_flags"]
    assert r["meta"]["gap_days"] >= 4
    assert not any(f["kind"] == "surge" for f in r["anomalies"]["flags"])


# ---------------------------------------------------------------- 반품 3분할

def test_return_batch_day_splits_correctly():
    """2026-06-05는 '판매 부진일'이 아니라 '반품 처리일'이다.

    전사 순매출 135만원만 보면 오독한다. A군은 533만원으로 멀쩡하고 반품은 B군에 몰려 있다.
    """
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-06-05")
    s = r["accrual_snapshot"]
    assert "return_batch" in r["meta"]["day_flags"]
    assert s["total"]["gross"] == pytest.approx(7_848_060, abs=1)
    assert s["total"]["returns"] == pytest.approx(-6_497_400, abs=1)
    assert s["total"]["net"] == pytest.approx(1_350_660, abs=1)
    assert s["a_group"]["net"] == pytest.approx(5_338_402, abs=1)
    assert s["b_group"]["net"] == pytest.approx(-3_987_742, abs=1)


# ---------------------------------------------------------------- MTD 페이스

def test_profile_anchor_at_dom12(d0612):
    """진행률 40%(30일월 DOM12)의 기대 진척률은 32.3%다.

    균등 안분(40%)이 아니다. 매출의 47%가 월요일, 18.8%가 월말 3거래일에 몰리기 때문.
    """
    p = d0612["mtd_pace"]
    assert p["progress_ratio"] == pytest.approx(0.40, abs=0.001)
    assert p["expected_share"]["med"] == pytest.approx(32.3, abs=0.1)
    assert p["expected_share"]["p25"] == pytest.approx(27.8, abs=0.1)
    assert p["expected_share"]["p75"] == pytest.approx(37.4, abs=0.1)


def test_learning_window_is_17_months(d0612):
    """2023~24는 월 전량이 1일에 계상되고, 2021~22는 회계 리듬이 다르다. 2025-01부터만 학습한다."""
    months = d0612["mtd_pace"]["learned_months"]
    assert len(months) == 17
    assert months[0] == "2025-01" and months[-1] == "2026-05"


def test_base_rate_is_shown_so_target_ratio_is_never_a_red_light(d0612):
    """17개월 평균 달성률 80%, 100% 달성 2회. 목표비를 신호등으로 쓰면 상시 빨강이 된다."""
    br = d0612["mtd_pace"]["base_rate"]
    assert br["n_months"] == 17
    assert br["mean_achievement"] == pytest.approx(80.0, abs=0.5)
    assert br["hit_100_count"] == 2


def test_pace_index_hidden_before_dom20(d0612):
    """착지 오차가 DOM10 31% / DOM15 20% / DOM20 9.7%. 페이스 지수는 DOM20부터만."""
    assert d0612["meta"]["dom"] == 12
    assert d0612["mtd_pace"]["pace_index"] is None


def test_early_month_suppresses_band():
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-06-05")
    p = r["mtd_pace"]
    assert p["expected_mtd_band"] is None
    assert "월초" in p["suppressed_reason"]
    assert p["base_rate"] is not None      # 밴드가 억제돼도 base rate는 나와야 한다


def test_month_final_reports_achievement_not_band():
    """진행률 100%면 기대 밴드가 목표 한 점으로 붕괴한다. 달성률로 말해야 한다."""
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-05-31")
    p = r["mtd_pace"]
    assert p["is_month_final"] is True
    assert p["expected_mtd_band"] is None
    assert p["achievement_pct"] == pytest.approx(94.3, abs=0.2)


# ---------------------------------------------------------------- 스키마 계약

def test_forbidden_fields_do_not_exist(d0612):
    """만들 수 없으면 그릴 수 없다.

    전일비는 요일 효과가 259배(월 4,928만 vs 토 19만)라 잡음이고,
    착지 금액은 DOM10 오차가 31%다. 필드 자체를 두지 않는다.
    """
    import json
    blob = json.dumps(d0612, ensure_ascii=False)
    for forbidden in ('"dod"', '"yoy"', '"landing"', '"landing_range"', '"prev_day"'):
        assert forbidden not in blob


def test_bgroup_has_no_daily_series(d0612):
    """B군은 계상 이벤트만. 금액 시계열을 주지 않으므로 차트를 그릴 수 없다."""
    for e in d0612["bgroup_events"]:
        assert e["kind"] in ("info", "check")
        assert "series" not in e and "dates" not in e
        assert "severity" not in e          # B군에서 '나쁨' 판정을 내리지 않는다


def test_non_core_day_is_rejected_with_suggestion():
    """13,680원짜리 토요일이 '특이사항 없음'을 띄우면 안 된다."""
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-06-06")
    assert r["status"] == "non_core_day"
    assert r["suggestion"] == "2026-06-05"


def test_provisional_flag_for_recent_dates(d0612):
    """ERP는 과거 45일을 소급 정정한다. 최근 판정은 잠정이다."""
    assert d0612["data_freshness"]["provisional"] is True
    assert d0612["meta"]["file_hash"]      # 아카이브 시 스냅샷을 핀으로 박을 수 있어야 한다
