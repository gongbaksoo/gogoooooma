"""
월 리뷰 (Monthly Review) 집계 모듈.

PPT 월간 리뷰 보고서를 화면에서 재현하기 위한 집계 엔드포인트.
Phase 1: 종합 슬라이드 차트 3개 (목표비 실적 / 전년비 트렌드 / 주력 vs 쿠팡사입).
"""
import os
import json
import logging
import re
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel

from dashboard import get_dataframe
from database import get_file_from_db

router = APIRouter(prefix="/monthly-review", tags=["monthly-review"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
TARGETS_DIR = os.path.join(BASE_DIR, "uploads", "targets")
os.makedirs(TARGETS_DIR, exist_ok=True)


def _ensure_file_on_disk(filename: str) -> bool:
    """업로드 파일이 디스크에 없으면 DB에서 가져와 기록.

    upload 엔드포인트는 DB에만 저장하므로 pandas로 읽기 전에 이 단계가 필요.
    `index.py`의 ensure_file_on_disk와 동일 로직 — 순환 import 피하려고 복제.
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        return True
    file_data = get_file_from_db(filename)
    if not file_data:
        return False
    try:
        with open(file_path, "wb") as f:
            f.write(file_data)
        logging.info(f"Synchronized {filename} from DB to disk (monthly-review)")
        return True
    except Exception as e:
        logging.error(f"Failed to sync {filename} from DB: {e}")
        return False


def _load_dataframe(filename: str) -> pd.DataFrame:
    """디스크 동기화 후 DataFrame 로드."""
    if not _ensure_file_on_disk(filename):
        raise HTTPException(status_code=404, detail=f"파일 없음: {filename}")
    try:
        return get_dataframe(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"파일 없음: {filename}")

PART_LABELS = {
    "all": None,           # 필터 없음 (전체)
    "ecommerce": "이커머스",
    "offline": "오프라인",
}

PART_TO_TARGET_KEY = {
    "all": "전체",
    "ecommerce": "이커머스",
    "offline": "오프라인",
}


# ---------- helpers ----------

def _month_to_yymm(month: str) -> str:
    """'2026-04' → '2604'"""
    m = re.match(r"^(\d{4})-(\d{2})$", month or "")
    if not m:
        raise HTTPException(status_code=400, detail=f"잘못된 월 포맷: {month} (YYYY-MM 형식 필요)")
    yyyy, mm = m.group(1), m.group(2)
    return yyyy[-2:] + mm


def _yymm_to_month(yymm: str) -> str:
    """'2604' → '2026-04'"""
    s = str(yymm).zfill(4)
    return f"20{s[:2]}-{s[2:]}"


def _apply_part_filter(df: pd.DataFrame, part: str) -> pd.DataFrame:
    """파트구분 필터 적용. part='all'은 필터 없음."""
    if part not in PART_LABELS:
        raise HTTPException(status_code=400, detail=f"잘못된 파트: {part}")
    label = PART_LABELS[part]
    if label is None:
        return df
    if "파트구분" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV에 '파트구분' 컬럼이 없습니다.")
    return df[df["파트구분"] == label]


def _normalize_month_column(df: pd.DataFrame) -> pd.DataFrame:
    """월구분을 4자리 YYMM 문자열로 통일."""
    if "월구분" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV에 '월구분' 컬럼이 없습니다.")
    df = df.copy()
    df["월구분"] = df["월구분"].astype(str).str.replace(".0", "", regex=False).str.zfill(4)
    return df


def _load_targets(target_filename: Optional[str]) -> Optional[pd.DataFrame]:
    """목표 파일 로드. None이면 None 반환."""
    if not target_filename:
        return None
    path = os.path.join(TARGETS_DIR, target_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"목표 파일 없음: {target_filename}")
    try:
        # CSV는 utf-8 또는 cp949 가능성
        for enc in ["utf-8", "utf-8-sig", "cp949", "euc-kr"]:
            try:
                df = pd.read_csv(path, encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(status_code=400, detail="목표 파일 인코딩 인식 실패")
        df.columns = df.columns.astype(str).str.strip()
        required = {"월", "파트", "목표"}
        if not required.issubset(set(df.columns)):
            raise HTTPException(
                status_code=400,
                detail=f"목표 파일 컬럼 부족. 필요: {required}, 실제: {set(df.columns)}",
            )
        df["월"] = df["월"].astype(str).str.strip()
        df["파트"] = df["파트"].astype(str).str.strip()
        df["목표"] = pd.to_numeric(df["목표"], errors="coerce").fillna(0)
        return df
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("목표 파일 로드 실패")
        raise HTTPException(status_code=500, detail=f"목표 파일 로드 실패: {e}")


# 브랜드별 목표 파일 (월/브랜드/목표) — '전사' 시트에서 추출, 전사(전 파트) 기준.
# 브랜드 종합 요약 라인의 목표비(part=all)용. 마이비/누비/쏭레브/데일리케어/에코보만 존재.
# 업로드 런타임 데이터가 아닌 추출 레퍼런스라 코드와 함께 git 추적되는 경로(api/)에 둠 → 배포 시 git pull로 반영.
BRAND_TARGETS_FILE = os.path.join(BASE_DIR, "brand_targets.csv")


def _load_brand_targets() -> dict:
    """{ 'YYYY-MM': { 브랜드: 목표(원) } } 반환. 파일 없으면 빈 dict."""
    if not os.path.exists(BRAND_TARGETS_FILE):
        return {}
    try:
        df = None
        for enc in ["utf-8-sig", "utf-8", "cp949", "euc-kr"]:
            try:
                df = pd.read_csv(BRAND_TARGETS_FILE, encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        if df is None:
            return {}
        df.columns = df.columns.astype(str).str.strip()
        if not {"월", "브랜드", "목표"}.issubset(set(df.columns)):
            return {}
        df["월"] = df["월"].astype(str).str.strip()
        df["브랜드"] = df["브랜드"].astype(str).str.strip()
        df["목표"] = pd.to_numeric(df["목표"], errors="coerce").fillna(0)
        out: dict = {}
        for _, row in df.iterrows():
            out.setdefault(row["월"], {})[row["브랜드"]] = float(row["목표"])
        return out
    except Exception:
        logging.exception("브랜드 목표 파일 로드 실패")
        return {}


# ---------- endpoints ----------

@router.get("/months/")
def list_months(filename: str = Query(..., description="매출 CSV/XLSX 파일명")):
    """매출 파일에서 가용 월 목록을 인간 친화 포맷(YYYY-MM)으로 반환. 최신순."""
    df = _load_dataframe(filename)
    df = _normalize_month_column(df)
    yymm_list = sorted(df["월구분"].dropna().unique().tolist(), reverse=True)
    months = [_yymm_to_month(y) for y in yymm_list if re.match(r"^\d{4}$", str(y))]
    return {"months": months}


@router.get("/targets/")
def list_target_files():
    """목표 파일 목록."""
    if not os.path.exists(TARGETS_DIR):
        return {"files": []}
    files = []
    for name in os.listdir(TARGETS_DIR):
        if name.startswith("."):
            continue
        path = os.path.join(TARGETS_DIR, name)
        if os.path.isfile(path):
            files.append({
                "filename": name,
                "size": os.path.getsize(path),
                "modified": os.path.getmtime(path),
            })
    files.sort(key=lambda x: x["modified"], reverse=True)
    return {"files": files}


@router.post("/targets/")
async def upload_target_file(file: UploadFile = File(...)):
    """목표 파일 업로드 (CSV)."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드 가능합니다.")
    dst = os.path.join(TARGETS_DIR, file.filename)
    try:
        with open(dst, "wb") as f:
            f.write(await file.read())
        # 포맷 검증
        try:
            _load_targets(file.filename)
        except HTTPException as e:
            os.remove(dst)
            raise e
        return {"filename": file.filename, "size": os.path.getsize(dst)}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("목표 파일 업로드 실패")
        raise HTTPException(status_code=500, detail=f"업로드 실패: {e}")


@router.get("/summary/")
def get_summary(
    filename: str = Query(..., description="매출 파일명"),
    month: str = Query(..., description="대상 월 (YYYY-MM)"),
    part: str = Query("all", description="all | ecommerce | offline"),
    target_file: Optional[str] = Query(None, description="목표 파일명 (선택)"),
):
    """월 리뷰 종합 데이터 (chart 1, 2, 3).

    - chart1: 목표비 실적 — 목표 vs 실적 + 달성률
    - chart2: 전년비 트렌드 — 대상월 기준 직전 12개월 vs 같은 기간 1년 전
    - chart3: 주력 vs 쿠팡사입 — 최근 12개월
    """
    df = _load_dataframe(filename)

    df = _normalize_month_column(df)
    if "판매액" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV에 '판매액' 컬럼이 없습니다.")

    df_part = _apply_part_filter(df, part)
    target_yymm = _month_to_yymm(month)

    # ----- chart1: 목표비 실적 -----
    actual = float(df_part[df_part["월구분"] == target_yymm]["판매액"].sum())
    target_value = None
    targets_df = _load_targets(target_file)
    if targets_df is not None:
        key = PART_TO_TARGET_KEY[part]
        match = targets_df[(targets_df["월"] == month) & (targets_df["파트"] == key)]
        if not match.empty:
            target_value = float(match["목표"].iloc[0])

    achievement_rate = None
    if target_value and target_value > 0:
        achievement_rate = round(actual / target_value * 100, 1)

    chart1 = {
        "target": target_value,
        "actual": actual,
        "achievement_rate": achievement_rate,
    }

    # ----- 공통 헬퍼 -----
    def _month_total(year: int, month_num: int, frame: pd.DataFrame) -> float:
        yymm = f"{str(year)[-2:]}{str(month_num).zfill(2)}"
        return float(frame[frame["월구분"] == yymm]["판매액"].sum())

    # 대상 월부터 역순 n개월 생성 (오래된→최근 순서로 반환)
    def _months_back(yyyymm: str, n: int):
        y, m = int(yyyymm[:4]), int(yyyymm[5:7])
        out = []
        for _ in range(n):
            out.append((y, m))
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        return list(reversed(out))

    last12 = _months_back(month, 12)
    # 브랜드 트렌드(chart4)는 전년 동월 비교(전년비)를 위해 13개월: 대상월-12 ~ 대상월
    last13 = _months_back(month, 13)

    # ----- chart2: 전년비 트렌드 — 직전 12개월 vs 같은 기간 1년 전 -----
    chart2 = []
    for y, m in last12:
        chart2.append({
            "month": f"{y}-{str(m).zfill(2)}",
            "current_year": _month_total(y, m, df_part),
            "prev_year": _month_total(y - 1, m, df_part),
        })

    # ----- chart3: 파트별 동적 비교 — 최근 12개월 -----
    # part=all      → 이커머스 vs 오프라인 (파트구분 기반)
    # part=ecommerce → 주력채널 vs 쿠팡(사입) (주력채널 컬럼 기반)
    # part=offline  → 이마트 vs 롯데마트 vs 다이소 (거래처명 R열 기준)
    if part == "all":
        series_frames = [
            df[df["파트구분"] == "이커머스"],
            df[df["파트구분"] == "오프라인"],
        ]
        title = "이커머스 vs 오프라인"
        series_names = ["이커머스", "오프라인"]
        colors = ["#000000", "#5d5d5d"]
    elif part == "offline":
        if "거래처명" not in df.columns:
            raise HTTPException(status_code=400, detail="CSV에 '거래처명' 컬럼(R열)이 없습니다.")
        series_frames = [
            df_part[df_part["거래처명"] == "이마트"],
            df_part[df_part["거래처명"] == "롯데마트"],
            df_part[df_part["거래처명"] == "다이소"],
        ]
        title = "EM vs LM vs 다이소"
        series_names = ["이마트", "롯데마트", "다이소"]
        colors = ["#000000", "#5d5d5d", "#7d7d7d"]
    else:  # ecommerce
        if "주력 채널" not in df.columns:
            raise HTTPException(status_code=400, detail="CSV에 '주력 채널' 컬럼이 없습니다.")
        series_frames = [
            df_part[df_part["주력 채널"] == "주력"],
            df_part[df_part["주력 채널"] == "주력(쿠팡)"],
        ]
        title = "주력채널 vs 쿠팡(사입)"
        series_names = ["주력채널", "쿠팡(사입)"]
        colors = ["#000000", "#ff0066"]

    chart3_data = []
    for y, m in last12:
        yymm = f"{str(y)[-2:]}{str(m).zfill(2)}"
        chart3_data.append({
            "month": f"{y}-{str(m).zfill(2)}",
            "values": [float(f[f["월구분"] == yymm]["판매액"].sum()) for f in series_frames],
        })

    chart3 = {
        "title": title,
        "series_names": series_names,
        "colors": colors,
        "data": chart3_data,
    }

    # ----- 공통 헬퍼: 카테고리별 trailing 12개월 집계 -----
    def _trailing_series(category_frames: list, name: str, periods: list = None) -> dict:
        """N개 카테고리 frame 리스트 → trailing line chart 데이터 (기본 12개월, periods로 조정)"""
        months_iter = periods if periods is not None else last12
        return {
            "title": name,
            "data": [
                {
                    "month": f"{y}-{str(m).zfill(2)}",
                    "values": [
                        float(f[f["월구분"] == f"{str(y)[-2:]}{str(m).zfill(2)}"]["판매액"].sum())
                        for f in category_frames
                    ],
                }
                for y, m in months_iter
            ],
        }

    def _share_pie(category_frames: list, series_names_local: list) -> list:
        """N개 카테고리 frame → 최근 12개월 합계로 PieChart 데이터 [{name, value}]"""
        last12_yymm = {f"{str(y)[-2:]}{str(m).zfill(2)}" for y, m in last12}
        out = []
        for name, f in zip(series_names_local, category_frames):
            v = float(f[f["월구분"].isin(last12_yymm)]["판매액"].sum())
            out.append({"name": name, "value": v})
        return out

    def _grouped_bar(category_frames: list, series_names_local: list, current_yymm: str) -> list:
        """N개 카테고리 × (월평균/당월) BarChart 데이터 [{category, monthly_avg, current_month}]"""
        last12_yymm_list = [f"{str(y)[-2:]}{str(m).zfill(2)}" for y, m in last12]
        out = []
        for name, f in zip(series_names_local, category_frames):
            total_12 = float(f[f["월구분"].isin(last12_yymm_list)]["판매액"].sum())
            monthly_avg = total_12 / 12 if last12_yymm_list else 0
            current = float(f[f["월구분"] == current_yymm]["판매액"].sum())
            out.append({
                "category": name,
                "monthly_avg": monthly_avg,
                "current_month": current,
            })
        return out

    # ----- 브랜드 분류 (df_part 기반: 파트 필터 적용 후) -----
    # D열(품목그룹1) 실제 고유값을 개별 브랜드로 노출 (판매액 desc 정렬).
    # 단, 비-브랜드 값(BRAND_ETC)과 빈값은 "기타" 한 칸으로 묶음.
    # 프론트 수정 모달에서 전체 브랜드를 선택할 수 있고, 기본은 상위 3개만 표시(프론트 처리).
    if "품목그룹1" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV에 '품목그룹1' 컬럼이 없습니다.")
    BRAND_ETC = ["기타(타사)", "부자재(공통)", "구브랜드"]
    _g1 = df_part["품목그룹1"]
    _is_etc = _g1.isna() | _g1.isin(BRAND_ETC) | (_g1.astype(str).str.strip() == "")
    brand_individual = (
        df_part[~_is_etc]
        .groupby("품목그룹1")["판매액"]
        .sum()
        .sort_values(ascending=False)
        .index.tolist()
    )
    brand_frames = [df_part[df_part["품목그룹1"] == b] for b in brand_individual]
    brand_frames.append(df_part[_is_etc])  # 기타: BRAND_ETC + 빈값
    brand_names = brand_individual + ["기타"]
    # colors는 프론트가 getMultiSeriesStyle 팔레트로 대체 → 길이 맞춰 placeholder만 전달
    brand_colors = ["#000000"] * len(brand_names)

    # chart4: 브랜드별 매출 트렌드 (라인, N-series, 13개월=대상월-12~대상월, 전년비용)
    chart4 = {
        "title": "브랜드별 매출 트렌드",
        "series_names": brand_names,
        "colors": brand_colors,
        "data": _trailing_series(brand_frames, "", periods=last13)["data"],
    }

    # chart5: 브랜드별 매출 비중 (파이, 최근 12개월 합계)
    chart5 = {
        "title": "브랜드별 매출 비중",
        "series_names": brand_names,
        "colors": brand_colors,
        "data": _share_pie(brand_frames, brand_names),
    }

    # chart6: 월 평균 대비 실적 (그룹드 바, 마+누+쏭 추가 카테고리)
    # 카테고리: 마이비/누비/쏭레브/마+누+쏭
    brand_sum_frame = pd.concat([df_part[df_part["품목그룹1"] == b] for b in ["마이비", "누비", "쏭레브"]])
    bar_cats = ["마이비", "누비", "쏭레브", "마+누+쏭"]
    bar_frames = [df_part[df_part["품목그룹1"] == b] for b in ["마이비", "누비", "쏭레브"]] + [brand_sum_frame]
    chart6 = {
        "title": "월 평균 대비 실적",
        "series_names": ["월평균", "당월"],
        "colors": ["#5d5d5d", "#000000"],
        "data": _grouped_bar(bar_frames, bar_cats, target_yymm),
    }

    # ----- 채널 옵션 (part별 동적) -----
    # all      → P열(채널구분) unique values 직접
    # ecommerce → 4 그룹 카테고리 (사입/위탁/자사몰/기타) — 기존 유지
    # offline   → P열(채널구분) unique values 직접 (오프라인 파트 row만)
    if "채널구분" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV에 '채널구분' 컬럼이 없습니다.")

    last12_yymm_set = [f"{str(y)[-2:]}{str(m).zfill(2)}" for y, m in last12]

    def _option_from_frame(name: str, f: pd.DataFrame) -> dict:
        """단일 옵션 = name + row_count + 12개월 values + monthly_avg + current_month"""
        values = [float(f[f["월구분"] == yymm]["판매액"].sum()) for yymm in last12_yymm_set]
        total_12 = sum(values)
        return {
            "name": name,
            "row_count": int(len(f)),
            "values": values,
            "monthly_avg": total_12 / 12 if values else 0.0,
            "current_month": float(f[f["월구분"] == target_yymm]["판매액"].sum()),
        }

    # all: P열 unique values 전부 (전체 df 기준)
    all_options = []
    for chan in sorted(df["채널구분"].dropna().unique().tolist()):
        f = df[df["채널구분"] == chan]
        all_options.append(_option_from_frame(str(chan), f))

    # ecommerce: P열 unique values (이커머스 파트 row만) — all/offline과 동일 패턴
    ec_df = df[df["파트구분"] == "이커머스"]
    ec_options = []
    for chan in sorted(ec_df["채널구분"].dropna().unique().tolist()):
        f = ec_df[ec_df["채널구분"] == chan]
        ec_options.append(_option_from_frame(str(chan), f))

    # offline: P열 unique values (오프라인 파트 row만)
    off_df = df[df["파트구분"] == "오프라인"]
    off_options = []
    for chan in sorted(off_df["채널구분"].dropna().unique().tolist()):
        f = off_df[off_df["채널구분"] == chan]
        off_options.append(_option_from_frame(str(chan), f))

    channel_options = {
        "all": all_options,
        "ecommerce": ec_options,
        "offline": off_options,
    }
    channel_defaults = {
        "all": ["오픈마켓(사입)", "오픈마켓(위탁)", "자사몰", "할인점"],
        "ecommerce": ["오픈마켓(사입)", "오픈마켓(위탁)", "종합몰", "버티컬커머스", "자사몰"],
        "offline": ["할인점", "다이소", "오프라인 대리점"],
    }

    # ----- 브랜드 상세 (chart 10~15) -----
    # 각 브랜드: 종합 트렌드 (단일 라인) + 주요 상품 라인 (다중 라인)
    # 품목 구분 컬럼 기준 (R열 규약은 거래처 식별 전용)
    if "품목 구분" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV에 '품목 구분' 컬럼이 없습니다.")

    MONO_PALETTE = ["#000000", "#5d5d5d", "#7d7d7d", "#9d9d9d", "#b8b8b8"]

    def _brand_total_chart(brand_name: str) -> dict:
        f = df_part[df_part["품목그룹1"] == brand_name]
        return {
            "title": f"{brand_name} 종합 트렌드",
            "series_names": [brand_name],
            "colors": ["#000000"],
            "data": [
                {
                    "month": f"{y}-{str(m).zfill(2)}",
                    "values": [float(f[f["월구분"] == f"{str(y)[-2:]}{str(m).zfill(2)}"]["판매액"].sum())],
                }
                for y, m in last12
            ],
        }

    def _brand_products_chart(brand_name: str, product_lines: list) -> dict:
        b = df_part[df_part["품목그룹1"] == brand_name]
        frames = [b[b["품목 구분"] == p] for p in product_lines]
        return {
            "title": f"{brand_name} 주요 상품 라인",
            "series_names": product_lines,
            "colors": MONO_PALETTE[: len(product_lines)],
            "data": [
                {
                    "month": f"{y}-{str(m).zfill(2)}",
                    "values": [
                        float(f[f["월구분"] == f"{str(y)[-2:]}{str(m).zfill(2)}"]["판매액"].sum())
                        for f in frames
                    ],
                }
                for y, m in last12
            ],
        }

    chart10 = _brand_total_chart("마이비")
    chart12 = _brand_total_chart("누비")
    chart14 = _brand_total_chart("쏭레브")

    # ----- brand_products: 각 브랜드별 S열(품목 구분) 모든 옵션 + 12개월 데이터 -----
    # 프론트엔드가 localStorage selection 기반으로 주요 상품 라인·개별 상품 차트 동적 렌더
    last12_yymm = [f"{str(y)[-2:]}{str(m).zfill(2)}" for y, m in last12]
    last12_labels = [f"{y}-{str(m).zfill(2)}" for y, m in last12]

    brand_products = {}
    for brand in ["마이비", "누비", "쏭레브"]:
        bdf = df_part[df_part["품목그룹1"] == brand]
        # 품목 구분 unique values + row count
        counts = bdf["품목 구분"].value_counts()
        items = []
        for product, count in counts.items():
            if pd.isna(product) or str(product).strip() == "" or str(product) == "대상 X":
                continue
            pdf = bdf[bdf["품목 구분"] == product]
            values = [float(pdf[pdf["월구분"] == yymm]["판매액"].sum()) for yymm in last12_yymm]
            items.append({
                "name": str(product),
                "row_count": int(count),
                "values": values,
            })
        brand_products[brand] = items

    # ----- channel_issue: 주요 채널 이슈 섹션용 (P열 × R열·D열 12개월 pivot) -----
    # 프론트가 사용자 정의 그룹(P열 매핑)으로 vendor·brand 데이터를 동적 집계
    def _series_by(cdf: pd.DataFrame, key_col: str) -> list:
        """key_col unique × 12개월 매출 — groupby 1회로 집계 (per-item 불리언 스캔 회피)."""
        if key_col not in cdf.columns:
            return []
        sub = cdf[[key_col, "월구분", "판매액"]].dropna(subset=[key_col])
        if sub.empty:
            return []
        counts = sub[key_col].value_counts()  # row 수 내림차순 (NaN 제외)
        pivot = (
            sub.groupby([key_col, "월구분"])["판매액"].sum()
            .unstack("월구분")
            .reindex(columns=last12_yymm)
            .fillna(0.0)
        )
        out = []
        for name in counts.index:
            if str(name).strip() == "":  # 빈 이름은 유니크 값 단위로만 필터 (저비용)
                continue
            vals = pivot.loc[name]
            out.append({
                "name": str(name),
                "row_count": int(counts[name]),
                "values": [float(vals[y]) for y in last12_yymm],
            })
        return out

    def _series_by_pair(cdf: pd.DataFrame, key_col: str, group_col: str) -> list:
        """(group_col, key_col) 조합별 12개월 매출 — 같은 key라도 group이 다르면 별도 엔트리.
        상품(S열)을 브랜드(D열)별로 분해해 내려보냄: 이름이 같아도 브랜드가 다르면 다른 매출
        (예: 데일리케어 물티슈 vs 라포레띠 물티슈). 프론트가 선택된 브랜드로 동적 스코프."""
        if key_col not in cdf.columns or group_col not in cdf.columns:
            return []
        sub = cdf[[group_col, key_col, "월구분", "판매액"]].dropna(subset=[key_col]).copy()
        if sub.empty:
            return []
        sub[group_col] = sub[group_col].fillna("(미분류)")
        counts = sub.groupby([group_col, key_col]).size()  # (group,key)별 row 수
        pivot = (
            sub.groupby([group_col, key_col, "월구분"])["판매액"].sum()
            .unstack("월구분")
            .reindex(columns=last12_yymm)
            .fillna(0.0)
        )
        out = []
        for (grp, name) in counts.index:
            if str(name).strip() == "":
                continue
            vals = pivot.loc[(grp, name)]
            out.append({
                "name": str(name),
                "brand": str(grp),
                "row_count": int(counts[(grp, name)]),
                "values": [float(vals[y]) for y in last12_yymm],
            })
        return out

    def _build_channel_issue(scope_df: pd.DataFrame) -> dict:
        channels_out = []
        if "채널구분" not in scope_df.columns:
            return {"channels": channels_out}
        for chan in sorted(scope_df["채널구분"].dropna().unique().tolist()):
            cdf = scope_df[scope_df["채널구분"] == chan]

            # 채널(P열) 전체 12개월 합계 — groupby 1회
            month_sum = cdf.groupby("월구분")["판매액"].sum()
            chan_values = [float(month_sum.get(yymm, 0.0)) for yymm in last12_yymm]

            channels_out.append({
                "name": str(chan),
                "row_count": int(len(cdf)),
                "values": chan_values,
                "vendors": _series_by(cdf, "거래처명"),   # R열
                "brands": _series_by(cdf, "품목그룹1"),    # D열
                "products": _series_by_pair(cdf, "품목 구분", "품목그룹1"),  # S열 × D열(브랜드)
            })
        return {"channels": channels_out}

    # 프론트는 요청 파트(summary.channel_issue[part])만 사용 → 요청 파트만 빌드 (성능).
    # part 변경 시 summary를 재페치하므로 나머지 파트는 빈 배열로 충분.
    channel_issue = {
        "all": {"channels": []},
        "ecommerce": {"channels": []},
        "offline": {"channels": []},
    }
    channel_issue[part] = _build_channel_issue(df_part)

    # 브랜드 종합 요약 라인용 — 대상 월의 브랜드별 목표(전사 기준).
    # 전사(전 파트) 목표라 part=all에서만 의미 → 그 외 파트는 빈 dict(목표비 "-").
    brand_targets = _load_brand_targets().get(month, {}) if part == "all" else {}

    return {
        "month": month,
        "part": part,
        "chart1": chart1,
        "chart2": chart2,
        "chart3": chart3,
        "chart4": chart4,
        "chart5": chart5,
        "chart6": chart6,
        "brand_targets": brand_targets,
        "chart10": chart10,
        "chart12": chart12,
        "chart14": chart14,
        "brand_products": brand_products,
        "brand_products_months": last12_labels,
        "channel_options": channel_options,
        "channel_defaults": channel_defaults,
        "channel_months": last12_labels,
        "channel_issue": channel_issue,
        "channel_issue_months": last12_labels,
    }


# ===================================================================
# AI 매출 분석 (대상 월) — Gemini
#   - 분석 가이드(프롬프트)는 파트별로 백엔드 파일에 저장
#   - 분석은 프론트가 표시 중인 summary(종합+트렌드+채널이슈)를 그대로 받아 수행
# ===================================================================

ANALYSIS_PROMPTS_FILE = os.path.join(BASE_DIR, "analysis_prompts.json")
SECURITY_CONFIG_FILE = os.path.join(BASE_DIR, "security_config.json")
_VALID_PARTS = {"all", "ecommerce", "offline"}
PART_LABELS_KR = {"all": "전체", "ecommerce": "이커머스", "offline": "오프라인"}


def _load_analysis_prompts() -> dict:
    """파트별 분석 프롬프트 로드. { "all": "...", "ecommerce": "...", "offline": "..." }"""
    if os.path.exists(ANALYSIS_PROMPTS_FILE):
        try:
            with open(ANALYSIS_PROMPTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
    return {}


def _save_analysis_prompts(prompts: dict) -> None:
    with open(ANALYSIS_PROMPTS_FILE, "w", encoding="utf-8") as f:
        json.dump(prompts, f, ensure_ascii=False, indent=2)


def _resolve_api_key(provided: Optional[str]) -> Optional[str]:
    """클라이언트가 보낸 키 우선, 없으면 서버 보관 키(env → config file)."""
    if provided and provided != "server_managed":
        return provided
    env_key = os.getenv("GOOGLE_API_KEY")
    if env_key:
        return env_key
    if os.path.exists(SECURITY_CONFIG_FILE):
        try:
            with open(SECURITY_CONFIG_FILE, "r") as f:
                return json.load(f).get("api_key")
        except Exception:
            return None
    return None


def _won_to_man(v) -> str:
    """원 → 백만원 반올림 문자열."""
    try:
        return f"{round(float(v) / 1_000_000):,}백만원"
    except Exception:
        return "-"


def _build_analysis_context(summary: dict, month: str, part: str) -> str:
    """프론트 summary(JSON)를 사람이 읽기 좋은 한국어 데이터 컨텍스트로 변환.
    범위: 종합 실적 + 12개월 트렌드(전년비) + 주요 채널 이슈."""
    lines: list[str] = []
    lines.append(f"대상 월: {month}")
    lines.append(f"파트: {PART_LABELS_KR.get(part, part)}")

    # ----- 종합 실적 -----
    c1 = summary.get("chart1") or {}
    rate = c1.get("achievement_rate")
    target = c1.get("target")
    lines.append("")
    lines.append("[종합 실적]")
    lines.append(f"- 실적: {_won_to_man(c1.get('actual'))}")
    lines.append(f"- 목표: {_won_to_man(target) if target else '미설정'}")
    lines.append(f"- 목표 달성률: {rate}%" if rate is not None else "- 목표 달성률: -")

    # ----- 12개월 트렌드 (전년비) -----
    c2 = summary.get("chart2") or []
    if c2:
        lines.append("")
        lines.append("[12개월 트렌드 — 당해 vs 전년]")
        for row in c2:
            m = row.get("month", "")
            cur = _won_to_man(row.get("current_year"))
            prev = _won_to_man(row.get("prev_year"))
            lines.append(f"- {m}: 당해 {cur} / 전년 {prev}")

    # ----- 주요 채널 이슈 (대상월 기준) -----
    ci = (summary.get("channel_issue") or {}).get(part) or {}
    channels = ci.get("channels") or []
    if channels:
        lines.append("")
        lines.append("[주요 채널 이슈 — 채널별 대상월 매출 / 상위 거래처·브랜드]")
        for ch in channels:
            vals = ch.get("values") or []
            cur_v = _won_to_man(vals[-1]) if vals else "-"
            prev_v = _won_to_man(vals[-2]) if len(vals) >= 2 else "-"
            lines.append(f"- {ch.get('name', '')}: 대상월 {cur_v} (직전월 {prev_v})")
            vendors = (ch.get("vendors") or [])[:3]
            if vendors:
                vtxt = ", ".join(
                    f"{v.get('name')} {_won_to_man((v.get('values') or [0])[-1])}" for v in vendors
                )
                lines.append(f"    · 주요 거래처: {vtxt}")
            brands = (ch.get("brands") or [])[:3]
            if brands:
                btxt = ", ".join(
                    f"{b.get('name')} {_won_to_man((b.get('values') or [0])[-1])}" for b in brands
                )
                lines.append(f"    · 주요 브랜드: {btxt}")

    return "\n".join(lines)


class AnalysisPromptRequest(BaseModel):
    part: str
    prompt: str


class AIAnalysisRequest(BaseModel):
    month: str
    part: str = "all"
    summary: dict
    api_key: Optional[str] = None


@router.get("/analysis-prompt/")
def get_analysis_prompt(part: str = Query("all")):
    if part not in _VALID_PARTS:
        raise HTTPException(status_code=400, detail="잘못된 파트입니다.")
    prompts = _load_analysis_prompts()
    return {"part": part, "prompt": prompts.get(part, "")}


@router.post("/analysis-prompt/")
def set_analysis_prompt(req: AnalysisPromptRequest):
    if req.part not in _VALID_PARTS:
        raise HTTPException(status_code=400, detail="잘못된 파트입니다.")
    prompts = _load_analysis_prompts()
    prompts[req.part] = req.prompt
    try:
        _save_analysis_prompts(prompts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프롬프트 저장 실패: {e}")
    return {"part": req.part, "prompt": req.prompt}


@router.post("/ai-analysis/")
def run_ai_analysis(req: AIAnalysisRequest):
    if req.part not in _VALID_PARTS:
        raise HTTPException(status_code=400, detail="잘못된 파트입니다.")

    api_key = _resolve_api_key(req.api_key)
    if not api_key:
        raise HTTPException(status_code=400, detail="API Key가 설정되지 않았습니다. 관리자에게 문의하세요.")

    user_prompt = (_load_analysis_prompts().get(req.part, "") or "").strip()
    if not user_prompt:
        raise HTTPException(
            status_code=400,
            detail="분석 가이드(프롬프트)가 작성되지 않았습니다. 편집 모드에서 먼저 작성해 주세요.",
        )

    context = _build_analysis_context(req.summary, req.month, req.part)
    full_prompt = (
        "당신은 매출 데이터 분석 전문가입니다.\n"
        f"아래 [데이터]는 {req.month} 대상 월의 매출 집계입니다.\n"
        "[분석 지침]에 따라 한국어로 분석 결과를 작성하세요. "
        "수치는 데이터에 있는 값만 사용하고, 추측하지 마세요.\n\n"
        f"[분석 지침]\n{user_prompt}\n\n"
        f"[데이터]\n{context}\n"
    )

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-3.5-flash")
        resp = model.generate_content(full_prompt)
        return {"analysis": resp.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 분석 실패: {e}")
