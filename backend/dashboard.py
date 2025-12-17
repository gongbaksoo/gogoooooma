import pandas as pd
import os
import calendar

def get_monthly_sales_by_channel(filename: str):
    """
    월별 이커머스 vs 오프라인 매출 데이터 반환
    """
    file_path = os.path.join("uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    # 데이터 로드
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    
    # 컬럼명 클리닝
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    # Handle known typos
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
    
    # 필요한 컬럼 확인
    required_cols = ['월구분', '파트구분', '판매액']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in data")
    
    # 이커머스와 오프라인만 필터링
    df_filtered = df[df['파트구분'].isin(['이커머스', '오프라인'])].copy()
    
    # 월구분과 파트구분으로 그룹화하여 합계
    monthly_sales = df_filtered.groupby(['월구분', '파트구분'])['판매액'].sum().reset_index()
    
    # 피벗하여 이커머스와 오프라인을 별도 컬럼으로
    pivot_df = monthly_sales.pivot(index='월구분', columns='파트구분', values='판매액').fillna(0)
    
    # 월구분 정렬
    pivot_df = pivot_df.sort_index()
    
    # 총 매출 계산 (이커머스 + 오프라인)
    ecommerce_values = pivot_df.get('이커머스', pd.Series([0] * len(pivot_df))).tolist()
    offline_values = pivot_df.get('오프라인', pd.Series([0] * len(pivot_df))).tolist()
    total_values = [e + o for e, o in zip(ecommerce_values, offline_values)]
    
    months = [str(int(month)) for month in pivot_df.index.tolist()]
    months = [str(int(month)) for month in pivot_df.index.tolist()]
    days_list, debug_logs = calculate_days_list(df, pivot_df.index.tolist())

    # 결과 포맷팅
    result = {
        "months": months,
        "ecommerce": ecommerce_values,
        "offline": offline_values,
        "total": total_values,
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    return result

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
            first_val = df['월구분'].iloc[0]
            month_val_for_filter = int(m_str) if isinstance(first_val, (int, float)) else m_str
            
            month_df = df[df['월구분'] == month_val_for_filter]
            
            if not month_df.empty:
                # ----------------------------------------------------------------
                # FIX: Filter for rows with Sales > 0 to ignore future placeholder dates
                # Many excel files pre-fill days 1-31 with 0 sales.
                # max('day_col') would be 31. We want max day WITH SALES.
                # ----------------------------------------------------------------
                
                # Ensure '판매액' is numeric
                month_df_valid = month_df[pd.to_numeric(month_df['판매액'], errors='coerce').fillna(0) > 0]
                
                if not month_df_valid.empty:
                    max_day = month_df_valid[day_col].max()
                    logs.append(f"Month {m_str}: Max day with sales>0 is {max_day}")
                else:
                    # If NO sales > 0 found (e.g. all 0), fall back to raw max or calendar?
                    # Use raw max but log it.
                    max_day = month_df[day_col].max()
                    logs.append(f"Month {m_str}: No sales > 0. Using raw max {max_day}")

                if max_day > 0:
                    days_list.append(int(max_day))
                else:
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
    file_path = os.path.join("uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    # 데이터 로드
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    
    # 컬럼명 클리닝
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
        
    # 필요한 컬럼 확인
    required_cols = ['월구분', '품목그룹1', '판매액']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in data")
    
    # 월구분과 품목그룹1으로 그룹화하여 합계
    monthly_sales = df.groupby(['월구분', '품목그룹1'])['판매액'].sum().reset_index()
    
    # 피벗하여 각 품목그룹을 별도 컬럼으로
    pivot_df = monthly_sales.pivot(index='월구분', columns='품목그룹1', values='판매액').fillna(0)
    
    # 월구분 정렬
    pivot_df = pivot_df.sort_index()
    
    # 품목그룹 리스트 (매출액 기준 내림차순 정렬)
    group_totals = pivot_df.sum().sort_values(ascending=False)
    top_groups = group_totals.head(10).index.tolist()  # 상위 10개 품목그룹
    
    days_list, debug_logs = calculate_days_list(df, pivot_df.index.tolist())
    
    result = {
        "months": [str(int(month)) for month in pivot_df.index.tolist()],
        "groups": {},
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    # 각 품목그룹의 월별 데이터 추가
    for group in top_groups:
        if group in pivot_df.columns:
            result["groups"][group] = pivot_df[group].tolist()
    
    return result

def get_hierarchical_options(filename: str):
    """
    품목그룹 > 품목 구분 > 품목 구분_2 계층 구조 옵션 반환
    """
    file_path = os.path.join("uploads", filename)
    
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

def get_filtered_monthly_sales(filename: str, group: str = None, category: str = None, sub_category: str = None):
    """
    조건에 따른 월별 매출 데이터 반환
    """
    file_path = os.path.join("uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
    
    # 1. 월별 전체 데이터를 먼저 구해서 모든 월 리스트 확보
    all_months = sorted(df['월구분'].unique())
    all_months = sorted(df['월구분'].unique())
    days_list, debug_logs = calculate_days_list(df, all_months)
    
    # 2. 필터링
    df_filtered = df.copy()
    
    current_label = "전체"
    
    if group and group != 'all':
        df_filtered = df_filtered[df_filtered['품목그룹1'] == group]
        current_label = group
        
    if category and category != 'all':
        df_filtered = df_filtered[df_filtered['품목 구분'] == category]
        current_label = f"{group} > {category}"
        
    if sub_category and sub_category != 'all':
        df_filtered = df_filtered[df_filtered['품목 구분_2'] == sub_category]
        current_label = sub_category
        
    # 3. 월별 매출 집계
    monthly_sales = df_filtered.groupby('월구분')['판매액'].sum().reindex(all_months, fill_value=0)
    
    # 4. 결과 포맷팅
    result = {
        "months": [str(int(month)) for month in all_months],
        "sales": monthly_sales.values.tolist(),
        "label": current_label,
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    return result

def get_channel_layer_options(filename: str):
    """
    파트구분 > 채널구분 > 거래처명 계층 구조 옵션 반환
    """
    file_path = os.path.join("uploads", filename)
    
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
    file_path = os.path.join("uploads", filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {filename}")
    
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    df.columns = df.columns.str.replace('\t', '').str.strip()
    
    # Handle known typos
    if '거래쳐명' in df.columns:
        df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
    
    all_months = sorted(df['월구분'].unique())
    all_months = sorted(df['월구분'].unique())
    days_list, debug_logs = calculate_days_list(df, all_months)
    
    df_filtered = df.copy()
    current_label = "전체 채널"
    
    if part and part != 'all':
        df_filtered = df_filtered[df_filtered['파트구분'] == part]
        current_label = part
        
    if channel and channel != 'all':
        df_filtered = df_filtered[df_filtered['채널구분'] == channel]
        current_label = f"{part} > {channel}"
        
    if account and account != 'all':
        df_filtered = df_filtered[df_filtered['거래처명'] == account]
        current_label = account
        
    monthly_sales = df_filtered.groupby('월구분')['판매액'].sum().reindex(all_months, fill_value=0)
    
    result = {
        "months": [str(int(month)) for month in all_months],
        "sales": monthly_sales.values.tolist(),
        "label": current_label,
        "days_list": days_list,
        "debug_logs": debug_logs
    }
    
    return result
