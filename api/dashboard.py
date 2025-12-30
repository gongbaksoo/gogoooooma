import pandas as pd
import numpy as np
import os
import calendar
import logging
import time

# In-memory cache for DataFrames
df_cache = {}

def get_dataframe(filename: str):
    """
    Get a DataFrame from cache, parquet fallback, or original file
    """
    global df_cache
    
    # 1. Check in-memory cache
    if filename in df_cache:
        logging.info(f"Cache HIT for {filename}")
        return df_cache[filename]
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "uploads", filename)
    
    # Cache directory for parquet files
    cache_dir = os.path.join(base_dir, "uploads", "cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    parquet_path = os.path.join(cache_dir, f"{filename}.parquet")
    
    # 2. Check if parquet version exists and is newer than original
    if os.path.exists(parquet_path) and os.path.exists(file_path) and os.path.getmtime(parquet_path) > os.path.getmtime(file_path):
        try:
            logging.info(f"Reading from Parquet: {parquet_path}")
            df = pd.read_parquet(parquet_path)
            df_cache[filename] = df
            return df
        except Exception as e:
            logging.error(f"Failed to read parquet {parquet_path}: {e}")

    # 3. Read from original file (Excel or CSV)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
        
    logging.info(f"Reading from source file: {file_path}")
    start_time = time.time()
    
    if file_path.endswith('.xlsx'):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)
    
    end_time = time.time()
    logging.info(f"Loaded {filename} in {end_time - start_time:.2f}s")
    
    # Clean up column names and common types
    df.columns = df.columns.astype(str).str.replace('\t', '').str.strip()
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
    
    df = clean_numeric_columns(df)
    
    # Save to parquet for next time
    try:
        df.to_parquet(parquet_path)
        logging.info(f"Saved {filename} to Parquet for future fast loading")
    except Exception as e:
        logging.error(f"Failed to save parquet {parquet_path}: {e}")
        
    df_cache[filename] = df
    return df

def clear_df_cache(filename: str = None):
    """Clear specific or all cache entries"""
    global df_cache
    if filename:
        if filename in df_cache:
            del df_cache[filename]
            logging.info(f"Cleared cache for {filename}")
    else:
        df_cache = {}
        logging.info("Cleared entire DataFrame cache")
        
