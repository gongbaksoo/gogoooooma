from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
import logging
from dotenv import load_dotenv

# Load .env file for local development
load_dotenv()
from analysis import analyze_sales_data
from chat import process_chat_query
from dashboard import get_monthly_sales_by_channel
from database import (
    init_db, save_file_to_db, get_file_from_db, 
    list_files_in_db, delete_file_from_db, 
    cleanup_old_files_in_db, get_file_count
)

# Configure logging
logging.basicConfig(level=logging.INFO)

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

# Use absolute path for Railway Volume
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

CHAT_HISTORY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chat_history")
os.makedirs(CHAT_HISTORY_DIR, exist_ok=True)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()
    logging.info("Application started, database initialized")

def ensure_file_on_disk(filename: str):
    """Ensure that the file exists on the local disk (fetching from DB if needed)"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        return True
    
    # Try fetching from DB
    file_data = get_file_from_db(filename)
    if file_data:
        try:
            with open(file_path, "wb") as f:
                f.write(file_data)
            logging.info(f"Synchronized {filename} from database to disk")
            return True
        except Exception as e:
            logging.error(f"Failed to write disk fallback for {filename}: {e}")
    
    return False

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
    
    # Ensure file is available on disk
    if not ensure_file_on_disk(request.filename):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다. 다시 업로드해 주세요.")
        
    file_path = os.path.join(UPLOAD_DIR, request.filename)
    
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

def cleanup_old_files(max_files: int = 5):
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
    """게시된 파일 목록 가져오기 (Database with disk fallback)"""
    # Try database first
    files = list_files_in_db()
    count = get_file_count()
    
    if count == 0:
        # Fallback to disk storage
        files = []
        for filename in os.listdir(UPLOAD_DIR):
            filepath = os.path.join(UPLOAD_DIR, filename)
            if os.path.isfile(filepath) and not filename.startswith('.'):
                stat = os.stat(filepath)
                files.append({
                    "filename": filename,
                    "size": stat.st_size,
                    "modified": stat.st_mtime
                })
        files.sort(key=lambda x: x["modified"], reverse=True)
        count = len(files)
    
    return {"files": files, "count": count, "max": 5}

@app.delete("/files/{filename}")
def delete_file(filename: str):
    """특정 파일 삭제 (Database and Local Disk)"""
    success = delete_file_from_db(filename)
    
    # Also attempt to delete from disk
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            logging.info(f"Deleted local cache for {filename}")
        except Exception as e:
            logging.error(f"Failed to delete local cache for {filename}: {e}")
    
    if not success:
        # If successfully deleted from disk but not from DB, still return success 
        # as it might have been a disk-only file (fallback)
        if not os.path.exists(file_path):
             return {"message": f"{filename} 삭제 완료 (Local only)"}
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    
    return {"message": f"{filename} 삭제 완료"}

@app.post("/upload/")
def upload_file(file: UploadFile = File(...)):
    logging.info(f"Uploading file: {file.filename}")
    
    if not file.filename.endswith(('.xlsx', '.csv')):
        raise HTTPException(status_code=400, detail="오직 .xlsx 또는 .csv 파일만 허용됩니다.")
    
    try:
        # Read file data
        file_data = file.file.read()
        
        # Try to save to database first
        db_success = save_file_to_db(file.filename, file_data)
        
        if db_success:
            logging.info("File saved to database")
            cleanup_old_files_in_db(max_files=5)
        else:
            # Fallback to disk storage if database unavailable
            logging.warning("Database unavailable, falling back to disk storage")
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as f:
                f.write(file_data)
            cleanup_old_files()
        
        # Write to temp file for analysis
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(file_data)
        
        # Quick validation - just check if file can be read
        try:
            import pandas as pd
            df = pd.read_excel(temp_path) if temp_path.endswith('.xlsx') else pd.read_csv(temp_path)
            row_count = len(df)
            col_count = len(df.columns)
        except Exception as e:
            os.remove(temp_path)
            raise HTTPException(status_code=400, detail=f"파일 형식 오류: {str(e)}")
        
        # Clean up temp file
        os.remove(temp_path)
        
        # Return simple success response
        return {
            "filename": file.filename,
            "data": {
                "total_rows": row_count,
                "columns": list(df.columns)[:10],  # First 10 columns only
                "message": "파일 업로드 성공"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Upload failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"파일 처리 실패: {str(e)}")
        
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
    """
    월별 채널별 매출 데이터 반환 (이커머스 vs 오프라인)
    """
    try:
        ensure_file_on_disk(filename)
        from dashboard import get_monthly_sales_by_channel
        result = get_monthly_sales_by_channel(filename)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 처리 실패: {str(e)}")

@app.get("/api/dashboard/product-group-sales")
def get_dashboard_product_group_sales(filename: str):
    """
    월별 품목그룹별 매출 데이터 반환
    """
    try:
        ensure_file_on_disk(filename)
        from dashboard import get_monthly_sales_by_product_group
        result = get_monthly_sales_by_product_group(filename)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 처리 실패: {str(e)}")

@app.get("/api/dashboard/options")
def get_dashboard_options(filename: str):
    """
    품목그룹 > 품목 구분 > 품목 구분_2 계층 구조 옵션 반환
    """
    try:
        ensure_file_on_disk(filename)
        from dashboard import get_hierarchical_options
        result = get_hierarchical_options(filename)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"옵션 데이터 처리 실패: {str(e)}")

@app.get("/api/dashboard/hierarchical-sales")
def get_dashboard_hierarchical_sales(filename: str, group: str = None, category: str = None, sub_category: str = None):
    """
    조건에 따른 월별 매출 데이터 반환
    """
    try:
        ensure_file_on_disk(filename)
        from dashboard import get_filtered_monthly_sales
        result = get_filtered_monthly_sales(filename, group, category, sub_category)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 처리 실패: {str(e)}")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 처리 실패: {str(e)}")

@app.get("/api/dashboard/channel-options")
def get_dashboard_channel_options(filename: str):
    """
    파트구분 > 채널구분 > 거래처명 계층 구조 옵션 반환
    """
    try:
        ensure_file_on_disk(filename)
        from dashboard import get_channel_layer_options
        result = get_channel_layer_options(filename)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"옵션 데이터 처리 실패: {str(e)}")

@app.get("/api/dashboard/channel-sales")
def get_dashboard_channel_sales(filename: str, part: str = None, channel: str = None, account: str = None):
    """
    조건(파트 > 채널 > 거래처)에 따른 월별 매출 데이터 반환
    """
    try:
        ensure_file_on_disk(filename)
        from dashboard import get_channel_layer_sales
        result = get_channel_layer_sales(filename, part, channel, account)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 처리 실패: {str(e)}")

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

# Chat History Models and Endpoints
class ChatHistoryItem(BaseModel):
    id: str
    filename: str
    title: str
    messages: list
    created_at: float
    updated_at: float

@app.post("/chat/save")
def save_chat_history(history: ChatHistoryItem):
    """Save chat conversation"""
    import json
    import time
    
    filepath = os.path.join(CHAT_HISTORY_DIR, f"{history.id}.json")
    
    # Update timestamp
    history.updated_at = time.time()
    
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(history.dict(), f, ensure_ascii=False, indent=2)
        return {"message": "Chat saved", "id": history.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save chat: {str(e)}")

@app.get("/chat/list")
def list_chat_history():
    """Get list of saved chats"""
    import json
    
    chats = []
    try:
        for filename in os.listdir(CHAT_HISTORY_DIR):
            if filename.endswith('.json') and not filename.startswith('.'):
                filepath = os.path.join(CHAT_HISTORY_DIR, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        chats.append({
                            "id": data["id"],
                            "filename": data["filename"],
                            "title": data["title"],
                            "created_at": data["created_at"],
                            "updated_at": data["updated_at"],
                            "message_count": len(data["messages"])
                        })
                except Exception as e:
                    print(f"Error loading chat {filename}: {e}")
                    continue
        
        # Sort by updated time (newest first)
        chats.sort(key=lambda x: x["updated_at"], reverse=True)
        
        # Return 10 most recent
        return {"chats": chats[:10], "count": len(chats)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list chats: {str(e)}")

@app.get("/chat/{chat_id}")
def get_chat_history(chat_id: str):
    """Get specific chat conversation"""
    import json
    
    filepath = os.path.join(CHAT_HISTORY_DIR, f"{chat_id}.json")
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Chat not found")
    
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load chat: {str(e)}")

@app.delete("/chat/{chat_id}")
def delete_chat_history(chat_id: str):
    """Delete chat conversation"""
    filepath = os.path.join(CHAT_HISTORY_DIR, f"{chat_id}.json")
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Chat not found")
    
    try:
        os.remove(filepath)
        return {"message": "Chat deleted", "id": chat_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete chat: {str(e)}")
