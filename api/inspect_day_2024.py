import sys
import os
import pandas as pd

def inspect_2024_days():
    file_path = "uploads/avk.xlsx"
    if not os.path.exists(file_path):
        print("File not found.")
        return

    print(f"Loading {file_path}...")
    try:
        df = pd.read_excel(file_path)
        # Mimic cleaning
        df.columns = df.columns.str.replace('\t', '').str.strip()
        
        # Check 2412
        m = '2412'
        print(f"\n--- Month {m} ---")
        m_df = df[df['월구분'].astype(str) == m]
        
        if '일구분' in m_df.columns:
            days = m_df['일구분'].unique().tolist()
            print(f"Unique Days: {days}")
            print(f"Max Day: {m_df['일구분'].max()}")
        else:
            print("No '일구분'")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_2024_days()
