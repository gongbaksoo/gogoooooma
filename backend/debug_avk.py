import pandas as pd
import traceback

file_path = "/Users/j_mac_mini/Desktop/avk.xlsx"

import time
start_time = time.time()
try:
    print(f"Attempting to read {file_path}...")
    df = pd.read_excel(file_path, engine='openpyxl')
    print(f"Read success! Took {time.time() - start_time:.2f} seconds")
    print(df.head())
    print("\nCheck for NaN in describe:")
    desc = df.describe()
    print(desc)
    
    import json
    # Custom encoder to mimic what check might fail
    try:
        preview = df.head().to_dict(orient="records")
        print(f"Preview sample: {preview[0]}")
        json.dumps(preview)
        print("Preview JSON serialization success")
    except Exception as e:
        print(f"Preview JSON serialization failed: {e}")

    try:
        json.dumps(desc.to_dict())
        print("Statistics JSON serialization success")
    except Exception as e:
        print(f"Statistics JSON serialization failed: {e}")
        
    # Check for NaN specifically
    import numpy as np
    pathological = desc.map(lambda x: isinstance(x, float) and np.isnan(x))
    if pathological.values.any():
        print("WARNING: Contains NaN values which might break standard JSON!")
except Exception:
    traceback.print_exc()
