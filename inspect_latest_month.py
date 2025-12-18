import pandas as pd
try:
    df = pd.read_excel('backend/uploads/avk.xlsx')
    latest_month = df['월구분'].max()
    print(f"Latest Month: {latest_month}")
    latest_month_df = df[df['월구분'] == latest_month]
    print(f"Max Day in Latest Month: {latest_month_df['일구분'].max()}")
    print(f"Sample Days in Latest Month: {sorted(latest_month_df['일구분'].unique())}")
except Exception as e:
    print(e)
