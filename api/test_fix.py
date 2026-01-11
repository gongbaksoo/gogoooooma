#!/usr/bin/env python3
"""
Test the modified get_ecommerce_details function
"""
import sys
sys.path.insert(0, '.')

from dashboard import get_ecommerce_details

# Test with 260106_4.csv
result = get_ecommerce_details('260106_4.csv')

print("=== Testing get_ecommerce_details ===\n")

# Check ecommerce monthly data
ecommerce_monthly = result.get('ecommerce', {}).get('monthly', [])
print(f"Ecommerce monthly data points: {len(ecommerce_monthly)}")

if ecommerce_monthly:
    print(f"\nFirst 3 months:")
    for item in ecommerce_monthly[:3]:
        print(f"  {item['Month']}: {item['판매액']:,}원")
    
    print(f"\nLast 3 months:")
    for item in ecommerce_monthly[-3:]:
        print(f"  {item['Month']}: {item['판매액']:,}원")
    
    # Check for 2026 data
    months_2026 = [m for m in ecommerce_monthly if m['Month'].startswith('2026')]
    if months_2026:
        print(f"\n✅ Found 2026 data: {len(months_2026)} month(s)")
        for m in months_2026:
            print(f"  {m['Month']}: {m['판매액']:,}원")
    else:
        print(f"\n❌ No 2026 data found")
else:
    print("❌ No monthly data")

print("\n" + "="*60)
