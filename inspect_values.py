import pandas as pd
try:
    df = pd.read_excel('backend/uploads/avk.xlsx')
    print("일구분 Type:", df['일구분'].dtype)
    print("일구분 Unique (sample):", df['일구분'].unique()[:20])
    print("월구분 Type:", df['월구분'].dtype)
    print("월구분 Unique (sample):", df['월구분'].unique()[:20])
except Exception as e:
    print(e)
