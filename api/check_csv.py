#!/usr/bin/env python3
"""
Check CSV file for 2026 data
"""
import pandas as pd
import os

filename = '260106.csv'
file_path = os.path.join('uploads', filename)

if not os.path.exists(file_path):
    print(f"❌ File not found: {filename}")
    exit(1)

print(f"✅ File found: {filename}\n")

# Read CSV
df = pd.read_csv(file_path)
df.columns = df.columns.str.replace('\t', '').str.strip()

print(f"Total rows: {len(df)}")
print(f"Total columns: {len(df.columns)}\n")

# Check 월구분 column
if '월구분' in df.columns:
    unique_months = sorted(df['월구분'].dropna().unique())
    print(f"=== 월구분 컬럼 ===")
    print(f"Unique months: {len(unique_months)}")
    print(f"Min: {int(min(unique_months))}")
    print(f"Max: {int(max(unique_months))}")
    
    has_2026 = any(str(int(m)).startswith('26') for m in unique_months)
    print(f"Contains 2026 data: {'✅ YES' if has_2026 else '❌ NO'}\n")
    
    if has_2026:
        months_2026 = [int(m) for m in unique_months if str(int(m)).startswith('26')]
        print(f"2026 months: {months_2026}\n")
    
    print("Last 10 months:")
    for m in unique_months[-10:]:
        print(f"  - {int(m)}")
else:
    print("❌ '월구분' column not found")
    print(f"Available columns: {list(df.columns[:10])}")
