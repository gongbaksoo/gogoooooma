import sys
import os
import pandas as pd

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from dashboard import get_monthly_sales_by_channel
except ImportError:
    # If running from backend dir
    sys.path.append(os.getcwd())
    from dashboard import get_monthly_sales_by_channel

def test_full_flow():
    filename = "avk.xlsx"
    print(f"Testing get_monthly_sales_by_channel with {filename}...")
    
    try:
        result = get_monthly_sales_by_channel(filename)
        print("SUCCESS!")
        print(f"Days List: {result.get('days_list')}")
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_full_flow()
