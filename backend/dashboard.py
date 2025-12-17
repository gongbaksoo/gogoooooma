import pandas as pd
import os

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
    
    # 결과 포맷팅
    result = {
        "months": [str(int(month)) for month in pivot_df.index.tolist()],
        "ecommerce": ecommerce_values,
        "offline": offline_values,
        "total": total_values
    }
    
    return result

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
    
    # 결과 포맷팅
    result = {
        "months": [str(int(month)) for month in pivot_df.index.tolist()],
        "groups": {}
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
    df.columns = df.columns.str.replace('\\t', '').str.strip()
    
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
    df.columns = df.columns.str.replace('\\t', '').str.strip()
    
    # 1. 월별 전체 데이터를 먼저 구해서 모든 월 리스트 확보
    all_months = sorted(df['월구분'].unique())
    
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
        "label": current_label
    }
    
    return result
