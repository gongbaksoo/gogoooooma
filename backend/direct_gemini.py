"""
Direct Gemini API query processor - bypasses LangChain to avoid Python 3.13 compatibility issues
"""
import pandas as pd
import google.generativeai as genai
from datetime import datetime
import json
import os

def load_ai_instructions():
    """AI 지침 로드"""
    instructions_file = os.path.join(os.path.dirname(__file__), "ai_instructions.json")
    if os.path.exists(instructions_file):
        try:
            with open(instructions_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("instructions", [])
        except Exception:
            return []
    return []

def process_query_direct(df: pd.DataFrame, query: str, api_key: str, history: list = None) -> str:
    """
    Direct Gemini API를 사용한 쿼리 처리 (LangChain 우회)
    """
    if history is None:
        history = []
    
    # Configure Gemini
    genai.configure(api_key=api_key)
    
    # 현재 시간 정보
    current_time = datetime.now()
    current_datetime_str = current_time.strftime("%Y년 %m월 %d일 %H시 %M분")
    current_year = current_time.year
    current_month = current_time.month
    
    # AI 지침 로드
    instructions = load_ai_instructions()
    instructions_text = "\\n".join([f"{i+1}. {inst}" for i, inst in enumerate(instructions)])
    
    # 데이터 요약
    data_summary = f"""
데이터 정보:
- 총 행 수: {len(df):,}
- 컬럼: {list(df.columns)}
- 월구분 범위: {df['월구분'].min()} ~ {df['월구분'].max()}
- 샘플 데이터 (처음 3행):
{df.head(3).to_string()}
"""
    
    # 대화 기록
    history_text = ""
    if history:
        recent_history = history[-6:]  # 최근 3번의 대화
        for msg in recent_history:
            role = "사용자" if msg.get("role") == "user" else "AI"
            content = msg.get("content", "")
            history_text += f"{role}: {content}\\n"
    
    # 프롬프트 구성
    prompt = f"""
당신은 pandas DataFrame 데이터 분석 전문가입니다.

[현재 시간]
{current_datetime_str}
현재 연도: {current_year}년
현재 월: {current_month}월

[AI 지침 - 반드시 준수]
{instructions_text}

[데이터 정보]
{data_summary}

[이전 대화]
{history_text}

[사용자 질문]
{query}

위 데이터를 분석하여 질문에 답변하세요.
답변은 반드시 숫자나 간단한 문장으로만 제공하세요.
코드나 설명을 포함하지 마세요.

분석 단계:
1. 질문에서 필요한 정보 파악 (기간, 상품, 계산 유형)
2. 이전 대화에서 맥락 파악 (기간이나 유형이 생략되었다면)
3. 필요한 필터링 조건 결정
4. 계산 수행
5. 결과를 간단한 문장으로 답변

답변:
"""
    
    # Gemini API 호출
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    response = model.generate_content(prompt)
    
    return response.text.strip()
