#!/usr/bin/env python3
"""
Diagnostic script to check 일별 column for 2026-01 dates
"""
import pandas as pd
import os

def check_date_column(filename):
    """Check what dates exist in 일별 column"""
    file_path = os.path.join('uploads', filename)
    
    if not os.path.exists(file_path):
        return f"❌ File not found: {filename}"
    
    try:
        # Read Excel file
        df = pd.read_excel(file_path)
        
        # Clean column names
        df.columns = df.columns.str.replace('\t', '').str.strip()
        
        date_col = '일별'
        
        # Check if '일별' column exists
        if date_col not in df.columns:
            return f"❌ {filename}: '일별' column not found. Available columns: {list(df.columns[:10])}"
        
        # Parse dates
        numeric_dates = pd.to_numeric(df[date_col], errors='coerce')
        date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30', errors='coerce')
        
        # Also try string parsing for any non-numeric dates
        mask = date_series.isna() & df[date_col].notna()
        if mask.any():
            date_series.loc[mask] = pd.to_datetime(df.loc[mask, date_col], errors='coerce')
        
        # Drop NaT values
        valid_dates = date_series.dropna()
        
        if valid_dates.empty:
            return f"❌ {filename}: No valid dates found in '일별' column"
        
        # Get min and max dates
        min_date = valid_dates.min()
        max_date = valid_dates.max()
        
        # Check for 2026 dates
        dates_2026 = valid_dates[valid_dates.dt.year == 2026]
        has_2026 = len(dates_2026) > 0
        
        result = f"\n{'='*60}\n"
        result += f"📁 File: {filename}\n"
        result += f"{'='*60}\n"
        result += f"Min date: {min_date.strftime('%Y-%m-%d')}\n"
        result += f"Max date: {max_date.strftime('%Y-%m-%d')}\n"
        result += f"Total date records: {len(valid_dates)}\n"
        result += f"Contains 2026 data: {'✅ YES' if has_2026 else '❌ NO'}\n"
        
        if has_2026:
            result += f"\n2026 dates found: {len(dates_2026)} records\n"
            result += f"First 2026 date: {dates_2026.min().strftime('%Y-%m-%d')}\n"
            result += f"Last 2026 date: {dates_2026.max().strftime('%Y-%m-%d')}\n"
            
            # Show unique 2026 year-months
            months_2026 = dates_2026.dt.to_period('M').unique()
            result += f"\n2026 months:\n"
            for m in sorted(months_2026):
                result += f"  - {m}\n"
        
        return result
        
    except Exception as e:
        return f"❌ Error reading {filename}: {str(e)}"

if __name__ == "__main__":
    print("🔍 Checking '일별' column for 2026 dates...\n")
    
    files_to_check = [
        'avk_1.xlsx',
        '251219-1.xlsx'
    ]
    
    for filename in files_to_check:
        print(check_date_column(filename))
    
    print("\n" + "="*60)
    print("✅ Analysis complete")
