"""일 리뷰 골든 테스트.

여기 박힌 숫자는 260615.csv에 대한 회귀 테스트지 '진실'에 대한 테스트가 아니다.
ERP 스냅샷은 과거일을 소급 정정한다(260707 vs 260713에서 2026-06-30 자사몰 -20,927,184 확인).
그래서 fixture 파일을 260615.csv로 고정한다. 다른 파일로 돌리면 값이 달라지는 것이 정상이다.

기대값 출처: 3중 독립구현 백테스트(2026-07-13)로 확정.
실행: PYTHONPATH=api pytest api/tests/test_daily_review.py
"""
import numpy as np
import pytest

from daily_review import (
    get_daily_review_summary,
    _bevent_gap_status,
    _alias,
    _build_daily_context,
    _needs_llm,
    _daily_guide,
    run_daily_ai_analysis,
    DailyAIRequest,
    BEVENT_DORMANT_DAYS,
    ACCOUNT_ALIAS,
    HARD_RULES,
    DEFAULT_GUIDE,
)

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


# ---------------------------------------------------------------- B군 계상 지연 → 휴면
# 중단된 채널(예: 발주를 접은 쿠팡 사입)이 매일 '확인'을 영원히 띄우는 버그의 회귀 방지.

FREQUENT_GAPS = [1, 1, 2, 1, 3, 1, 2, 1, 2, 1]   # 자주 계상되던 채널(쿠팡 사입 성격). thr는 작다.


def test_normal_rhythm_is_info():
    """통상 리듬 안이면 확인을 띄우지 않는다."""
    s = _bevent_gap_status(1, FREQUENT_GAPS)
    assert s["kind"] == "info" and s["dormant"] is False


def test_fresh_delay_raises_check():
    """지연이 새로우면(통상 간격의 2배 초과 ~ 상한 이내) 확인을 띄운다."""
    s = _bevent_gap_status(12, FREQUENT_GAPS)
    assert s["kind"] == "check" and s["dormant"] is False
    assert "계상 지연" in s["message"]


def test_long_dormancy_goes_quiet_not_check():
    """★ 상한(30일)을 크게 넘으면 중단·휴면으로 보고 매일 확인을 띄우지 않는다.

    이것이 이번 수정의 핵심: 발주를 접은 채널이 경과일만 늘며 영원히 '확인'을 띄우던 버그.
    """
    s = _bevent_gap_status(90, FREQUENT_GAPS)
    assert s["kind"] == "info"          # check 가 아니다
    assert s["dormant"] is True
    assert "중단" in s["message"] or "휴면" in s["message"]


def test_dormancy_ceiling_is_around_30_days():
    """자주 계상되던 채널은 상한(BEVENT_DORMANT_DAYS) 근처에서 확인 → 휴면으로 전환된다."""
    below = _bevent_gap_status(BEVENT_DORMANT_DAYS, FREQUENT_GAPS)
    above = _bevent_gap_status(BEVENT_DORMANT_DAYS * 3, FREQUENT_GAPS)
    assert below["kind"] == "check"
    assert above["dormant"] is True


def test_sparse_channel_not_falsely_dormant():
    """통상 주기가 긴 희소 채널은 정상 간격을 휴면으로 오탐하지 않는다.

    상한 = max(30, thr×2)이라, 40일마다 계상되는 채널의 45일 경과는 '지연'이지 '휴면'이 아니다.
    """
    sparse = [38, 42, 40, 39, 41]        # 통상 ~40일 주기
    s = _bevent_gap_status(45, sparse)
    assert s["dormant"] is False          # 30일을 넘었지만 이 채널엔 정상 범위에 가깝다


def test_insufficient_sample_stays_info():
    """간격 표본이 3개 미만이면 판정하지 않는다."""
    s = _bevent_gap_status(120, [5, 5])
    assert s["kind"] == "info" and s["dormant"] is False


def test_every_bevent_has_dormant_key(d0612):
    """프론트가 dormant 필드를 읽으므로 항상 존재해야 한다."""
    for e in d0612["bgroup_events"]:
        assert "dormant" in e and isinstance(e["dormant"], bool)


# ---------------------------------------------------------------- 거래처 별칭 + 주요 거래처 감시 (신 1순위)

def test_alias_is_display_only():
    """별칭은 매핑에 있는 것만 치환, 없으면 원본 그대로. 매칭이 아니라 표시 전용이다."""
    assert _alias("11st") == "11번가"
    assert _alias("이베이") == "지마켓"
    assert _alias("스팜(제제지크)") == "제제스스"
    assert _alias("듣도보도못한거래처") == "듣도보도못한거래처"


