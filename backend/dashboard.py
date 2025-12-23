import pandas as pd
import os
import calendar

def get_monthly_sales_by_channel(filename: str):
    """
    월별 이커머스 vs 오프라인 매출 데이터 반환
    """
    # Use absolute path relative to this file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    # 데이터 로드
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    
    # 컬럼명 클리닝
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    # Handle known typos
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
        
    df = clean_numeric_columns(df)
    
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
    
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
    
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
    
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
        
    df = clean_numeric_columns(df)
    
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
    
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    # Handle known typos
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
    
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

def get_channel_layer_sales(filename: str, part: str = None, channel: str = None, account: str = None):
    """
    조건(파트 > 채널 > 거래처)에 따른 월별 매출 데이터 반환
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    # Handle known typos
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
        
    df = clean_numeric_columns(df)
    
    all_months = sorted(df['월구분'].unique())
    # Removed duplicate sorted call
    days_list, debug_logs = calculate_days_list(df, all_months)
    
    df_filtered = df.copy()
    current_label = "전체 채널"
    
    if part and part != 'all':
        df_filtered = df_filtered[df_filtered['파트구분'] == part]
        current_label = part
        
    if channel and channel != 'all':
        df_filtered = df_filtered[df_filtered['채널구분'] == channel]
        current_label = channel
        
    if account and account != 'all':
        df_filtered = df_filtered[df_filtered['거래처명'] == account]
        current_label = account
        
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
