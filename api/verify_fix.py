import pandas as pd
from dashboard import calculate_days_list

def test_logic():
    # Create mock data
    # Month '2512'. Days 1-9 have sales. Days 10-31 have 0 sales.
    data = []
    
    # Days 1-9: Sales 100
    for d in range(1, 10):
        data.append({'월구분': '2512', '일구분': d, '판매액': 100})
        
    # Days 10-31: Sales 0
    for d in range(10, 32):
        data.append({'월구분': '2512', '일구분': d, '판매액': 0})
        
    df = pd.DataFrame(data)
    
    print("DataFrame Head:")
    print(df.head())
    print("DataFrame Tail:")
    print(df.tail())
    
    months = ['2512']
    
    print("\nRunning calculate_days_list...")
    days_list, logs = calculate_days_list(df, months)
    
    print(f"\nResult: {days_list}")
    print("\nLogs:")
    for log in logs:
        print(log)
        
    if days_list == [9]:
        print("\nSUCCESS: Calculated 9 days correctly.")
    else:
        print(f"\nFAILURE: Calculated {days_list} days. Expected [9].")

if __name__ == "__main__":
    test_logic()
