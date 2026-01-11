#!/usr/bin/env python3
"""
Check ALL Excel files in uploads directory for 2026 data in 월구분 column
"""
import pandas as pd
import os
import glob

def check_all_files():
    """Check all Excel files for 2026 data"""
    upload_dir = 'uploads'
    files = glob.glob(os.path.join(upload_dir, '*.xlsx'))
    
    files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    
    results = []
    
    for file_path in files:
        filename = os.path.basename(file_path)
        
        try:
            df = pd.read_excel(file_path)
            df.columns = df.columns.str.replace('\t', '').str.strip()
            
            if '월구분' not in df.columns:
                results.append(f"❌ {filename}: '월구분' column not found")
                continue
            
            unique_months = sorted(df['월구분'].dropna().unique())
            has_2026 = any(str(int(m)).startswith('26') for m in unique_months if pd.notna(m))
            
            min_month = min(unique_months) if unique_months else None
            max_month = max(unique_months) if unique_months else None
            
            status = '✅ HAS 2026' if has_2026 else '❌ NO 2026'
            results.append(f"{status} | {filename} | Range: {int(min_month) if min_month else 'N/A'} - {int(max_month) if max_month else 'N/A'}")
            
            if has_2026:
                months_2026 = [m for m in unique_months if str(int(m)).startswith('26')]
                results.append(f"    └─ 2026 months: {[int(m) for m in months_2026]}")
            
        except Exception as e:
            results.append(f"❌ {filename}: Error - {str(e)}")
    
    return results

if __name__ == "__main__":
    print("🔍 Checking ALL Excel files for 2026 data...\n")
    results = check_all_files()
    for r in results:
        print(r)
    print(f"\n{'='*80}")
    print("✅ Analysis complete")
