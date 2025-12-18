import sys
import os
import pandas as pd

def inspect_comparison():
    file_path = "uploads/avk.xlsx"
    if not os.path.exists(file_path):
        print("File not found.")
        return

    print(f"Loading {file_path}...")
    try:
        df = pd.read_excel(file_path)
        # Mimic cleaning
        df.columns = df.columns.str.replace('\t', '').str.strip()
        
        # Clean sales column logic (mimic dashboard.py)
        sales_col = df['판매액']
        if sales_col.dtype == 'object':
             sales_col = sales_col.astype(str).str.replace(',', '').str.strip()
        df['Sales_Clean'] = pd.to_numeric(sales_col, errors='coerce').fillna(0)
        
        # Compare 2412 vs 2501
        for m in ['2412', '2501']:
            print(f"\n--- Month {m} ---")
            m_df = df[df['월구분'].astype(str) == m]
            total_sales = m_df['Sales_Clean'].sum()
            count = len(m_df)
            print(f"Row Count: {count}")
            print(f"Total Sales: {total_sales:,.0f}")
            if count > 0:
                print("Sample Values:")
                print(m_df['Sales_Clean'].head(5).tolist())
                print("Raw '판매액' Sample:")
                print(m_df['판매액'].head(5).tolist())
                print("Part Column Distribution:")
                if '파트구분' in df.columns:
                     print(m_df['파트구분'].value_counts())
                else:
                     print("No '파트구분' column.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_comparison()
