import pandas as pd
import calendar
import numpy as np

def get_days_in_month(year, month):
    return calendar.monthrange(year, month)[1]

def calculate_days_list(df, months):
    # Check column
    if '일구분' not in df.columns:
        print("DEBUG: '일구분' column missing")
        return [30] * len(months)

    # Sort months
    sorted_months = sorted(df['월구분'].unique().astype(str))
    if not sorted_months:
        return []
        
    latest_month = sorted_months[-1]
    print(f"DEBUG: Latest month identified as {latest_month}")
    
    days_list = []
    for m in months:
        m_str = str(m)
        
        # Parse year/month for fallback
        year = 2024
        if len(m_str) == 4:
            year = 2000 + int(m_str[:2])
            month = int(m_str[2:])
        elif len(m_str) == 5 or len(m_str) == 6:
            year = int(m_str[:-2])
            month = int(m_str[-2:])
        else:
            days_list.append(30)
            continue

        if m_str == str(latest_month):
            print(f"DEBUG: Processing latest month {m_str}")
            try:
                # Type handling
                first_val = df['월구분'].iloc[0]
                latest_month_val = int(latest_month) if isinstance(first_val, (int, float, np.number)) else latest_month
                print(f"DEBUG: Filtering with value {latest_month_val} (type: {type(latest_month_val)})")
                
                month_df = df[df['월구분'] == latest_month_val]
                print(f"DEBUG: Month DF size: {len(month_df)}")
                
                if not month_df.empty:
                    max_day = month_df['일구분'].max()
                    print(f"DEBUG: Found max_day {max_day}")
                    days_list.append(int(max_day))
                else:
                    print("DEBUG: Month DF empty, using fallback")
                    days_list.append(get_days_in_month(year, month))
            except Exception as e:
                print(f"DEBUG: Exception {e}")
                days_list.append(get_days_in_month(year, month))
        else:
            days_list.append(get_days_in_month(year, month))
            
    return days_list

try:
    df = pd.read_excel('backend/uploads/avk.xlsx')
    months = sorted(df['월구분'].unique())
    days = calculate_days_list(df, months)
    print("Days List (Last 5):", days[-5:])
except Exception as e:
    print(e)
