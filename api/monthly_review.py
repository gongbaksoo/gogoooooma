"""
월 리뷰 (Monthly Review) 집계 모듈.

PPT 월간 리뷰 보고서를 화면에서 재현하기 위한 집계 엔드포인트.
Phase 1: 종합 슬라이드 차트 3개 (목표비 실적 / 전년비 트렌드 / 주력 vs 쿠팡사입).
"""
import os
import logging
import re
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Query

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
        title = "이마트 vs 롯데마트 vs 다이소"
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
    def _trailing_series(category_frames: list, name: str) -> dict:
        """N개 카테고리 frame 리스트 → trailing 12개월 line chart 데이터"""
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
                for y, m in last12
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
    # 메인 4: 마이비/누비/쏭레브/에코보 + 기타(나머지 품목그룹1)
    if "품목그룹1" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV에 '품목그룹1' 컬럼이 없습니다.")
    BRAND_MAIN = ["마이비", "누비", "쏭레브", "에코보"]
    brand_frames = [df_part[df_part["품목그룹1"] == b] for b in BRAND_MAIN]
    brand_frames.append(df_part[~df_part["품목그룹1"].isin(BRAND_MAIN)])
    brand_names = BRAND_MAIN + ["기타"]
    brand_colors = ["#000000", "#5d5d5d", "#7d7d7d", "#9d9d9d", "#b8b8b8"]

    # chart4: 브랜드별 매출 트렌드 (라인, 5-series, trailing 12개월)
    chart4 = {
        "title": "브랜드별 매출 트렌드",
        "series_names": brand_names,
        "colors": brand_colors,
        "data": _trailing_series(brand_frames, "")["data"],
    }

    # chart5: 브랜드별 매출 비중 (파이, 최근 12개월 합계)
    chart5 = {
        "title": "브랜드별 매출 비중 (최근 12개월)",
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

    # ----- 채널 유형 분류 (df_part 기반) -----
    # 사입 / 위탁 / 자사몰 / 기타
    if "채널구분" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV에 '채널구분' 컬럼이 없습니다.")
    CHAN_BUY_IN = ["오픈마켓(사입)"]
    CHAN_CONSIGN = ["오픈마켓(위탁)", "종합몰", "버티컬커머스"]
    CHAN_OWN = ["자사몰"]
    chan_main = CHAN_BUY_IN + CHAN_CONSIGN + CHAN_OWN
    chan_frames = [
        df_part[df_part["채널구분"].isin(CHAN_BUY_IN)],
        df_part[df_part["채널구분"].isin(CHAN_CONSIGN)],
        df_part[df_part["채널구분"].isin(CHAN_OWN)],
        df_part[~df_part["채널구분"].isin(chan_main)],
    ]
    chan_names = ["사입", "위탁", "자사몰", "기타"]
    chan_colors = ["#000000", "#5d5d5d", "#7d7d7d", "#b8b8b8"]

    # chart7: 채널별 매출 트렌드
    chart7 = {
        "title": "채널별 매출 트렌드",
        "series_names": chan_names,
        "colors": chan_colors,
        "data": _trailing_series(chan_frames, "")["data"],
    }

    # chart8: 채널별 매출 비중
    chart8 = {
        "title": "채널별 매출 비중 (최근 12개월)",
        "series_names": chan_names,
        "colors": chan_colors,
        "data": _share_pie(chan_frames, chan_names),
    }

    # chart9: 채널별 월 평균 대비 실적
    chart9 = {
        "title": "월 평균 대비 실적",
        "series_names": ["월평균", "당월"],
        "colors": ["#5d5d5d", "#000000"],
        "data": _grouped_bar(chan_frames, chan_names, target_yymm),
    }

    return {
        "month": month,
        "part": part,
        "chart1": chart1,
        "chart2": chart2,
        "chart3": chart3,
        "chart4": chart4,
        "chart5": chart5,
        "chart6": chart6,
        "chart7": chart7,
        "chart8": chart8,
        "chart9": chart9,
    }
