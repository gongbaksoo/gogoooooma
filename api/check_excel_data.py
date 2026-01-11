#!/usr/bin/env python3
"""
Diagnostic script to check if Excel files contain 2026-01 data
"""
import pandas as pd
import os

def check_file_months(filename):
    """Check what months exist in an Excel file"""
    file_path = os.path.join('uploads', filename)
    
    if not os.path.exists(file_path):
        return f"❌ File not found: {filename}"
    
    try:
        # Read Excel file
        df = pd.read_excel(file_path)
        
        # Clean column names
        df.columns = df.columns.str.replace('\t', '').str.strip()
        
        # Check if '월구분' column exists
        if '월구분' not in df.columns:
            return f"❌ {filename}: '월구분' column not found. Available columns: {list(df.columns[:5])}"
        
        # Get unique months
        unique_months = sorted(df['월구분'].dropna().unique())
        
        # Check for 2026 data
        has_2026 = any(str(int(m)).startswith('26') for m in unique_months if pd.notna(m))
        
        result = f"\n{'='*60}\n"
        result += f"📁 File: {filename}\n"
        result += f"{'='*60}\n"
        result += f"Total unique months: {len(unique_months)}\n"
        result += f"Min month: {min(unique_months)}\n"
        result += f"Max month: {max(unique_months)}\n"
        result += f"Contains 2026 data: {'✅ YES' if has_2026 else '❌ NO'}\n"
        
        # Show last 10 months
        result += f"\nLast 10 months:\n"
        for m in unique_months[-10:]:
            result += f"  - {int(m)}\n"
        
        # If has 2026, show all 2026 months
        if has_2026:
            months_2026 = [m for m in unique_months if str(int(m)).startswith('26')]
            result += f"\n2026 months found:\n"
            for m in months_2026:
                result += f"  - {int(m)}\n"
        
        return result
        
    except Exception as e:
        return f"❌ Error reading {filename}: {str(e)}"

if __name__ == "__main__":
    print("🔍 Checking Excel files for 2026-01 data...\n")
    
    files_to_check = [
        'avk_1.xlsx',
        '251219-1.xlsx',
        'avk.xlsx',
        '251219.xlsx'
    ]
    
    for filename in files_to_check:
        print(check_file_months(filename))
    
    print("\n" + "="*60)
    print("✅ Analysis complete")
