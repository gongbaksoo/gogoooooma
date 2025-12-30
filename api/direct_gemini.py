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
    Gemini가 Python 코드를 생성하고, 우리가 실행하여 정확한 결과 반환
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
    
    # 프롬프트 구성 - Python 코드 생성 요청
    prompt = f"""
당신은 pandas DataFrame 데이터 분석 전문가입니다.
주어진 질문에 답하기 위한 Python 코드를 생성하세요.

[현재 시간]
{current_datetime_str}
현재 연도: {current_year}년
현재 월: {current_month}월
**중요: '전월'과 '지난달'은 2511 (2025년 11월)을 의미합니다**

[AI 지침]
{instructions_text}

[데이터 정보]
{data_summary}

[이전 대화]
{history_text}

[사용자 질문]
{query}

**중요 지침:**
1. 이전 대화를 반드시 참고하세요
2. 불완전한 질문(예: "리필은?")은 이전 질문의 맥락을 따릅니다
   - 이전에 "얼룩제거제"를 물었다면 → "얼룩 리필" 계산
   - 이전에 "전월 매출"을 물었다면 → "전월 리필 매출" 계산
3. **상품명 매핑 (중요!):**
   - "얼룩제거제" → 품목 구분 = '얼룩제거제' (전체 얼룩 상품)
   - "얼룩제거제 리필" 또는 "얼룩 리필" → 품목 구분_2 = '얼룩 리필'
   - "얼룩제거제 용기" 또는 "얼룩 용기" → 품목 구분_2 = '얼룩 용기'
4. 품목 구분_2 컬럼에서 정확한 상품명을 찾으세요
   - "리필"만 검색하지 말고 "얼룩 리필" 같은 구체적인 상품명 사용

위 질문에 답하기 위한 Python 코드를 작성하세요.
DataFrame 변수명은 'df'를 사용하세요.

코드 작성 규칙:
1. 결과를 'result' 변수에 저장하세요
2. 최종 답변은 'answer' 변수에 문장으로 저장하세요
3. 금액은 천 단위 구분 기호를 사용하여 포맷하세요
4. 코드만 작성하고, 설명은 포함하지 마세요

예시 1 (전월 매출):
```python
result = df[df['월구분'] == 2511]['판매액'].sum()
answer = f"전월 매출은 {{result:,.0f}}원입니다"
```

예시 2 (얼룩제거제 전체):
```python
result = df[(df['월구분'] == 2511) & (df['품목 구분'] == '얼룩제거제')]['판매액'].sum()
answer = f"지난달 얼룩제거제 매출은 {{result:,.0f}}원입니다"
```

예시 3 (얼룩제거제 리필 - 품목 구분_2 사용):
```python
result = df[(df['월구분'] == 2511) & (df['품목 구분_2'] == '얼룩 리필')]['판매액'].sum()
answer = f"지난달 얼룩 리필 매출은 {{result:,.0f}}원입니다"
```

Python 코드:
"""
    
    # Gemini API 호출
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    response = model.generate_content(prompt)
    
    # 코드 추출
    code = response.text.strip()
    
    # 코드 블록에서 실제 코드만 추출
    if "```python" in code:
        code = code.split("```python")[1].split("```")[0].strip()
    elif "```" in code:
        code = code.split("```")[1].split("```")[0].strip()
    
    # 코드 실행
    try:
        # 안전한 실행 환경 설정
        local_vars = {'df': df, 'pd': pd}
        exec(code, {}, local_vars)
        
        # 결과 추출
        if 'answer' in local_vars:
            return local_vars['answer']
        elif 'result' in local_vars:
            result = local_vars['result']
            return f"{result:,.0f}원" if isinstance(result, (int, float)) else str(result)
        else:
            return "결과를 찾을 수 없습니다."
    except Exception as e:
        # 코드 실행 실패 시 에러 메시지 반환
        return f"계산 중 오류 발생: {str(e)}"

