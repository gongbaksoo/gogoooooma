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
