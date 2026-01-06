"""
Validation function for uploaded files to check date format
"""
import pandas as pd
import re

def validate_date_format(df):
    """
    Validate that '일별' column contains dates in YYYY-MM-DD format
    Returns (is_valid, error_message)
    """
    if '일별' not in df.columns:
        return True, None  # No date column to validate
    
    # Get first 10 non-null values to check format
    sample_dates = df['일별'].dropna().head(20)
    
    if len(sample_dates) == 0:
        return True, None
    
    # Check format: YYYY-MM-DD (e.g., "2025-01-01")
    date_pattern = r'^\d{4}-\d{2}-\d{2}$'
    
    invalid_dates = []
    for idx, date_val in sample_dates.items():
        date_str = str(date_val).strip()
        if not re.match(date_pattern, date_str):
            invalid_dates.append((idx, date_str))
        
        if len(invalid_dates) >= 5:  # Show first 5 examples
            break
    
    if invalid_dates:
        examples = ", ".join([f'"{d[1]}"' for d in invalid_dates[:3]])
        error_msg = f"""
날짜 형식 오류: '일별' 컬럼의 날짜 형식이 올바르지 않습니다.

✅ 올바른 형식: YYYY-MM-DD (예: 2025-01-01, 2026-01-06)
❌ 발견된 형식: {examples}

데이터를 수정한 후 다시 업로드해주세요.
총 {len(sample_dates)}개 중 {len([d for _, d_val in sample_dates.items() if not re.match(date_pattern, str(d_val).strip())])}개의 날짜가 잘못된 형식입니다.
        """.strip()
        return False, error_msg
    
    return True, None
