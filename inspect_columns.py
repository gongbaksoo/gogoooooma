import pandas as pd
try:
    df = pd.read_excel('backend/uploads/avk.xlsx', nrows=5)
    print("Columns:", df.columns.tolist())
except Exception as e:
    print(e)
