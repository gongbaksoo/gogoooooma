import pandas as pd
from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent
from langchain_google_genai import ChatGoogleGenerativeAI
import google.generativeai as genai
import os
import json
from datetime import datetime
import traceback
import re
from database import get_file_from_db

def load_ai_instructions():
    """AI 지침 로드"""
    instructions_file = "ai_instructions.json"
    if os.path.exists(instructions_file):
        try:
            with open(instructions_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("instructions", [])
        except Exception:
            return []
    return []

def preprocess_product_query(df, query: str):
    """
    상품 관련 질문을 전처리하여 데이터를 미리 필터링
    Returns: (filtered_df, modified_query, product_found)
    """
    import pandas as pd
    
    # 상품명 키워드 추출
    product_keywords = []
    query_no_space = query.replace(' ', '').lower()
    
    # 먼저 품목 구분_2에서 정확히 일치하는 것 찾기 (더 구체적인 분류)
    if '품목 구분_2' in df.columns:
        unique_products_2 = df['품목 구분_2'].dropna().unique()
        
        # 정확히 일치하는 것 먼저 찾기
        for product in unique_products_2:
            if product == '대상 X':
                continue
            product_no_space = str(product).replace(' ', '').lower()
            # 정확히 일치하는 경우
            if product_no_space == query_no_space or str(product).lower() == query.lower():
                filtered_df = df[df['품목 구분_2'] == product].copy()
                modified_query = f"이미 '{product}' 상품으로 필터링된 데이터입니다. {query}"
                return filtered_df, modified_query, True
        
        # 정확히 일치하지 않으면 포함 검색
        for product in unique_products_2:
            if product == '대상 X':
                continue
            product_no_space = str(product).replace(' ', '').lower()
            # 쿼리가 상품명에 포함되거나, 상품명이 쿼리에 포함되는 경우
            if product_no_space in query_no_space or query_no_space in product_no_space:
                # 하지만 길이 차이가 너무 크면 제외 (오매칭 방지)
                if abs(len(product_no_space) - len(query_no_space)) <= 3:
                    filtered_df = df[df['품목 구분_2'] == product].copy()
                    modified_query = f"이미 '{product}' 상품으로 필터링된 데이터입니다. {query}"
                    return filtered_df, modified_query, True
    
    # 품목 구분에서 검색
    if '품목 구분' in df.columns:
        unique_products = df['품목 구분'].dropna().unique()
        
        # 정확히 일치하는 것 먼저
        for product in unique_products:
            if product == '대상 X':
                continue
            product_no_space = str(product).replace(' ', '').lower()
            if product_no_space == query_no_space or str(product).lower() == query.lower():
                filtered_df = df[df['품목 구분'] == product].copy()
                modified_query = f"이미 '{product}' 상품으로 필터링된 데이터입니다. {query}"
                return filtered_df, modified_query, True
        
        # 포함 검색
        for product in unique_products:
            if product == '대상 X':
                continue
            product_no_space = str(product).replace(' ', '').lower()
            if product_no_space in query_no_space:
                filtered_df = df[df['품목 구분'] == product].copy()
                modified_query = f"이미 '{product}' 상품으로 필터링된 데이터입니다. {query}"
                return filtered_df, modified_query, True
    
    # 상품을 찾지 못한 경우 원본 반환
    return df, query, False

def process_chat_query(file_path: str, query: str, api_key: str, history: list = None):
    """
    LangChain Pandas DataFrame Agent를 사용하여 자연어 쿼리 처리
    history: 이전 대화 내용 (선택적)
    """
    if history is None:
        history = []
    
    # 현재 시간 정보
    current_time = datetime.now()
    current_datetime_str = current_time.strftime("%Y년 %m월 %d일 %H시 %M분")
    current_year = current_time.year
    current_month = current_time.month
    current_day = current_time.day
    
    # AI 지침 로드
    instructions = load_ai_instructions()
    
    # 컨텍스트 구성
    context_parts = []
    
    # 1. 현재 시간 정보
    context_parts.append(f"[현재 시간 정보]\n현재 날짜 및 시간: {current_datetime_str}\n현재 연도: {current_year}년\n현재 월: {current_month}월\n현재 일: {current_day}일")
    
    # 2. AI 지침
    if instructions:
        instructions_text = "\n".join([f"{i+1}. {inst}" for i, inst in enumerate(instructions)])
        context_parts.append(f"[AI 지침 - 반드시 준수]\n{instructions_text}")
    
    # 3. 대화 기록 (최근 3개 질문-답변)
    if history:
        recent_history = history[-6:]  # 최근 6개 메시지 (3번의 질문-답변)
        history_text = ""
        for msg in recent_history:
            role = "사용자" if msg.get("role") == "user" else "AI"
            content = msg.get("content", "")
            history_text += f"{role}: {content}\n"
        if history_text:
            context_parts.append(f"[이전 대화 내용]\n{history_text}")
    
    # 전체 컨텍스트 조합
    full_context = "\n\n".join(context_parts)
    
    # 최종 쿼리 구성
    full_query = f"{full_context}\n\n[현재 질문]\n{query}"
    
    # 디버그 로그
    with open("chat_debug.log", "a", encoding="utf-8") as f:
        f.write(f"\n{'='*50}\n")
        f.write(f"[{current_datetime_str}] 새로운 쿼리\n")
        f.write(f"원본 질문: {query}\n")
        f.write(f"전체 프롬프트:\n{full_query}\n")
        f.write(f"{'='*50}\n")
    
    try:
        # API 키 설정
        genai.configure(api_key=api_key)
        
        # Load data from database first
        file_data = get_file_from_db(file_path)
        
        if file_data is None:
            # Fallback to disk storage
            import os
            upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
            disk_path = os.path.join(upload_dir, file_path)
            
            if os.path.exists(disk_path):
                with open(disk_path, "rb") as f:
                    file_data = f.read()
            else:
                raise Exception(f"파일을 찾을 수 없습니다: {file_path}")
        
        # Extract just the filename (remove any path components)
        filename_only = os.path.basename(file_path)
        
        # Write to temp file
        temp_path = f"/tmp/{filename_only}"
        with open(temp_path, "wb") as f:
            f.write(file_data)
        
        # Load data from temp file
        df = pd.read_excel(temp_path) if temp_path.endswith('.xlsx') else pd.read_csv(temp_path)
        
        # 상품 검색 전처리
        original_df = df.copy()
        df, modified_query, product_found = preprocess_product_query(df, query)
        
        if product_found:
            # 상품이 발견되면 수정된 쿼리 사용
            full_query = f"{full_context}\\n\\n[현재 질문]\\n{modified_query}"
            with open("chat_debug.log", "a", encoding="utf-8") as f:
                f.write(f"상품 전처리 성공: 필터링된 데이터 행 수 = {len(df)}\\n")
                f.write(f"수정된 질문: {modified_query}\\n")
        
        # Clean column names (remove tabs, extra spaces)
        df.columns = df.columns.str.replace('\t', '').str.strip()
        
        with open("chat_debug.log", "a", encoding="utf-8") as f:
            f.write(f"Cleaned columns: {list(df.columns)}\n")
        
        # Select model with error handling
        selected_model = "gemini-1.5-flash"  # Default fallback
        
        try:
            # Discover available models dynamically
            available_models = genai.list_models()
            
            # Filter for models that support generateContent
            chat_models = [
                m for m in available_models 
                if hasattr(m, 'supported_generation_methods') and 'generateContent' in m.supported_generation_methods
            ]
            
            # Prioritize models by preference
            preferred_order = ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash-latest', 'gemini-1.5-flash']
            
            for pref in preferred_order:
                for model in chat_models:
                    if hasattr(model, 'name') and pref in model.name:
                        selected_model = model.name.replace("models/", "")
                        break
                if selected_model != "gemini-1.5-flash":  # Found a preferred model
                    break
            
            # Fallback to first available chat model
            if selected_model == "gemini-1.5-flash" and chat_models:
                if hasattr(chat_models[0], 'name'):
                    selected_model = chat_models[0].name.replace("models/", "")
        
        except Exception as e:
            with open("chat_debug.log", "a", encoding="utf-8") as f:
                f.write(f"Model selection error: {str(e)}, using fallback\n")
        
        with open("chat_debug.log", "a", encoding="utf-8") as f:
            f.write(f"Selected model: {selected_model}\n")
        
        # Create LLM
        llm = ChatGoogleGenerativeAI(
            model=selected_model,
            google_api_key=api_key,
            temperature=0,
            convert_system_message_to_human=True
        )
        
        # Create agent with detailed prefix
        prefix = """
You are working with a pandas dataframe in Python. The name of the dataframe is `df`.
You MUST execute Python code to answer questions. Do not just describe what you would do.

IMPORTANT OUTPUT RULES:
1. Your FINAL answer must be a simple number or short sentence ONLY
2. Do NOT include any code, explanations, or "Thought:" in your final answer
3. For sales/revenue questions, format numbers with thousand separators (e.g., 1,234,567)
4. If the result is 0 or NaN, just return "0"

Example good final answers:
- "1,234,567"
- "2025년 12월"
- "마이비는 브랜드명입니다"

Example BAD final answers (DO NOT DO THIS):
- "Thought: I need to filter..."
- "Action: python_repl_ast..."
- "The code would be..."
"""
        
        # Try different agent types for better stability
        agent_types_to_try = [
            "openai-functions",
            "openai-tools", 
            "zero-shot-react-description"
        ]
        
        agent = None
        last_error = None
        
        for agent_type in agent_types_to_try:
            try:
                with open("chat_debug.log", "a", encoding="utf-8") as f:
                    f.write(f"Trying agent type: {agent_type}\n")
                
                agent = create_pandas_dataframe_agent(
                    llm,
                    df,
                    prefix=prefix,
                    verbose=True,
                    agent_type=agent_type,
                    allow_dangerous_code=True,
                    handle_parsing_errors=True,
                    max_iterations=15,
                    max_execution_time=90,
                    return_intermediate_steps=False
                )
                break  # Success, use this agent
            except Exception as e:
                last_error = e
                with open("chat_debug.log", "a", encoding="utf-8") as f:
                    f.write(f"Agent type {agent_type} failed: {str(e)}\n")
                continue
        
        if agent is None:
            raise Exception(f"Failed to create agent with any type: {last_error}")
        
        # Run query with full context
        try:
            result = agent.invoke(full_query)
        except Exception as agent_error:
            # If agent fails with parsing error, try to extract useful info
            error_str = str(agent_error)
            
            with open("chat_debug.log", "a", encoding="utf-8") as f:
                f.write(f"Agent error: {error_str}\n")
            
            # Check if it's a parsing error with actual output
            if "Could not parse LLM output" in error_str:
                # Try to extract the actual output from error message
                # Look for patterns like: mybi_sales = ... print(...)
                if "print(format(int(" in error_str:
                    # Extract the calculation result if visible
                    match = re.search(r'print\(format\(int\([^)]+\),\s*","\)\)', error_str)
                    if match:
                        # Fallback: return a helpful message
                        return "데이터 처리 중 오류가 발생했습니다. 다시 시도해주세요."
            
            # Re-raise if we can't handle it
            raise ValueError(f"AI 에이전트 실행 오류: {str(agent_error)}")
        
        with open("chat_debug.log", "a", encoding="utf-8") as f:
            f.write(f"Agent result: {result}\n")
        
        # Extract output
        if isinstance(result, dict):
            output = result.get("output", str(result))
        else:
            output = str(result)
        
        # Post-process output to apply question recap if needed
        # Remove any "Thought:", "Action:", etc. from output
        output = re.sub(r'(Thought:|Action:|Observation:).*', '', output, flags=re.DOTALL).strip()
        
        # If output is just a number, try to add context from the question
        if output and output.replace(',', '').replace('.', '').isdigit():
            # Extract key terms from query for context
            # Simple heuristic: if query mentions a product/brand, include it
            if '마이비' in query:
                output = f"마이비 매출: {output}원"
            elif '얼룩' in query or '제거제' in query:
                output = f"얼룩 제거제 매출: {output}원"
        
        return output
        
    except Exception as e:
        error_msg = f"AI 분석 중 오류 발생: {str(e)}"
        with open("chat_debug.log", "a", encoding="utf-8") as f:
            f.write(f"ERROR: {error_msg}\n")
            f.write(f"Traceback: {traceback.format_exc()}\n")
        raise ValueError(error_msg)
