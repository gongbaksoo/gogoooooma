import pandas as pd
import os

def inspect_sales():
    file_path = "uploads/avk.xlsx"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"Loading {file_path}...")
    df = pd.read_excel(file_path)
    
    # Check '판매액' column
    if '판매액' in df.columns:
        print("\n'판매액' Column Types:")
        print(df['판매액'].apply(type).value_counts())
        
        print("\n'판매액' Sample Values:")
        print(df['판매액'].head(10))
        
        # Check for strings with commas
        if df['판매액'].dtype == 'object':
            print("\nChecking for commas in '판매액':")
            comma_samples = df[df['판매액'].astype(str).str.contains(',', na=False)]['판매액'].head()
            print(comma_samples)
    else:
        print("'판매액' column not found.")
        
if __name__ == "__main__":
    inspect_sales()
