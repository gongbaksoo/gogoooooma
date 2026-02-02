import pandas as pd
import os
import sys
# Add api directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dashboard import get_daily_hierarchical_sales, get_dataframe

def verify_daily_api():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    uploads_dir = os.path.join(base_dir, "uploads")
    
    files = [f for f in os.listdir(uploads_dir) if f.endswith('.xlsx') or f.endswith('.csv')]
    if not files: return
    latest_file = max([os.path.join(uploads_dir, f) for f in files], key=os.path.getmtime)
    filename = os.path.basename(latest_file)
    print(f"Testing File: {filename}")
    
    # Check '파트구분' values in file first
    df = get_dataframe(filename)
    if '파트구분' in df.columns:
        print(f"Unique Parts: {df['파트구분'].unique()}")
    else:
        print("Column '파트구분' missing.")
        
    print("\n--- Invoking get_daily_hierarchical_sales(part='오프라인') ---")
    try:
        # Assuming user selects '오프라인'
        result = get_daily_hierarchical_sales(filename, part='오프라인')
        
        dates = result.get('dates', [])
        sales = result.get('sales', [])
        label = result.get('label', '')
        
        print(f"Label: {label}")
        print(f"Dates Count: {len(dates)}")
        print(f"Sales Count: {len(sales)}")
        
        if dates:
            print(f"Dates Head: {dates[:5]}")
            print(f"Sales Head: {sales[:5]}")
            print(f"Dates Tail: {dates[-5:]}")
        else:
            print("Dates is EMPTY!")
            
    except Exception as e:
        print(f"API Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_daily_api()
