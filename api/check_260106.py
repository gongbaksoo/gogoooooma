#!/usr/bin/env python3
"""
Check 260106.csv file for actual date range
"""
import pandas as pd
import os

filename = '260106.csv'
# Try multiple locations
possible_paths = [
    os.path.join('api', 'uploads', filename),
    os.path.join('uploads', filename),
    filename
]

file_path = None
for path in possible_paths:
    if os.path.exists(path):
        file_path = path
        break

if not file_path:
    print(f"❌ File not found: {filename}")
    print(f"Searched in: {possible_paths}")
    exit(1)

print(f"✅ File found: {file_path}\n")

# Read CSV
df = pd.read_csv(file_path)
df.columns = df.columns.str.replace('\t', '').str.strip()

print(f"Total rows: {len(df):,}")
print(f"Total columns: {len(df.columns)}\n")

# Check both 월구분 and 일별 columns
if '월구분' in df.columns:
    unique_months = sorted(df['월구분'].dropna().unique())
    print(f"=== 월구분 컬럼 분석 ===")
    print(f"Unique months: {len(unique_months)}")
    print(f"Min: {int(min(unique_months))}")
    print(f"Max: {int(max(unique_months))}")
    print(f"\nFirst 5 months: {[int(m) for m in unique_months[:5]]}")
    print(f"Last 5 months: {[int(m) for m in unique_months[-5:]]}\n")
else:
    print("❌ '월구분' column not found\n")

if '일별' in df.columns:
    print(f"=== 일별 컬럼 분석 ===")
    # Parse dates
    numeric_dates = pd.to_numeric(df['일별'], errors='coerce')
    date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30', errors='coerce')
    
    # Also try string parsing
    mask = date_series.isna() & df['일별'].notna()
    if mask.any():
        date_series.loc[mask] = pd.to_datetime(df.loc[mask, '일별'], errors='coerce')
    
    valid_dates = date_series.dropna()
    
    if not valid_dates.empty:
        print(f"Valid dates: {len(valid_dates):,}")
        print(f"Min date: {valid_dates.min().strftime('%Y-%m-%d')}")
        print(f"Max date: {valid_dates.max().strftime('%Y-%m-%d')}")
        
        # Extract year-month
        year_months = valid_dates.dt.to_period('M').unique()
        print(f"Unique year-months: {len(year_months)}")
        print(f"First 5: {sorted(year_months)[:5]}")
        print(f"Last 5: {sorted(year_months)[-5:]}")
    else:
        print("❌ No valid dates found")
else:
    print("❌ '일별' column not found")
