#!/usr/bin/env python3
"""
Debug why 2026 data is missing
"""
import pandas as pd

filename = '260106_4.csv'
df = pd.read_csv(f'uploads/{filename}', encoding='utf-8-sig')
df.columns = df.columns.str.replace('\t', '').str.strip()

print("=== Debugging 2026 Data Loss ===\n")

# Check 월구분 = 2601 rows
df_2601 = df[df['월구분'] == 2601]
print(f"Total rows with 월구분=2601: {len(df_2601)}")

# Check their 일별 values
print(f"\n일별 column in 2601 rows:")
print(df_2601['일별'].value_counts().head(20))

# Try parsing those dates
numeric_dates = pd.to_numeric(df_2601['일별'], errors='coerce')
date_series = pd.to_datetime(numeric_dates, unit='D', origin='1899-12-30', errors='coerce')

print(f"\nParsed dates for 2601 rows:")
print(f"Valid dates: {date_series.notna().sum()}")
print(f"Invalid dates (NaT): {date_series.isna().sum()}")

# Check 파트구분 for 2601 rows
print(f"\n파트구분 in 2601 rows:")
print(df_2601['파트구분'].value_counts())

# Check if they pass the filter
ecommerce_2601 = df_2601[df_2601['파트구분'] == '이커머스']
print(f"\n이커머스 rows in 2601: {len(ecommerce_2601)}")

if len(ecommerce_2601) > 0:
    print(f"Sales total: {ecommerce_2601['판매액'].sum():,}원")
