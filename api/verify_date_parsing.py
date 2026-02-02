import pandas as pd
import os
import sys
# Add api directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dashboard import get_dataframe

def verify_parsing():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    uploads_dir = os.path.join(base_dir, "uploads")
    
    files = [f for f in os.listdir(uploads_dir) if f.endswith('.csv') or f.endswith('.xlsx')]
    if not files: return
    latest_file = max([os.path.join(uploads_dir, f) for f in files], key=os.path.getmtime)
    filename = os.path.basename(latest_file)
    print(f"Testing File: {filename}")
    
    df = get_dataframe(filename)
    date_col = '일별'
    
    if date_col not in df.columns:
        print("Date col not found")
        return

    # Simulate logic from dashboard.py
    print("--- Simulating Parsing ---")
    
    raw_series = df[date_col]
    print(f"Raw Head: {raw_series.head().tolist()}")
    
    numeric_dates = pd.to_numeric(raw_series, errors='coerce')
    print(f"Numeric Head: {numeric_dates.head().tolist()}")
    
    date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30')
    print(f"Date Series (from Numeric) Head: {date_series.head().tolist()}")
    
    mask = date_series.isna() & raw_series.notna()
    print(f"Mask sum: {mask.sum()} / {len(mask)}")
    
    if mask.any():
        try:
            # Explicitly test parsing of masked values
            subset = raw_series[mask]
            print(f"Subset to parse (head): {subset.head().tolist()}")
            
            parsed_subset = pd.to_datetime(subset, errors='coerce')
            print(f"Parsed Subset (head): {parsed_subset.head().tolist()}")
            
            date_series.loc[mask] = parsed_subset
        except Exception as e:
            print(f"Error in subset parsing: {e}")
            
    print(f"Final Date Series Head: {date_series.head().tolist()}")
    print(f"NaT Count: {date_series.isna().sum()}")
    
    # Check Drop
    df['parsed_date'] = date_series
    df_dropped = df.dropna(subset=['parsed_date'])
    print(f"Rows before drop: {len(df)}")
    print(f"Rows after drop: {len(df_dropped)}")

if __name__ == "__main__":
    verify_parsing()