def test_anomaly_keeps_raw_entity_and_adds_display(d0612):
    """entity는 원본(참조·매칭용), entity_display는 별칭 적용. 2026-06-12 계좌 예외 = 11st."""
    acc = next(f for f in d0612["anomalies"]["flags"] if f["level"] == "account")
    assert "11st" in acc["entity"]                       # 원본 보존(기존 골든 테스트 계약)
    assert "11번가" in acc["entity_display"]              # 표시명 별칭
    assert acc["entity"] != acc["entity_display"]


def test_top_vendors_are_a_group_and_aliased(d0612):
    """주요 거래처 감시 = A군 채널 거래처만, 별칭 적용, 순매출 상위."""
    tv = d0612["accrual_snapshot"]["top_vendors"]
    assert 1 <= len(tv) <= 8
    a_channels = {c["name"] for c in d0612["channel_classification"]["channels"] if c["group"] == "A"}
    names = {v["account"] for v in tv}
    displays = {v["account_display"] for v in tv}
    # 월 리뷰 심층 거래처가 사람이 아는 이름으로 들어온다
    assert "11번가" in displays and "제제스스" in displays
    # 배치 채널 거래처는 없다(쿠팡 로켓 사입, 다이소)
    assert "쿠팡(로켓)" not in names and "다이소" not in names
    for v in tv:
        assert v["channel"] in a_channels                 # 전부 A군 채널 소속
    # 60일 순매출 내림차순
    net60 = [v["net_60d"] for v in tv]
    assert net60 == sorted(net60, reverse=True)


def test_top_vendors_position_matches_anomaly(d0612):
    """예외 카드로 오른 거래처(11st)는 주요 거래처 감시에서도 '범위 상단 초과'여야 한다(같은 데이터)."""
    tv = {v["account"]: v for v in d0612["accrual_snapshot"]["top_vendors"]}
    assert tv["11st"]["position"] == "범위 상단 초과"


def test_top_vendor_insufficient_sample_labeled():
    """같은 요일 유효관측이 6 미만이면 위치를 단정하지 않고 '표본 부족'으로 둔다."""
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-06-12")
    for v in r["accrual_snapshot"]["top_vendors"]:
        if v["ref_n"] < 6:
            assert v["position"] == "표본 부족"
        else:
            assert v["position"] in ("범위 내", "범위 상단 초과", "범위 하단 미만")


def test_alias_never_touches_matching_key():
    """별칭 dict의 키는 실제 ERP 거래처명이어야 한다(오타로 매칭 깨지지 않게)."""
    # 최소한 핵심 5개가 별칭 맵에 있다
    for raw in ("11st", "이베이", "스팜(제제지크)", "스팜(쏭레브)", "쿠팡"):
        assert raw in ACCOUNT_ALIAS


# ---------------------------------------------------------------- 심화 감시: 브랜드 + 상품 (48회차 다음단계)

def test_brand_watch_is_three_brands_a_scoped(d0612):
    """브랜드 감시 = 마이비/누비/쏭레브 3개, 고정 순서, A군 스코프."""
    brands = [b["brand"] for b in d0612["accrual_snapshot"]["top_brands"]]
    assert brands == ["마이비", "누비", "쏭레브"]     # 매출순이 아니라 브랜드 정체성 축(고정)


def test_brand_a_scope_is_clean_songrev_flagged_variance(d0612):
    """A군 스코프 시 마이비·누비는 CV 낮고(안정), 쏭레브는 변동 큼(48회차 실측)."""
    bymap = {b["brand"]: b for b in d0612["accrual_snapshot"]["top_brands"]}
    assert bymap["마이비"]["cv"] is not None and bymap["마이비"]["cv"] < 1.0
    assert bymap["누비"]["cv"] < 1.0
    assert bymap["쏭레브"]["high_variance"] is True     # 톤업크림 스파이크로 A군에서도 노이즈


def test_product_watch_a_scoped_named_and_capped(d0612):
    """상품 감시 = A군 상품 top-N(코드+품목명), 60일 순매출 내림차순."""
    prods = d0612["accrual_snapshot"]["top_products"]
    assert 1 <= len(prods) <= 8
    for p in prods:
        assert p["code"] and p["name"]
        assert p["net_60d"] >= 0
    net60 = [p["net_60d"] for p in prods]
    assert net60 == sorted(net60, reverse=True)


def test_products_not_promoted_to_anomaly_cards(d0612):
    """상품은 예외 카드로 올리지 않는다(연 101건 → 조용한 날 45%로 원칙 위반). 감시 패널 전용."""
    for f in d0612["anomalies"]["flags"]:
        assert f["level"] in ("channel", "account")     # product 레벨 예외 카드는 없다


# ---------------------------------------------------------------- AI 분석 (50회차)

