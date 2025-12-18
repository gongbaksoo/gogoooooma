import sys
import os
import pandas as pd

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from dashboard import get_monthly_sales_by_product_group
except ImportError:
    # If running from backend dir
    sys.path.append(os.getcwd())
    from dashboard import get_monthly_sales_by_product_group

def test_product_group():
    filename = "avk.xlsx"
    print(f"Testing get_monthly_sales_by_product_group with {filename}...")
    
    try:
        result = get_monthly_sales_by_product_group(filename)
        print("SUCCESS!")
        print(f"Groups found: {list(result['groups'].keys())}")
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_product_group()
