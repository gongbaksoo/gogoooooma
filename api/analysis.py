import pandas as pd
import numpy as np
import io

def analyze_sales_data(file_path: str):
    """
    엑셀 파일을 읽어서 매출 분석 결과를 반환합니다.
    """
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path, engine='openpyxl')
        
        # 필수 컬럼 확인 (예시: 날짜, 상품명, 수량, 금액)
        # 실제 데이터에 따라 컬럼명 조정 필요. 여기서는 유연하게 처리하거나 가정을 둠.
        # 일단 데이터의 앞부분과 기본 통계만 반환하도록 작성
        
        # 1. Convert Timestamp/Datetime columns to string
        # This prevents JSON serialization errors with Pandas timestamps
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].astype(str)
        
        # 2. Handle Numeric Columns: Stats & Cleaning
        # Get statistics only for numeric columns
        stats = df.describe(include=[np.number]) 
        
        # 3. Clean Dataframe for JSON (Replace NaN/Inf with None)
        # We create a COPY for display to avoid messing up the original df if we needed it for something else
        # Cast to object to allow replacements
        df_display = df.astype(object)
        df_display.replace([np.inf, -np.inf, np.nan], None, inplace=True)
        
        # 4. Clean Statistics for JSON
        stats_obj = stats.astype(object)
        stats_obj.replace([np.inf, -np.inf, np.nan], None, inplace=True)

        # Clean column names by stripping whitespace/tabs
        clean_columns = [str(c).strip() for c in df.columns]
        
        # Also need to clean the preview data to use the cleaned column names
        preview_data = df_display.head().to_dict(orient="records")
        cleaned_preview = []
        for row in preview_data:
            cleaned_row = {str(k).strip(): v for k, v in row.items()}
            cleaned_preview.append(cleaned_row)
        
        summary = {
            "total_rows": len(df),
            "columns": clean_columns,
            "preview": cleaned_preview,
            "statistics": stats_obj.T.to_dict()  # Transpose so columns become keys, stats become nested values
        }
        
        return summary
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise ValueError(f"데이터 분석/변환 오류: {str(e)}")