def test_context_has_no_raw_daily_series(d0612):
    """AI에 일별 원시 시계열을 주지 않는다. 컨텍스트는 MTD·플래그·예외·심화감시 요약뿐."""
    ctx = _build_daily_context(d0612)
    # 날짜가 여러 개 나열된 시계열 흔적이 없어야 한다(참조일 목록은 컨텍스트에 넣지 않음)
    assert ctx.count("2026-") <= 3          # 기준일·최종계상일·월 정도만
    assert "[기준일]" in ctx and "[계상 현황]" in ctx and "[월 페이스]" in ctx


def test_context_carries_the_things_cards_cannot_say(d0612):
    """규칙 12의 근거 — 카드에 없는 심화 감시(게이트 미만) 항목이 컨텍스트에 들어가야 한다.

    2026-06-12: 11번가 급증과 함께 삶기세탁세제 리필이 192만(중앙값 10만)으로 튀었는데
    게이트 미만이라 예외 카드에는 없다. 이게 AI가 더할 수 있는 유일한 값어치다.
    """
    ctx = _build_daily_context(d0612)
    assert "[심화 감시 — 범위 밖]" in ctx
    assert "삶기세탁세제" in ctx


def test_context_states_coverage_limit(d0612):
    """감시 범위를 넘어 전사를 단정하지 못하게 컨텍스트가 한계를 명시한다(규칙 6)."""
    ctx = _build_daily_context(d0612)
    assert "[감시 범위]" in ctx and "%" in ctx


def test_hard_rules_cover_the_design_invariants():
    """하드룰은 코드 상수 — 사용자가 못 고친다. 이 설계의 금지 항목이 전부 들어 있어야 한다."""
    for must in ("전일비", "전년 동일자", "착지", "계상", "배치"):
        assert must in HARD_RULES
    # 재탕 금지(12)·범위내 나열 금지(13)·건수 표기(11)·자기모순 금지(10)
    assert "카드 건수를 먼저 밝히고" in HARD_RULES
    assert "'범위 내'인 항목을 금액과 함께 나열하지 마라" in HARD_RULES


def test_default_guide_ships_with_code():
    """월 리뷰는 프롬프트가 비면 400인데, 일 리뷰는 매일 쓰는 화면이라 기본값으로 바로 동작해야 한다."""
    assert _daily_guide().strip() == DEFAULT_GUIDE.strip()


def test_needs_llm_true_when_any_signal(d0612):
    """예외·플래그·B군확인·심화감시 범위밖 중 하나라도 있으면 LLM을 부른다."""
    assert _needs_llm(d0612) is True


def test_quiet_day_skips_llm_entirely():
    """신호가 하나도 없는 날은 LLM 미호출 — 비용도 환각도 0. (2026-05-21 실측 조용한 날)"""
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-05-21")
    assert _needs_llm(r) is False
    res = run_daily_ai_analysis(DailyAIRequest(summary=r))
    assert res["llm_called"] is False
    assert "특이사항 없음" in res["analysis"]


def test_ai_rejects_non_core_day():
    """계상일이 아닌 날은 분석 대상이 아니다."""
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-06-06")   # 토요일
    assert r["status"] == "non_core_day"
    with pytest.raises(Exception):
        run_daily_ai_analysis(DailyAIRequest(summary=r))


def test_watch_axes_all_a_group_only(d0612):
    """거래처·브랜드·상품 감시 전부 A군 스코프 — 배치 채널(쿠팡 로켓 사입) 상품/거래처가 섞이면 오염."""
    s = d0612["accrual_snapshot"]
    # 쿠팡 로켓(사입) 상품인 구형 얼룩제거제(1006032 등)가 상품 감시 상위에 오지 않는다(A군 스코프라 신형만)
    codes = {p["code"] for p in s["top_products"]}
    # 신형 플러스(A군 지배)가 있고, 구형(쿠팡 지배)은 A군 net이 작아 밀린다
    assert any("플러스" in p["name"] for p in s["top_products"])


def test_non_core_day_is_rejected_with_suggestion():
    """13,680원짜리 토요일이 '특이사항 없음'을 띄우면 안 된다."""
    r = get_daily_review_summary(filename=FIXTURE, target_date="2026-06-06")
    assert r["status"] == "non_core_day"
    assert r["suggestion"] == "2026-06-05"


def test_provisional_flag_for_recent_dates(d0612):
    """ERP는 과거 45일을 소급 정정한다. 최근 판정은 잠정이다."""
    assert d0612["data_freshness"]["provisional"] is True
    assert d0612["meta"]["file_hash"]      # 아카이브 시 스냅샷을 핀으로 박을 수 있어야 한다
