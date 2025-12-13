from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
from analysis import analyze_sales_data
from chat import process_chat_query
from dashboard import get_monthly_sales_by_channel

app = FastAPI(title="Sales Analysis API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://sales-analysis-site.vercel.app",
        "https://api.gongbaksoo.com",
        "*"  # Allow all for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "매출 분석 API가 실행 중입니다."}

from analysis import analyze_sales_data
from chat import process_chat_query
from pydantic import BaseModel

class ChatRequest(BaseModel):
    filename: str
    query: str
    api_key: str
    history: list = []  # Optional conversation history

# Config file for storing secrets
CONFIG_FILE = "security_config.json"
ALIASES_FILE = "schema_aliases.json"
AI_INSTRUCTIONS_FILE = "ai_instructions.json"

class AliasRequest(BaseModel):
    column: str
    aliases: list[str]

class InstructionsRequest(BaseModel):
    instructions: list[str]

class SchemaAlias(BaseModel):
    column: str
    aliases: list[str]

def load_schema_aliases():
    if os.path.exists(ALIASES_FILE):
        try:
            import json
            with open(ALIASES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_schema_aliases(aliases_data: dict):
    import json
    try:
        with open(ALIASES_FILE, "w", encoding="utf-8") as f:
            json.dump(aliases_data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving schema aliases: {e}")
        raise HTTPException(status_code=500, detail=f"스키마 별칭 저장 실패: {str(e)}")

def load_ai_instructions():
    """AI 지침 로드"""
    if os.path.exists(AI_INSTRUCTIONS_FILE):
        try:
            import json
            with open(AI_INSTRUCTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("instructions", [])
        except Exception:
            return []
    return []

def save_ai_instructions(instructions: list):
    """AI 지침 저장"""
    import json
    try:
        with open(AI_INSTRUCTIONS_FILE, "w", encoding="utf-8") as f:
            json.dump({"instructions": instructions}, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving AI instructions: {e}")
        raise HTTPException(status_code=500, detail=f"AI 지침 저장 실패: {str(e)}")

def load_server_api_key():
    # First, try to load from environment variable (for Railway deployment)
    env_key = os.getenv("GOOGLE_API_KEY")
    if env_key:
        return env_key
    
    # Fall back to config file (for local development)
    if os.path.exists(CONFIG_FILE):
        try:
            import json
            with open(CONFIG_FILE, "r") as f:
                return json.load(f).get("api_key")
        except Exception:
            return None
    return None

class AdminKeyRequest(BaseModel):
    api_key: str

@app.post("/admin/api-key")
def set_admin_api_key(request: AdminKeyRequest):
    import json
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump({"api_key": request.api_key}, f)
        return {"message": "API Key saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/api-key-status")
def get_admin_api_key_status():
    key = load_server_api_key()
    return {"is_set": bool(key)}

@app.post("/chat/")
def chat_endpoint(request: ChatRequest):
    print(f"Chat request for {request.filename}: {request.query}")
    file_path = os.path.join(UPLOAD_DIR, request.filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다. 다시 업로드해 주세요.")
    
    # Resolve API Key
    final_api_key = request.api_key
    # If client sends empty or placeholder, try to load from server
    if not final_api_key or final_api_key == "server_managed":
        server_key = load_server_api_key()
        if server_key:
            final_api_key = server_key
        else:
            raise HTTPException(status_code=400, detail="API Key가 설정되지 않았습니다. 관리자에게 문의하세요.")

    try:
        response = process_chat_query(file_path, request.query, final_api_key, request.history)
        return {"response": response}
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        with open("error.log", "w") as f:
            f.write(error_msg)
        print(error_msg)
        raise HTTPException(status_code=500, detail=f"AI 응답 생성 실패: {str(e)}")

def cleanup_old_files(max_files: int = 50):
    """Remove oldest files if count exceeds max_files"""
    files = []
    for filename in os.listdir(UPLOAD_DIR):
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.isfile(filepath):
            files.append((filepath, os.path.getmtime(filepath)))
    
    # Sort by modification time (oldest first)
    files.sort(key=lambda x: x[1])
    
    # Remove oldest files if exceeding limit
    while len(files) > max_files:
        oldest_file = files.pop(0)[0]
        try:
            os.remove(oldest_file)
            print(f"Removed old file: {oldest_file}")
        except Exception as e:
            print(f"Failed to remove {oldest_file}: {e}")

@app.get("/files/")
def list_files():
    """Get list of uploaded files"""
    files = []
    for filename in os.listdir(UPLOAD_DIR):
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.isfile(filepath):
            stat = os.stat(filepath)
            files.append({
                "filename": filename,
                "size": stat.st_size,
                "modified": stat.st_mtime
            })
    
    # Sort by modification time (newest first)
    files.sort(key=lambda x: x["modified"], reverse=True)
    return {"files": files, "count": len(files), "max": 50}

@app.delete("/files/{filename}")
def delete_file(filename: str):
    """Delete a specific file"""
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    
    try:
        os.remove(filepath)
        return {"message": f"{filename} 삭제 완료"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")

@app.post("/upload/")
def upload_file(file: UploadFile = File(...)):
    print(f"Entering upload_file with {file.filename}")
    if not file.filename.endswith(('.xlsx', '.csv')):
        raise HTTPException(status_code=400, detail="오직 .xlsx 또는 .csv 파일만 허용됩니다.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Check file count and cleanup if needed
        cleanup_old_files()

        # 데이터 분석 실행
        result = analyze_sales_data(file_path)
            
    except Exception as e:
        import traceback
        with open("error.log", "w") as f:
            f.write(traceback.format_exc())
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"파일 처리 중 오류 발생: {str(e)}")
        
    from fastapi.encoders import jsonable_encoder
    import json
    try:
        encoded_result = jsonable_encoder(result)
        # Debug: Check if it serializes to string okay
        json_str = json.dumps(encoded_result, default=str)
        print(f"Serialized JSON size: {len(json_str)} chars")
        return {"filename": file.filename, "data": result}
    except Exception as e:
        import traceback
        with open("error.log", "a") as f:
            f.write(f"\n=== Upload Error ===\n{traceback.format_exc()}\n")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Schema Alias Management Endpoints
# ============================================

@app.get("/custom/aliases/")
def get_schema_aliases():
    """전체 스키마 별칭 목록 조회"""
    try:
        aliases = load_schema_aliases()
        return aliases
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"별칭 조회 실패: {str(e)}")

@app.post("/custom/aliases/")
def save_alias(request: AliasRequest):
    """특정 컬럼의 별칭 저장"""
    try:
        aliases = load_schema_aliases()
        aliases[request.column] = request.aliases
        save_schema_aliases(aliases)
        return {"message": "별칭이 저장되었습니다", "column": request.column, "aliases": request.aliases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"별칭 저장 실패: {str(e)}")

@app.delete("/custom/aliases/{column}/{alias}")
def delete_alias(column: str, alias: str):
    """특정 컬럼의 특정 별칭 삭제"""
    try:
        aliases = load_schema_aliases()
        if column in aliases and alias in aliases[column]:
            aliases[column].remove(alias)
            if not aliases[column]:  # 별칭이 비어있으면 컬럼 자체 삭제
                del aliases[column]
            save_schema_aliases(aliases)
            return {"message": "별칭이 삭제되었습니다", "column": column, "alias": alias}
        else:
            raise HTTPException(status_code=404, detail="별칭을 찾을 수 없습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"별칭 삭제 실패: {str(e)}")

# ============================================
# AI Instructions Management Endpoints
# ============================================

@app.get("/custom/instructions/")
def get_ai_instructions():
    """AI 지침 목록 조회"""
    try:
        instructions = load_ai_instructions()
        return {"instructions": instructions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지침 조회 실패: {str(e)}")

@app.post("/custom/instructions/")
def save_instructions(request: InstructionsRequest):
    """AI 지침 저장"""
    try:
        save_ai_instructions(request.instructions)
        return {"message": "지침이 저장되었습니다", "instructions": request.instructions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지침 저장 실패: {str(e)}")

# ============================================
# Dashboard Endpoints
# ============================================

@app.get("/api/dashboard/monthly-sales")
def get_dashboard_monthly_sales(filename: str):
    """월별 이커머스 vs 오프라인 매출 데이터"""
    try:
        data = get_monthly_sales_by_channel(filename)
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 조회 실패: {str(e)}")

@app.delete("/custom/aliases/{column}")
def delete_column_aliases(column: str):
    """특정 컬럼의 모든 별칭 삭제"""
    try:
        aliases = load_schema_aliases()
        if column in aliases:
            del aliases[column]
            save_schema_aliases(aliases)
            return {"message": f"{column}의 모든 별칭이 삭제되었습니다"}
        else:
            raise HTTPException(status_code=404, detail="컬럼을 찾을 수 없습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"별칭 삭제 실패: {str(e)}")

@app.get("/logs/")
def get_logs():
    """
    Returns the last 200 lines of error.log and chat_debug.log
    """
    logs = {}
    
    for log_file in ["error.log", "chat_debug.log"]:
        if os.path.exists(log_file):
            try:
                with open(log_file, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                    # Get last 200 lines
                    logs[log_file] = "".join(lines[-200:])
            except Exception as e:
                logs[log_file] = f"Error reading log: {str(e)}"
        else:
            logs[log_file] = "No log file found."
            
    return logs
