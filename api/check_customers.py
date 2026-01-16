
import pandas as pd
import os
import glob

def check_customers():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    upload_dir = os.path.join(base_dir, "uploads")
    
    files = glob.glob(os.path.join(upload_dir, "*.xlsx"))
    if not files:
        print("No Excel files found.")
        return

    latest_file = max(files, key=os.path.getmtime)
    print(f"Reading {latest_file}...")
    
    try:
        df = pd.read_excel(latest_file)
        df.columns = df.columns.astype(str).str.replace('\t', '').str.strip()
        
        if '거래쳐명' in df.columns:
            df.rename(columns={'거래쳐명': '거래처명'}, inplace=True)
            
        if '거래처명' in df.columns:
            customers = df['거래처명'].unique()
            print("Unique Customers:")
            for c in sorted(customers.astype(str)):
                print(c)
        else:
            print("Column '거래처명' not found.")
            print("Columns:", df.columns.tolist())
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_customers()
