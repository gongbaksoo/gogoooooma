import pandas as pd
import os
import sys
# Add api directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dashboard import get_dataframe

def check_date_column():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    uploads_dir = os.path.join(base_dir, "uploads")
    
    # Find latest file
    files = [f for f in os.listdir(uploads_dir) if f.endswith('.xlsx') or f.endswith('.csv')]
    if not files:
        print("No files found.")
        return
        
    latest_file = max([os.path.join(uploads_dir, f) for f in files], key=os.path.getmtime)
    filename = os.path.basename(latest_file)
    print(f"Checking file: {filename}")
    
    df = get_dataframe(filename)
    date_col = '일별'
    
    if date_col in df.columns:
        print(f"Column '{date_col}' Type: {df[date_col].dtype}")
        print(f"Sample values (head): {df[date_col].head().tolist()}")
        # Check for numeric range if numeric
        if pd.api.types.is_numeric_dtype(df[date_col]):
             min_val = df[date_col].min()
             max_val = df[date_col].max()
             print(f"Min Value: {min_val}, Max Value: {max_val}")
             
        # Check standard casting behavior
        print("--- Parsing Test ---")
        sample = df[date_col].iloc[0]
        try:
             # Just force numeric
             as_num = pd.to_numeric(sample, errors='coerce')
             print(f"As numeric: {as_num}")
             if not pd.isna(as_num):
                 as_date_excel = pd.to_datetime(as_num, unit='D', origin='1899-12-30')
                 print(f"Interpreted as Excel Serial: {as_date_excel}")
        except Exception as e:
             print(f"Parsing test error: {e}")
            
    else:
        print(f"Column '{date_col}' NOT found.")

if __name__ == "__main__":
    check_date_column()
