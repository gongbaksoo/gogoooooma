import pandas as pd
import os

def inspect_day_col():
    file_path = "uploads/avk.xlsx"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"Loading {file_path}...")
    df = pd.read_excel(file_path)
    
    # Flexible column search for 'Day'
    day_col_candidates = ['일구분', '일자', '일', 'Day', 'day', 'Date', 'date']
    day_col = next((col for col in day_col_candidates if col in df.columns), None)
    
    if day_col:
        print(f"Found day column: {day_col}")
        print("Sample values:")
        print(df[day_col].head(10).tolist())
        print("Unique values (first 20):")
        print(df[day_col].unique()[:20])
        print("Dtypes:")
        print(df[day_col].apply(type).value_counts())
    else:
        print("Day column NOT found.")

if __name__ == "__main__":
    inspect_day_col()
