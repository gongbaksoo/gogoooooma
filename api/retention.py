"""업로드 파일 보관 정책 — 날짜 무관, 최신 N개만 유지.

DB(uploaded_files)가 기준 원장이고 디스크(uploads/)는 그 미러다.
업로드는 DB에만 저장되지만 조회 시점에 ensure_file_on_disk()가 DB 블롭을
디스크로 다시 써내므로, 디스크 사본은 상한 없이 쌓인다. 이 모듈이 그 정리를
한 곳에서 담당한다.

- DB:      updated_at 최신 MAX_FILES개만 유지
- 디스크:   DB에 살아남은 파일명만 유지 (나머지 .csv/.xlsx 삭제)
- parquet: 살아남은 파일의 해시가 아니면 삭제
- 목표파일: uploads/targets/ 를 mtime 기준 최신 MAX_FILES개만 유지

DB가 비었거나 사용 불가일 때는 미러링하지 않고 디스크 mtime 기준으로만
자른다. 빈 DB로 기동된 서버가 운영 데이터를 전부 지우는 사고를 막는 안전장치다.
"""
import hashlib
import logging
import os

import database
from database import cleanup_old_files_in_db, get_hash_by_filename, list_files_in_db

MAX_FILES = 5
DATA_EXTS = (".csv", ".xlsx")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# index.py의 UPLOAD_DIR 결정 규칙과 동일하게 맞춘다.
if os.environ.get("VERCEL"):
    UPLOAD_DIR = "/tmp/uploads"
else:
    UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
CACHE_DIR = os.path.join(UPLOAD_DIR, "cache")
TARGETS_DIR = os.path.join(UPLOAD_DIR, "targets")


def _disk_data_files():
    """uploads/ 최상위 데이터 파일 [(filename, mtime)]. 숨김파일·하위 디렉터리 제외."""
    out = []
    if not os.path.isdir(UPLOAD_DIR):
        return out
    for name in os.listdir(UPLOAD_DIR):
        if name.startswith("."):
            continue
        path = os.path.join(UPLOAD_DIR, name)
        if not os.path.isfile(path):
            continue
        if not name.lower().endswith(DATA_EXTS):
            continue
        out.append((name, os.path.getmtime(path)))
    return out


def _resolve_hash(filename):
    """DB 해시 우선, 없으면 디스크 내용으로 계산. 둘 다 실패하면 None."""
    try:
        file_hash = get_hash_by_filename(filename)
        if file_hash:
            return file_hash
    except Exception as e:
        logging.error(f"[retention] DB 해시 조회 실패 {filename}: {e}")

    path = os.path.join(UPLOAD_DIR, filename)
    if os.path.isfile(path):
        try:
            digest = hashlib.sha256()
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    digest.update(chunk)
            return digest.hexdigest()
        except Exception as e:
            logging.error(f"[retention] 디스크 해시 계산 실패 {filename}: {e}")
    return None


def _prune_parquet(keep_filenames):
    """살아남은 파일의 해시가 아닌 parquet 캐시 삭제."""
    if not os.path.isdir(CACHE_DIR):
        return []

    keep_names = set()
    for name in keep_filenames:
        file_hash = _resolve_hash(name)
        if not file_hash:
            # 해시를 못 구하면 어떤 parquet이 유효한지 판단할 수 없다 → 정리 보류.
            logging.warning(f"[retention] {name} 해시 미확인 — parquet 정리 건너뜀")
            return []
        keep_names.add(f"{file_hash}.parquet")
        keep_names.add(f"{name}.parquet")  # 구버전 파일명 기반 캐시

    removed = []
    for name in os.listdir(CACHE_DIR):
        if not name.endswith(".parquet") or name in keep_names:
            continue
        try:
            os.remove(os.path.join(CACHE_DIR, name))
            removed.append(name)
        except Exception as e:
            logging.error(f"[retention] parquet 삭제 실패 {name}: {e}")
    return removed


def enforce_retention(max_files: int = MAX_FILES) -> dict:
    """업로드 파일을 최신 max_files개로 정리. 업로드·삭제·기동 시 호출."""
    result = {"mode": "db", "db_deleted": 0, "disk_deleted": [], "parquet_deleted": []}

    rows = []
    if database.SessionLocal is not None:
        try:
            result["db_deleted"] = cleanup_old_files_in_db(max_files=max_files)
            rows = list_files_in_db() or []
        except Exception as e:
            logging.error(f"[retention] DB 정리 실패: {e}")
            rows = []

    if rows:
        keep = {r["filename"] for r in rows}
    else:
        # DB가 비었거나 사용 불가 → 미러링하지 않고 디스크 기준으로만 자른다.
        result["mode"] = "disk"
        disk = sorted(_disk_data_files(), key=lambda x: x[1], reverse=True)
        keep = {name for name, _ in disk[:max_files]}

    for name, _ in _disk_data_files():
        if name in keep:
            continue
        try:
            os.remove(os.path.join(UPLOAD_DIR, name))
            result["disk_deleted"].append(name)
        except Exception as e:
            logging.error(f"[retention] 디스크 삭제 실패 {name}: {e}")

    result["parquet_deleted"] = _prune_parquet(keep)

    # 삭제된 파일이 메모리 캐시에 남아 서빙되지 않도록 함께 비운다.
    if result["disk_deleted"]:
        try:
            from dashboard import clear_df_cache
            for name in result["disk_deleted"]:
                clear_df_cache(name)
        except Exception as e:
            logging.error(f"[retention] 메모리 캐시 정리 실패: {e}")

    if result["db_deleted"] or result["disk_deleted"] or result["parquet_deleted"]:
        logging.info(
            f"[retention] mode={result['mode']} "
            f"DB {result['db_deleted']}건 / 디스크 {len(result['disk_deleted'])}건 / "
            f"parquet {len(result['parquet_deleted'])}건 삭제 "
            f"(디스크: {result['disk_deleted']})"
        )
    return result


def enforce_target_retention(max_files: int = MAX_FILES) -> list:
    """목표 파일(uploads/targets/)을 mtime 기준 최신 max_files개로 정리."""
    removed = []
    if not os.path.isdir(TARGETS_DIR):
        return removed

    entries = []
    for name in os.listdir(TARGETS_DIR):
        if name.startswith("."):
            continue
        path = os.path.join(TARGETS_DIR, name)
        if os.path.isfile(path):
            entries.append((name, os.path.getmtime(path)))

    entries.sort(key=lambda x: x[1], reverse=True)
    for name, _ in entries[max_files:]:
        try:
            os.remove(os.path.join(TARGETS_DIR, name))
            removed.append(name)
        except Exception as e:
            logging.error(f"[retention] 목표 파일 삭제 실패 {name}: {e}")

    if removed:
        logging.info(f"[retention] 목표 파일 {len(removed)}건 삭제: {removed}")
    return removed
