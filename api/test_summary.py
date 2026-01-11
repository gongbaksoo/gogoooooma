#!/usr/bin/env python3
"""
Test get_monthly_summary to debug NaN issue
"""
import sys
sys.path.insert(0, '.')

from dashboard import get_monthly_summary
import json

# Test with actual file
result = get_monthly_summary('260106_4.csv')

print("=== API Response ===")
print(json.dumps(result, indent=2, ensure_ascii=False))

print("\n=== 당일매출 값만 추출 ===")
for key, data in result.get('data', {}).items():
    latest_day_sales = data.get('latest_day_sales', 'N/A')
    print(f"{key}: {latest_day_sales}")