def get_monthly_sales_by_channel(filename: str):
    """
    월별 이커머스 vs 오프라인 매출 데이터 반환
    """
    # 데이터 로드 (캐싱 적용)
    df = get_dataframe(filename)
    
    # 필요한 컬럼 확인
    required_cols = ['월구분', '파트구분', '판매액', '이익']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in data")
    
    # 이커머스와 오프라인만 필터링
    df_filtered = df[df['파트구분'].isin(['이커머스', '오프라인'])].copy()
    
    # 월구분과 파트구분으로 그룹화하여 합계
    monthly_sales = df_filtered.groupby(['월구분', '파트구분'])[['판매액', '이익']].sum().reset_index()
    
    # 피벗하여 이커머스와 오프라인을 별도 컬럼으로
    pivot_sales = monthly_sales.pivot(index='월구분', columns='파트구분', values='판매액').fillna(0)
    pivot_profit = monthly_sales.pivot(index='월구분', columns='파트구분', values='이익').fillna(0)
    
    # 월구분 정렬
    pivot_sales = pivot_sales.sort_index()
    pivot_profit = pivot_profit.sort_index()
    
    # 총 매출 계산 (이커머스 + 오프라인)
    ecommerce_values = pivot_sales.get('이커머스', pd.Series([0] * len(pivot_sales))).tolist()
    offline_values = pivot_sales.get('오프라인', pd.Series([0] * len(pivot_sales))).tolist()
    total_values = [e + o for e, o in zip(ecommerce_values, offline_values)]
    
    # 총 이익 계산
    ecommerce_profit = pivot_profit.get('이커머스', pd.Series([0] * len(pivot_profit))).tolist()
    offline_profit = pivot_profit.get('오프라인', pd.Series([0] * len(pivot_profit))).tolist()
    total_profit = [e + o for e, o in zip(ecommerce_profit, offline_profit)]
    
    months = [str(int(month)) for month in pivot_sales.index.tolist()]
    days_list, debug_logs = calculate_days_list(df, pivot_sales.index.tolist())
 
    # 결과 포맷팅
    result = {
        "months": months,
        "ecommerce": ecommerce_values,
        "offline": offline_values,
        "total": total_values,
        "ecommerce_profit": ecommerce_profit,
        "offline_profit": offline_profit,
        "total_profit": total_profit,
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    return result

def get_monthly_sales_by_product_group(filename: str):
    """
    월별 품목그룹별 매출 데이터 반환
    """
    # 데이터 로드 (캐싱 적용)
    df = get_dataframe(filename)
        
    # 필요한 컬럼 확인
    required_cols = ['월구분', '품목그룹1', '판매액', '이익']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in data")
    
    # 월구분과 품목그룹1으로 그룹화하여 합계
    monthly_sales = df.groupby(['월구분', '품목그룹1'])[['판매액', '이익']].sum().reset_index()
    
    # 피벗하여 각 품목그룹을 별도 컬럼으로
    pivot_sales = monthly_sales.pivot(index='월구분', columns='품목그룹1', values='판매액').fillna(0)
    pivot_profit = monthly_sales.pivot(index='월구분', columns='품목그룹1', values='이익').fillna(0)
    
    # 월구분 정렬
    pivot_sales = pivot_sales.sort_index()
    pivot_profit = pivot_profit.sort_index()
    
    # 품목그룹 리스트 (매출액 기준 내림차순 정렬)
    group_totals = pivot_sales.sum().sort_values(ascending=False)
    top_groups = group_totals.head(10).index.tolist()  # 상위 10개 품목그룹
    
    days_list, debug_logs = calculate_days_list(df, pivot_sales.index.tolist())
    
    result = {
        "months": [str(int(month)) for month in pivot_sales.index.tolist()],
        "groups": {},
        "profit_groups": {},
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    # 각 품목그룹의 월별 데이터 추가
    for group in top_groups:
        if group in pivot_sales.columns:
            result["groups"][group] = pivot_sales[group].tolist()
        if group in pivot_profit.columns:
            result["profit_groups"][group] = pivot_profit[group].tolist()
    
    return result

def clean_numeric_columns(df):
    """판매액 및 이익 컬럼의 쉼표 제거 및 숫자로 변환"""
    target_cols = ['판매액', '이익']
    for col in target_cols:
        if col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].astype(str).str.replace(',', '').str.strip()
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    return df

def get_days_in_month(year, month):
    """해당 연/월의 총 일수 반환"""
    return calendar.monthrange(year, month)[1]

def calculate_days_list(df, months):
    """
    각 월별 나눌 일수 리스트 반환 (with debug logs)
    """
    logs = []
    logs.append(f"Columns found: {df.columns.tolist()}")
    
    # Flexible column search for 'Day'
    day_col_candidates = ['일구분', '일자', '일', 'Day', 'day', 'Date', 'date']
    day_col = next((col for col in day_col_candidates if col in df.columns), None)
    
    if not day_col:
        logs.append(f"Day column NOT found. Candidates checked: {day_col_candidates}. Fallback to calendar days.")
        days_list = []
        for m_str in months:
            year = 2024
            if len(str(m_str)) == 6:
                year = int(str(m_str)[:4])
                month = int(str(m_str)[4:])
            elif len(str(m_str)) == 4:
                year = 2000 + int(str(m_str)[:2])
                month = int(str(m_str)[2:])
            else:
                month = int(m_str)
            days_list.append(get_days_in_month(year, month))
        return days_list, logs
        
    logs.append(f"Using '{day_col}' as day column.")

    days_list = []
    for m_str in months:
        m_str = str(m_str)
        year = 2024
        if len(m_str) == 4:
            year = 2000 + int(m_str[:2])
            month = int(m_str[2:])
        elif len(m_str) == 5 or len(m_str) == 6:
            year = int(m_str[:-2])
            month = int(m_str[-2:])
        else:
            days_list.append(30)
            continue

        try:
            # Robust filtering: Always match as string to handle mixed types
            month_df = df[df['월구분'].astype(str) == m_str]
            
            if not month_df.empty:
                # ----------------------------------------------------------------
                # FIX: Filter for rows with Sales > 0 to ignore future placeholder dates
                # Many excel files pre-fill days 1-31 with 0 sales.
                # max('day_col') would be 31. We want max day WITH SALES.
                # ----------------------------------------------------------------
                
                # Ensure '판매액' is numeric (handle commas if string)
                sales_series = month_df['판매액']
                if sales_series.dtype == 'object':
                    # Remove commas and clean whitespace
                    sales_series = sales_series.astype(str).str.replace(',', '').str.strip()
                
                month_df_valid = month_df[pd.to_numeric(sales_series, errors='coerce').fillna(0) > 0]
                
                if not month_df_valid.empty:
                    max_day = month_df_valid[day_col].max()
                    logs.append(f"Month {m_str}: Max day with sales>0 is {max_day}")
                else:
                    # If NO sales > 0 found (e.g. all 0), fall back to raw max or calendar?
                    # Use raw max but log it.
                    max_day = month_df[day_col].max()
                    logs.append(f"Month {m_str}: No sales > 0. Using raw max {max_day}")

                # Clean max_day if it's a string (e.g. "9일")
                try:
                    if isinstance(max_day, str):
                        max_day = ''.join(filter(str.isdigit, max_day))
                    
                    max_day_int = int(max_day)
                    
                    # Heuristic: If only Day 1 exists, it's likely Monthly Summary data
                    # so we should divide by full calendar days, not 1.
                    unique_days = month_df_valid[day_col].unique()
                    if max_day_int == 1 and len(unique_days) == 1:
                        calendar_days = get_days_in_month(year, month)
                        days_list.append(calendar_days)
                        logs.append(f"Month {m_str}: Monthly Summary detected (Day 1 only). Using {calendar_days} days.")
                    elif max_day_int > 0:
                        days_list.append(max_day_int)
                    else:
                        days_list.append(get_days_in_month(year, month))
                except:
                     days_list.append(get_days_in_month(year, month))
            else:
                logs.append(f"Month {m_str}: No data found in DF. Fallback.")
                days_list.append(get_days_in_month(year, month))
        except Exception as e:
            logs.append(f"Month {m_str}: Error {str(e)}. Fallback.")
            days_list.append(get_days_in_month(year, month))
            
    return days_list, logs

def get_monthly_sales_by_product_group(filename: str):
    """
    월별 품목그룹별 매출 데이터 반환
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    # 데이터 로드
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    
    # 컬럼명 클리닝
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
        
    df = clean_numeric_columns(df)
        
    # 필요한 컬럼 확인
    required_cols = ['월구분', '품목그룹1', '판매액', '이익']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in data")
    
    # 월구분과 품목그룹1으로 그룹화하여 합계
    monthly_sales = df.groupby(['월구분', '품목그룹1'])[['판매액', '이익']].sum().reset_index()
    
    # 피벗하여 각 품목그룹을 별도 컬럼으로
    pivot_sales = monthly_sales.pivot(index='월구분', columns='품목그룹1', values='판매액').fillna(0)
    pivot_profit = monthly_sales.pivot(index='월구분', columns='품목그룹1', values='이익').fillna(0)
    
    # 월구분 정렬
    pivot_sales = pivot_sales.sort_index()
    pivot_profit = pivot_profit.sort_index()
    
    # 품목그룹 리스트 (매출액 기준 내림차순 정렬)
    group_totals = pivot_sales.sum().sort_values(ascending=False)
    top_groups = group_totals.head(10).index.tolist()  # 상위 10개 품목그룹
    
    days_list, debug_logs = calculate_days_list(df, pivot_sales.index.tolist())
    
    result = {
        "months": [str(int(month)) for month in pivot_sales.index.tolist()],
        "groups": {},
        "profit_groups": {},
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    # 각 품목그룹의 월별 데이터 추가
    for group in top_groups:
        if group in pivot_sales.columns:
            result["groups"][group] = pivot_sales[group].tolist()
        if group in pivot_profit.columns:
            result["profit_groups"][group] = pivot_profit[group].tolist()
    
    return result

def get_hierarchical_options(filename: str):
    """
    품목그룹 > 품목 구분 > 품목 구분_2 계층 구조 옵션 반환
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    df = get_dataframe(filename)
    
    required_cols = ['품목그룹1', '품목 구분', '품목 구분_2']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in data")

    options = {}
    
    # NaN 값 처리 및 중복 제거
    df_clean = df[required_cols].fillna('Unknown')
    
    for _, row in df_clean.drop_duplicates().iterrows():
        group = row['품목그룹1']
        category = row['품목 구분']
        sub_category = row['품목 구분_2']
        
        if group not in options:
            options[group] = {}
            
        if category not in options[group]:
            options[group][category] = []
            
        if sub_category not in options[group][category]:
            options[group][category].append(sub_category)
            
    return options

def get_filtered_monthly_sales(
    filename: str, 
    group: str = None, 
    category: str = None, 
    sub_category: str = None,
    part: str = None,
    channel: str = None,
    account: str = None
):
    """
    조건(품목 그룹 + 채널 세그먼트)에 따른 월별 매출 데이터 반환
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    df = get_dataframe(filename)
    
    # 1. 월별 전체 데이터를 먼저 구해서 모든 월 리스트 확보
    all_months = sorted(df['월구분'].unique())
    days_list, debug_logs = calculate_days_list(df, all_months)
    
    # 2. 필터링
    df_filtered = df.copy()
    
    labels = []
    
    # Product Filtering
    if group and group != 'all':
        df_filtered = df_filtered[df_filtered['품목그룹1'] == group]
        labels.append(group)
        
    if category and category != 'all':
        df_filtered = df_filtered[df_filtered['품목 구분'] == category]
        labels.append(category)
        
    if sub_category and sub_category != 'all':
        df_filtered = df_filtered[df_filtered['품목 구분_2'] == sub_category]
        labels.append(sub_category)

    # Channel Filtering
    if part and part != 'all':
        df_filtered = df_filtered[df_filtered['파트구분'] == part]
        labels.append(part)

    if channel and channel != 'all':
        df_filtered = df_filtered[df_filtered['채널구분'] == channel]
        labels.append(channel)

    if account and account != 'all':
        df_filtered = df_filtered[df_filtered['거래처명'] == account]
        labels.append(account)
        
    current_label = " > ".join(labels) if labels else "전체"
        
    # 3. 월별 매출 및 이익 집계
    monthly_sales = df_filtered.groupby('월구분')['판매액'].sum().reindex(all_months, fill_value=0)
    monthly_profit = df_filtered.groupby('월구분')['이익'].sum().reindex(all_months, fill_value=0)
    
    # 4. 결과 포맷팅
    result = {
        "months": [str(int(month)) for month in all_months],
        "sales": monthly_sales.values.tolist(),
        "profit": monthly_profit.values.tolist(),
        "label": current_label,
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    return result

def get_channel_layer_options(filename: str):
    """
    파트구분 > 채널구분 > 거래처명 계층 구조 옵션 반환
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    df = get_dataframe(filename)
    
    required_cols = ['파트구분', '채널구분', '거래처명']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in data")

    options = {}
    
    # NaN 값 처리 및 중복 제거
    df_clean = df[required_cols].fillna('Unknown')
    
    for _, row in df_clean.drop_duplicates().iterrows():
        part = row['파트구분']
        channel = row['채널구분']
        account = row['거래처명']
        
        if part not in options:
            options[part] = {}
            
        if channel not in options[part]:
            options[part][channel] = []
            
        if account not in options[part][channel]:
            options[part][channel].append(account)
            
    return options

def get_channel_layer_sales(
    filename: str, 
    part: str = None, 
    channel: str = None, 
    account: str = None,
    group: str = None,
    category: str = None,
    sub_category: str = None
):
    """
    조건(채널 세그먼트 + 품목 그룹)에 따른 월별 매출 데이터 반환
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    df = get_dataframe(filename)
    
    all_months = sorted(df['월구분'].unique())
    days_list, debug_logs = calculate_days_list(df, all_months)
    
    df_filtered = df.copy()
    labels = []
    
    # Channel Filtering
    if part and part != 'all':
        df_filtered = df_filtered[df_filtered['파트구분'] == part]
        labels.append(part)
        
    if channel and channel != 'all':
        df_filtered = df_filtered[df_filtered['채널구분'] == channel]
        labels.append(channel)
        
    if account and account != 'all':
        df_filtered = df_filtered[df_filtered['거래처명'] == account]
        labels.append(account)

    # Product Filtering
    if group and group != 'all':
        df_filtered = df_filtered[df_filtered['품목그룹1'] == group]
        labels.append(group)
        
    if category and category != 'all':
        df_filtered = df_filtered[df_filtered['품목 구분'] == category]
        labels.append(category)
        
    if sub_category and sub_category != 'all':
        df_filtered = df_filtered[df_filtered['품목 구분_2'] == sub_category]
        labels.append(sub_category)

    current_label = " > ".join(labels) if labels else "전체 채널"
        
    monthly_sales = df_filtered.groupby('월구분')['판매액'].sum().reindex(all_months, fill_value=0)
    monthly_profit = df_filtered.groupby('월구분')['이익'].sum().reindex(all_months, fill_value=0)
    
    result = {
        "months": [str(int(month)) for month in all_months],
        "sales": monthly_sales.values.tolist(),
        "profit": monthly_profit.values.tolist(),
        "label": current_label,
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    return result

def get_daily_hierarchical_sales(
    filename: str, 
    group: str = None, 
    category: str = None, 
    sub_category: str = None,
    part: str = None,
    channel: str = None,
    account: str = None
):
    """
    일별 품목 계층별 매출 데이터 반환
    """
    df = get_dataframe(filename)
    
    # 1. 필터링 로직 (get_filtered_monthly_sales와 동일)
    if group and group != 'all':
        df = df[df['품목그룹1'] == group]
    if category and category != 'all':
        df = df[df['품목 구분'] == category]
    if sub_category and sub_category != 'all':
        df = df[df['품목 구분_2'] == sub_category]
        
    if part and part != 'all':
        df = df[df['파트구분'] == part]
    if channel and channel != 'all':
        df = df[df['채널구분'] == channel]
    if account and account != 'all':
        df = df[df['거래처명'] == account]
        
    # 2. 일자별 그룹화
    # 컬럼명 '일별' 사용
    date_col = '일별'
    
    # 혼합된 타입 처리 (숫자인 엑셀 시리얼과 문자열 날짜가 섞여있음)
    
    # 이미 datetime 형식이면 변환 불필요
    if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
        # 1) 먼저 숫자로 변환 가능한 부분(엑셀 시리얼 날짜) 처리
        # 주의: datetime 컬럼에 to_numeric을 쓰면 나노초로 변환되므로 위에서 타입 체크 필수
        numeric_dates = pd.to_numeric(df[date_col], errors='coerce')
        
        # 2) 날짜로 변환 (숫자인 경우)
        # 엑셀 시리얼 날짜는 1900년 1월 1일 이전 등을 제외하고 통상적으로 아래와 같이 변환
        date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30')
        
        # 3) 숫자가 아니어서 NaT로 된 부분은 문자열로 간주하고 다시 파싱 시도
        mask = date_series.isna() & df[date_col].notna()
        if mask.any():
            try:
                # 문자열 날짜 파싱 (예: 2025/12/01)
                date_series.loc[mask] = pd.to_datetime(df.loc[mask, date_col], errors='coerce')
            except Exception as e:
                print(f"Date conversion error: {e}")
                
        df[date_col] = date_series

    # 유효한 일자만 필터링
    df = df.dropna(subset=[date_col])

    # 일자별 집계
    daily_sales = df.groupby(date_col)[['판매액', '이익']].sum().reset_index()
    
    # 일자 정렬
    daily_sales = daily_sales.sort_values(date_col)
    
    # 날짜 포맷팅 (YYYY-MM-DD -> MM/DD or str)
    # 프론트엔드에서 처리하기 쉽도록 ISO 문자열로 반환
    dates = daily_sales[date_col].dt.strftime('%Y-%m-%d').tolist()
    sales = daily_sales['판매액'].tolist()
    profit = daily_sales['이익'].tolist()
    
    # 레이블 생성 (필터 조건에 따라)
    label_parts = []
    if part and part != 'all': label_parts.append(part)
    if channel and channel != 'all': label_parts.append(channel)
    if account and account != 'all': label_parts.append(account)
    if group and group != 'all': label_parts.append(group)
    if category and category != 'all': label_parts.append(category)
    if sub_category and sub_category != 'all': label_parts.append(sub_category)
    
    label = " > ".join(label_parts) if label_parts else "전체"
    
    # 결과 반환
    return {
        "dates": dates,
        "sales": sales,
        "profit": profit,
        "label": label
    }

def get_monthly_summary(filename):
    df = get_dataframe(filename)
    if df.empty:
        return {}
        
    date_col = '일별'
    
    # 이미 datetime 형식이면 변환 불필요
    if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
        numeric_dates = pd.to_numeric(df[date_col], errors='coerce')
        date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30')
        mask = date_series.isna() & df[date_col].notna()
        if mask.any():
            try:
                date_series.loc[mask] = pd.to_datetime(df.loc[mask, date_col], errors='coerce')
            except Exception as e:
                pass
        df[date_col] = date_series

    df = df.dropna(subset=[date_col])
    
    # 월 컬럼 생성 (YYYY-MM)
    df['Month'] = df[date_col].dt.strftime('%Y-%m')
    
    # 최근 2개 월 확인
    unique_months = sorted(df['Month'].unique())
    if not unique_months:
        return {}
        
    current_month = unique_months[-1]
    prev_month = unique_months[-2] if len(unique_months) >= 2 else None
    
    # 데이터 전체에서의 마지막 날짜 (기준일)
    max_date = df[date_col].max().strftime('%Y-%m-%d')
    
    results = {
        "meta": {
            "current_month": current_month,
            "prev_month": prev_month,
            "max_date": max_date
        },
        "data": {}
    }
    
    def calculate_stats(sub_df, month):
        if sub_df.empty:
            return {"total": 0, "daily_avg": 0, "days_count": 0}
        
        monthly_data = sub_df[sub_df['Month'] == month]
        if monthly_data.empty:
             return {"total": 0, "daily_avg": 0, "days_count": 0}
             
        total_sales = monthly_data['판매액'].sum()
        days_count = monthly_data[date_col].nunique()
        daily_avg = total_sales / days_count if days_count > 0 else 0
        
        return {"total": total_sales, "daily_avg": daily_avg, "days_count": days_count}

    # Column names verification: The code uses '판매액' at line 637.
    # But earlier analysis or other functions might use '매출금액'.
    # I should verify which column `get_daily_hierarchical_sales` used.
    # Viewing result says: daily_sales = df.groupby(date_col)[['판매액', '이익']].sum()  <-- Line 637
    # So I will use '판매액'.
    
    categories = {
        "전체": lambda d: d,
        "이커머스": lambda d: d[d['파트구분'] == '이커머스'],
        "오프라인": lambda d: d[d['파트구분'] == '오프라인'],
        "마이비": lambda d: d[d['품목그룹1'] == '마이비'],
        "누비": lambda d: d[d['품목그룹1'] == '누비'],
        "쏭레브": lambda d: d[d['품목그룹1'] == '쏭레브']
    }
    
    for key, filter_func in categories.items():
        subset = filter_func(df)
        curr_stats = calculate_stats(subset, current_month)
        
        if prev_month:
            prev_stats = calculate_stats(subset, prev_month)
        else:
            prev_stats = {"total": 0, "daily_avg": 0}
        
        # Growth Rate (Current Daily Avg vs Prev Daily Avg)
        if prev_stats['daily_avg'] > 0:
            growth_rate = ((curr_stats['daily_avg'] - prev_stats['daily_avg']) / prev_stats['daily_avg']) * 100
        else:
            growth_rate = 0 if curr_stats['daily_avg'] == 0 else 100
            
        results["data"][key] = {
            "current_total": int(curr_stats['total']),
            "current_daily_avg": int(curr_stats['daily_avg']),
            "current_days": curr_stats['days_count'],
            "growth_rate": round(growth_rate, 1),
            "prev_total": int(prev_stats['total']),
            "prev_daily_avg": int(prev_stats['daily_avg'])
        }
        
    return results

def analyze_sales_performance(filename):
    df = get_dataframe(filename)
    if df.empty:
        return []

    # Column Cleaning: Remove trailing tabs and spaces
    df.columns = [str(c).strip() for c in df.columns]
    
    # Required columns mapping
    # Note: '거래쳐명' might be '거래처명' or have other chars. Using filtering.
    customer_col = next((c for c in df.columns if '거래쳐명' in c or '거래처명' in c), '거래쳐명')
    
    cols = {
        'date': '일별',
        'sales': '판매액',
        'profit': '이익',
        'channel': '파트구분',
        'sub_channel': '채널구분',
        'brand': '품목그룹1',
        'customer': customer_col,
        'main_channel': '주력 채널',
        'product_cat1': '품목 구분',
        'product_cat2': '품목 구분_2'
    }

    # Date Parsing (Robust)
    if not pd.api.types.is_datetime64_any_dtype(df[cols['date']]):
        numeric_dates = pd.to_numeric(df[cols['date']], errors='coerce')
        date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30')
        mask = date_series.isna() & df[cols['date']].notna()
        if mask.any():
            try:
                date_series.loc[mask] = pd.to_datetime(df.loc[mask, cols['date']], errors='coerce')
            except: pass
        df[cols['date']] = date_series
    
    df = df.dropna(subset=[cols['date']])
    df['Month'] = df[cols['date']].dt.to_period('M')

    # Latest Month (Target)
    unique_months = sorted(df['Month'].unique())
    if not unique_months: return []
    
    curr_month = unique_months[-1]
    prev_month = unique_months[-2] if len(unique_months) >= 2 else None
    
    # 3-Month Average (Excluding current)
    last_3_months = unique_months[-4:-1] if len(unique_months) >= 4 else []
    
    # Same Month Last Year
    yoy_month = curr_month - 12 if len(unique_months) >= 13 else None 

    alerts = []

    def get_period_stats(sub_df, period_months):
        if not period_months: return None
        if isinstance(period_months, pd.Period): period_months = [period_months]
        
        target_data = sub_df[sub_df['Month'].isin(period_months)]
        if target_data.empty: return None
        
        sales = target_data[cols['sales']].sum()
        profit = target_data[cols['profit']].sum()
        days = target_data[cols['date']].nunique()
        
        daily_sales = sales / days if days > 0 else 0
        profit_margin = (profit / sales * 100) if sales != 0 else 0
        
        return {'daily_sales': daily_sales, 'profit_margin': profit_margin}

    def generate_report(context, sub_df, display_name=None):
        if sub_df.empty: return
        
        # Determine display name
        name = display_name if display_name else context

        curr = get_period_stats(sub_df, curr_month)
        if not curr: return

        comparisons = [
            ('전월', prev_month),
            ('3개월 평균', last_3_months),
            ('전년 동월', yoy_month)
        ]

        for label, period in comparisons:
            base = get_period_stats(sub_df, period)
            
            # If base data is missing, we still might want to show it with 0 or skip? 
            # User said "fixed", so let's try to show it even if 0, but if period is None (e.g. no YoY data), skip.
            if not period and label == '전년 동월': continue 
            
            base_sales = base['daily_sales'] if base else 0
            base_margin = base['profit_margin'] if base else 0
            
            sales_diff_pct = 0
            if base_sales > 0:
                sales_diff_pct = ((curr['daily_sales'] - base_sales) / base_sales * 100)
            
            margin_diff_p = curr['profit_margin'] - base_margin
            
            # Status Logic (Simplified for reporting)
            # We want to see EVERYTHING. But color code it.
            status = "neutral" 
            if sales_diff_pct > 0: status = "good"
            elif sales_diff_pct < 0: status = "bad"
            
            # Construct distinct message finding
            msgs = []
            if abs(sales_diff_pct) > 0.1:
                direction = "증가" if sales_diff_pct > 0 else "감소"
                msgs.append(f"일평균 매출 {abs(sales_diff_pct):.1f}% {direction}")
            else:
                msgs.append("일평균 매출 동일")

            if abs(margin_diff_p) > 0.1:
                direction = "개선" if margin_diff_p > 0 else "하락"
                msgs.append(f"이익률 {abs(margin_diff_p):.1f}%p {direction}")
            
            alerts.append({
                "context": name,
                "target": label,
                "status": status,
                "message": ", ".join(msgs),
                "metrics": {
                    "curr_sales": int(curr['daily_sales']),
                    "curr_margin": round(curr['profit_margin'], 1),
                    "base_sales": int(base_sales),
                    "base_margin": round(base_margin, 1)
                }
            })

    # --- E-commerce Section Analysis ---
    ecommerce_df = df[df[cols['channel']] == '이커머스']
    if not ecommerce_df.empty:
        # 1. Overall E-commerce
        generate_report("이커머스 - 전체", ecommerce_df)

        # 2. Main Channels (주력) - Excluding Coupang
        main_mask = ecommerce_df[cols['main_channel']] == '주력'
        main_df = ecommerce_df[main_mask]
        generate_report("이커머스 - 주력 채널 (쿠팡 제외)", main_df)

        # 3. Specific Accounts
        target_accounts = [
            '쿠팡(로켓)', 
            '스팜(제제지크)', 
            '스팜(쏭레브)', 
            '11st', 
            '이베이', 
            '카카오', 
            'CJ', 
            '베이비빌리(주식회사 빌리지베이비)'
        ]
        
        for account in target_accounts:
            # Flexible matching for accounts might be needed, but user said exact match.
            # Let's try exact first.
            acc_df = ecommerce_df[ecommerce_df[cols['customer']] == account]
            if not acc_df.empty:
                generate_report(f"이커머스 - {account}", acc_df)

    # 4. Overseas (Before Offline)
    overseas_df = df[df[cols['sub_channel']] == '해외']
    if not overseas_df.empty:
        generate_report("해외", overseas_df)

    # --- Offline Section Analysis ---
    offline_df = df[df[cols['channel']] == '오프라인']
    if not offline_df.empty:
        generate_report("오프라인", offline_df)

    # 5. Offline Key Accounts (After Offline)
    # E-Mart
    emart_df = df[df[cols['customer']] == '이마트']
    if not emart_df.empty:
        generate_report("이마트", emart_df)
    
    # Lotte Mart
    lotte_df = df[df[cols['customer']] == '롯데마트']
    if not lotte_df.empty:
        generate_report("롯데마트", lotte_df)

    # Daiso
    daiso_df = df[df[cols['customer']] == '다이소']
    if not daiso_df.empty:
        generate_report("다이소", daiso_df)

    # Offline Agency
    agency_df = df[df[cols['sub_channel']] == '오프라인 대리점']
    if not agency_df.empty:
        generate_report("오프라인 대리점", agency_df)

    return alerts

def get_ecommerce_details(filename):
    df = get_dataframe(filename)
    if df.empty: return {}

    # Column Mapping (Local)
    df.columns = [str(c).strip() for c in df.columns]
    date_col = '일별'
    sales_col = '판매액'
    channel_col = '파트구분'
    
    # Fix for missing 'cols' definition
    cols = {'customer': '거래처명'}
    
    # Date Parsing
    if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
        numeric_dates = pd.to_numeric(df[date_col], errors='coerce')
        date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30')
        mask = date_series.isna() & df[date_col].notna()
        if mask.any():
             try: date_series.loc[mask] = pd.to_datetime(df.loc[mask, date_col], errors='coerce')
             except: pass
        df[date_col] = date_series
    
    df = df.dropna(subset=[date_col])
    
    # Function to get monthly and daily stats for a specific filter
    def get_stats(filtered_df):
        if filtered_df.empty: return {"monthly": [], "daily": []}
        
        # 1. Monthly
        f_df = filtered_df.copy()
        f_df['MonthPeriod'] = f_df[date_col].dt.to_period('M')
        monthly_stats = []
        for p in sorted(f_df['MonthPeriod'].unique()):
            m_df = f_df[f_df['MonthPeriod'] == p]
            sales = m_df[sales_col].sum()
            profit = m_df['이익'].sum()
            unique_days = m_df[date_col].nunique()
            days_in_month = calendar.monthrange(p.year, p.month)[1]
            divisor = days_in_month if unique_days == 1 else unique_days
            daily_avg = int(sales / divisor) if divisor > 0 else 0
            margin = round(profit / sales * 100, 1) if sales != 0 else 0
            monthly_stats.append({"Month": str(p), "판매액": sales, "이익률": margin, "일평균매출": daily_avg})
        
        # 2. Daily (Last 6 Months)
        max_d = f_df[date_col].max()
        six_m = max_d - pd.DateOffset(months=6)
        d_df = f_df[f_df[date_col] >= six_m].copy()
        d_df['Date'] = d_df[date_col].dt.strftime('%Y-%m-%d')
        daily_g = d_df.groupby('Date').agg({sales_col: 'sum', '이익': 'sum'}).reset_index()
        
        # Robust Margin calculation for Daily data
        with np.errstate(divide='ignore', invalid='ignore'):
            daily_g['이익률'] = (daily_g['이익'] / daily_g[sales_col] * 100)
            daily_g['이익률'] = daily_g['이익률'].replace([np.inf, -np.inf], np.nan).fillna(0).round(1)
        
        return {"monthly": monthly_stats, "daily": daily_g.to_dict('records')}

    # E-commerce (Existing)
    ecommerce_df = df[df[channel_col] == '이커머스']
    ecommerce_data = get_stats(ecommerce_df)

    # Offline
    offline_df = df[df[channel_col] == '오프라인']
    offline_data = get_stats(offline_df)

    # Brands
    brand_col = '품목그룹1' # Brand column
    myb_data = get_stats(df[df[brand_col] == '마이비'])
    nubi_data = get_stats(df[df[brand_col] == '누비'])
    sonreve_data = get_stats(df[df[brand_col] == '쏭레브'])
    
    # Specific Intersection: Ecommerce + MyB
    ecommerce_myb_df = df[(df[channel_col] == '이커머스') & (df[brand_col] == '마이비')]
    ecommerce_myb_data = get_stats(ecommerce_myb_df)

    # Specific Intersection: Ecommerce + Nubi
    ecommerce_nubi_df = df[(df[channel_col] == '이커머스') & (df[brand_col] == '누비')]
    ecommerce_nubi_data = get_stats(ecommerce_nubi_df)

    # Specific Intersection: Ecommerce + Sonreve
    ecommerce_sonreve_df = df[(df[channel_col] == '이커머스') & (df[brand_col] == '쏭레브')]
    ecommerce_sonreve_data = get_stats(ecommerce_sonreve_df)

    # Specific Intersection: Offline + MyB
    offline_myb_df = df[(df[channel_col] == '오프라인') & (df[brand_col] == '마이비')]
    offline_myb_data = get_stats(offline_myb_df)

    # Specific Intersection: Offline + Nubi
    offline_nubi_df = df[(df[channel_col] == '오프라인') & (df[brand_col] == '누비')]
    offline_nubi_data = get_stats(offline_nubi_df)

    # Specific Intersection: Offline + Sonreve
    offline_sonreve_df = df[(df[channel_col] == '오프라인') & (df[brand_col] == '쏭레브')]
    offline_sonreve_data = get_stats(offline_sonreve_df)

    # Specific Intersection: Main Channels (Excluding Coupang)
    main_ex_coupang_df = df[(df[channel_col] == '이커머스') & (df['주력 채널'] == '주력')]
    main_overall_data = get_stats(main_ex_coupang_df)
    main_myb_data = get_stats(main_ex_coupang_df[main_ex_coupang_df[brand_col] == '마이비'])
    main_nubi_data = get_stats(main_ex_coupang_df[main_ex_coupang_df[brand_col] == '누비'])
    main_sonreve_data = get_stats(main_ex_coupang_df[main_ex_coupang_df[brand_col] == '쏭레브'])

    # Specific Category: Stain Remover (얼룩제거제)
    product_type_col = '품목 구분'
    stain_remover_ecommerce_df = ecommerce_df[ecommerce_df[product_type_col] == '얼룩제거제']
    stain_remover_offline_df = offline_df[offline_df[product_type_col] == '얼룩제거제']
    stain_remover_main_df = main_ex_coupang_df[main_ex_coupang_df[product_type_col] == '얼룩제거제']

    stain_ecommerce_data = get_stats(stain_remover_ecommerce_df)
    stain_offline_data = get_stats(stain_remover_offline_df)
    stain_main_data = get_stats(stain_remover_main_df)

    # Bulk extraction for categories
    categories_to_extract = {
        'stain': '얼룩제거제',
        "mild": "순한라인",
        "boil": "삶기세제",
        "dryer": "건조기시트",
        "capsule": "캡슐세제",
        "fluoride": "비건 고불소 치약",
        "oral": "구강티슈",
        "pad": "수유패드",
        "bath": "욕조클리너",
        # Nubi Categories
        'nubi_longhandle': '롱핸들',
        'nubi_stainless': '스텐 물병',
        'nubi_jungle': '정글 물병',
        'nubi_spoon': '3스텝 스푼',
        'nubi_2in1': '2in1 컵',
        'nubi_ladybug': '무당벌레 빨대컵',
        'nubi_pacifier': '실리콘노리개',
        # Sonreve Categories
        'sonreve_toneup': '톤업 크림',
        'sonreve_shampoo': '키즈 샴푸',
        'sonreve_cleanser': '키즈 페이셜클렌저',
        'sonreve_lotion': '키즈 페이셜로션'
    }
    
    cat_results = {}
    for key, cat_name in categories_to_extract.items():
        cat_results[f"{key}_ecommerce"] = get_stats(ecommerce_df[ecommerce_df[product_type_col] == cat_name])
        cat_results[f"{key}_offline"] = get_stats(offline_df[offline_df[product_type_col] == cat_name])
        cat_results[f"{key}_main"] = get_stats(main_ex_coupang_df[main_ex_coupang_df[product_type_col] == cat_name])
    
    # Account-Specific Analysis
    target_accounts = {
        'coupang': '쿠팡(로켓)',
        'naver_zeze': '스팜(제제지크)',
        'naver_sonreve': '스팜(쏭레브)',
        '11st': '11st',
        'ebay': '이베이',
        'kakao': '카카오',
        'cj': 'CJ',
        'babybilly': '베이비빌리(주식회사 빌리지베이비)'
    }

    account_results = {}
    for key, account_name in target_accounts.items():
        # Filter for specific account
        acc_df = ecommerce_df[ecommerce_df[cols['customer']] == account_name]
        
        # Overall Account Data
        account_results[key] = get_stats(acc_df)
        
        # Account + Brand Data
        account_results[f"{key}_myb"] = get_stats(acc_df[acc_df[brand_col] == '마이비'])
        account_results[f"{key}_nubi"] = get_stats(acc_df[acc_df[brand_col] == '누비'])
        account_results[f"{key}_sonreve"] = get_stats(acc_df[acc_df[brand_col] == '쏭레브'])
        
        # Account + Category Data (Reuse defined categories)
        for cat_key, cat_name in categories_to_extract.items():
            account_results[f"{cat_key}_{key}"] = get_stats(acc_df[acc_df[product_type_col] == cat_name])

    # New Segments: Channel-Based (Overseas, Agency)
    new_channel_segments = {
        'overseas': '해외',
        'agency': '오프라인 대리점'
    }
    for key, channel_name in new_channel_segments.items():
        c_df = df[df[channel_col] == channel_name]
        account_results[key] = get_stats(c_df)
        account_results[f"{key}_myb"] = get_stats(c_df[c_df[brand_col] == '마이비'])
        account_results[f"{key}_nubi"] = get_stats(c_df[c_df[brand_col] == '누비'])
        account_results[f"{key}_sonreve"] = get_stats(c_df[c_df[brand_col] == '쏭레브'])
        for cat_key, cat_name in categories_to_extract.items():
            account_results[f"{cat_key}_{key}"] = get_stats(c_df[c_df[product_type_col] == cat_name])

    # New Segments: Customer-Based (E-Mart, Lotte, Daiso)
    new_customer_segments = {
        'emart': '이마트',
        'lotte': '롯데마트',
        'daiso': '다이소'
    }
    for key, customer_name in new_customer_segments.items():
        c_df = df[df[cols['customer']] == customer_name]
        account_results[key] = get_stats(c_df)
        account_results[f"{key}_myb"] = get_stats(c_df[c_df[brand_col] == '마이비'])
        account_results[f"{key}_nubi"] = get_stats(c_df[c_df[brand_col] == '누비'])
        account_results[f"{key}_sonreve"] = get_stats(c_df[c_df[brand_col] == '쏭레브'])
        for cat_key, cat_name in categories_to_extract.items():
            account_results[f"{cat_key}_{key}"] = get_stats(c_df[c_df[product_type_col] == cat_name])

    return {
        "ecommerce": ecommerce_data,
        "offline": offline_data,
        "myb": myb_data,
        "nubi": nubi_data,
        "sonreve": sonreve_data,
        "ecommerce_myb": ecommerce_myb_data,
        "ecommerce_nubi": ecommerce_nubi_data,
        "ecommerce_sonreve": ecommerce_sonreve_data,
        "offline_myb": offline_myb_data,
        "offline_nubi": offline_nubi_data,
        "offline_sonreve": offline_sonreve_data,
        "main_overall": main_overall_data,
        "main_myb": main_myb_data,
        "main_nubi": main_nubi_data,
        "main_sonreve": main_sonreve_data,
        "stain_ecommerce": stain_ecommerce_data,
        "stain_offline": stain_offline_data,
        "stain_main": stain_main_data,
        **cat_results,
        **account_results
    }
