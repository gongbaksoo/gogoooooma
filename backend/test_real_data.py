import sys
import os
import pandas as pd

# Add current directory to path so we can import dashboard
sys.path.append(os.getcwd())

try:
    from dashboard import calculate_days_list
except ImportError:
    # If running from backend dir, dashboard is in current dir
    sys.path.append(os.getcwd())
    from dashboard import calculate_days_list

def test_real_file():
    file_path = "uploads/avk.xlsx"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        # Try finding any xlsx
        files = [f for f in os.listdir("uploads") if f.endswith(".xlsx")]
        if files:
            file_path = os.path.join("uploads", files[0])
            print(f"Using alternative file: {file_path}")
        else:
            print("No Excel files found in uploads/")
            return

    print(f"Testing with {file_path}")
    try:
        df = pd.read_excel(file_path)
        # Mimic dashboard.py column cleaning
        df.columns = df.columns.str.replace('\t', '').str.strip()
        print(f"Cleaned columns: {df.columns.tolist()}")

        # Check sales for Dec 2025 (2512)
        print("\n--- Sales Sample for 2512 ---")
        sales_2512 = df[df['월구분'].astype(str) == '2512']['판매액']
        print(f"Count: {len(sales_2512)}")
        print(f"Head: {sales_2512.head().tolist()}")
        print(f"Type: {sales_2512.dtype}")
        
    except Exception as e:
        print(f"Error reading Excel: {e}")
        return
    
    # Mock months list (e.g. December 2025)
    # The file has "월구분" probably?
    if '월구분' in df.columns:
        months = sorted(df['월구분'].astype(str).unique().tolist())
        print(f"Months found: {months}")
    else:
        print("'월구분' column not found. Cannot determine months.")
        return
    
    try:
        days_list, logs = calculate_days_list(df, months)
        
        print("\n--- RESULTS ---")
        print(f"Days List: {days_list}")
        print("\n--- DEBUG LOGS ---")
        for log in logs:
            print(log)
    except Exception as e:
        print(f"CRASH in calculate_days_list: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_real_file()
