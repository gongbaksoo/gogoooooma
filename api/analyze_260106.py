#!/usr/bin/env python3
"""
Comprehensive analysis of 260106_4.csv to find date range issues
"""
import pandas as pd
import os

filename = '260106_4.csv'
file_path = os.path.join('uploads', filename)

print(f"=== Analyzing {filename} ===\n")

# Read CSV
df = pd.read_csv(file_path, encoding='utf-8-sig')
df.columns = df.columns.str.replace('\t', '').str.strip()

print(f"Total rows: {len(df):,}")
print(f"Total columns: {len(df.columns)}")
print(f"\nFirst 10 columns: {list(df.columns[:10])}\n")

# 1. Check 월구분 column
if '월구분' in df.columns:
    print("=" * 60)
    print("1️⃣ 월구분 컬럼 분석")
    print("=" * 60)
    unique_months = sorted(df['월구분'].dropna().unique())
    print(f"Unique months: {len(unique_months)}")
    print(f"Range: {int(min(unique_months))} ~ {int(max(unique_months))}")
    print(f"\nFirst 5: {[int(m) for m in unique_months[:5]]}")
    print(f"Last 5: {[int(m) for m in unique_months[-5:]]}")
    
    has_2026 = any(str(int(m)).startswith('26') for m in unique_months)
    print(f"\n✅ Contains 2026: {has_2026}")
    if has_2026:
        months_2026 = [int(m) for m in unique_months if str(int(m)).startswith('26')]
        print(f"2026 months: {months_2026}")
else:
    print("❌ '월구분' column not found")

# 2. Check 일별 column
if '일별' in df.columns:
    print("\n" + "=" * 60)
    print("2️⃣ 일별 컬럼 분석")
    print("=" * 60)
    
    # Try parsing as Excel serial date
    numeric_dates = pd.to_numeric(df['일별'], errors='coerce')
    date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30', errors='coerce')
    
    # Also try string parsing
    mask = date_series.isna() & df['일별'].notna()
    if mask.any():
        date_series.loc[mask] = pd.to_datetime(df.loc[mask, '일별'], errors='coerce')
    
    valid_dates = date_series.dropna()
    
    print(f"Valid dates: {len(valid_dates):,} / {len(df):,}")
    print(f"Invalid dates: {len(df) - len(valid_dates):,}")
    
    if not valid_dates.empty:
        print(f"\nDate range: {valid_dates.min().strftime('%Y-%m-%d')} ~ {valid_dates.max().strftime('%Y-%m-%d')}")
        
        # Group by year-month
        year_months = valid_dates.dt.to_period('M')
        unique_periods = sorted(year_months.unique())
        
        print(f"\nUnique year-months: {len(unique_periods)}")
        print(f"First 5: {[str(p) for p in unique_periods[:5]]}")
        print(f"Last 5: {[str(p) for p in unique_periods[-5:]]}")
        
        # Check 2026
        periods_2026 = [p for p in unique_periods if p.year == 2026]
        if periods_2026:
            print(f"\n✅ Contains 2026 periods: {[str(p) for p in periods_2026]}")
        else:
            print(f"\n❌ No 2026 periods found")
else:
    print("\n❌ '일별' column not found")

# 3. Check 파트구분 distribution
if '파트구분' in df.columns:
    print("\n" + "=" * 60)
    print("3️⃣ 파트구분 분포")
    print("=" * 60)
    part_counts = df['파트구분'].value_counts()
    print(part_counts)

# 4. Check 품목그룹1 distribution  
if '품목그룹1' in df.columns:
    print("\n" + "=" * 60)
    print("4️⃣ 품목그룹1 분포")
    print("=" * 60)
    group_counts = df['품목그룹1'].value_counts()
    print(group_counts)

print("\n" + "=" * 60)
print("✅ Analysis Complete")
print("=" * 60)
