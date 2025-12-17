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
    days_list = calculate_days_list(df, pivot_df.index.tolist())

    # 결과 포맷팅
    result = {
        "months": months,
        "ecommerce": ecommerce_values,
        "offline": offline_values,
        "total": total_values,
        "days_list": days_list
    }
    
    return result

def get_days_in_month(year, month):
    """해당 연/월의 총 일수 반환"""
    return calendar.monthrange(year, month)[1]

def calculate_days_list(df, months):
    """
    각 월별 나눌 일수 리스트 반환
    - 과거 월: 달력상 총 일수
    - 최신 월: 데이터 상의 최대 일자 (일구분 컬럼 활용)
    """
    if '일구분' not in df.columns:
        # 일구분 없으면 그냥 달력 일수 반환 (Fallback)
        days_list = []
        for m_str in months:
            year = 2024 # 기본값, 필요시 로직 개선
            if len(str(m_str)) == 6: # YYYYMM
                year = int(str(m_str)[:4])
                month = int(str(m_str)[4:])
            elif len(str(m_str)) == 4: # YYMM
                year = 2000 + int(str(m_str)[:2])
                month = int(str(m_str)[2:])
            else:
                month = int(m_str) # 단순 월 숫자만 있는 경우 등
            
            days_list.append(get_days_in_month(year, month))
        return days_list

    # 최신 월 파악 (입력된 months 리스트 기준)
    # months는 이미 정렬되어 있다고 가정하지만, 안전을 위해 다시 정렬 및 문자열 변환
    valid_months = [str(m) for m in months if str(m).isdigit()]
    sorted_months = sorted(valid_months)
    
    if not sorted_months:
        return []
        
    latest_month = sorted_months[-1] # 가장 큰 값이 최신 월 (예: '2512')
    
    days_list = []
    for m_str in months:
        # 월 파싱
        m_str = str(m_str)
        year = 2024 # Default year, adjust as needed
        if len(m_str) == 4: # YYMM (예: 2501)
            year = 2000 + int(m_str[:2])
            month = int(m_str[2:])
        elif len(m_str) == 5 or len(m_str) == 6: # YYYYMM
            year = int(m_str[:-2])
            month = int(m_str[-2:])
        else:
            # 포맷 불명확 시 
            days_list.append(30)
            continue

        if m_str == str(latest_month):
            # 최신 월인 경우: 해당 월 데이터 중 최대 일자 찾기
            # 월구분이 숫자/문자 섞여있을 수 있으므로 주의
            # 해당 월의 데이터만 필터링
            # 주의: df['월구분'] 타입을 맞춰야 함
            try:
                # df['월구분']이 int일 수도 string일 수도 있음
                latest_month_val = int(latest_month) if isinstance(df['월구분'].iloc[0], (int, float)) else latest_month
                
                # 해당 월 데이터
                month_df = df[df['월구분'] == latest_month_val]
                
                if not month_df.empty:
                    # 일구분 최대값 (가끔 일구분이 날짜 풀텍스트일 수도 있으나, 보통 '일' 숫자라고 가정)
                    # 데이터 샘플상 '일구분'이 있다면 활용
                    max_day = month_df['일구분'].max()
                    days_list.append(int(max_day))
                else:
                    days_list.append(get_days_in_month(year, month))
            except:
                days_list.append(get_days_in_month(year, month))
        else:
            # 과거 월: 달력 기준
            days_list.append(get_days_in_month(year, month))
            
    return days_list

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
    
    days_list = calculate_days_list(df, pivot_df.index.tolist())
    
    result = {
        "months": [str(int(month)) for month in pivot_df.index.tolist()],
        "groups": {},
        "days_list": days_list
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
    days_list = calculate_days_list(df, all_months)
    
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
        "days_list": days_list
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
    days_list = calculate_days_list(df, all_months)
    
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
        "days_list": days_list
    }
    
    return result
