
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
import requests
import json
import logging

# ============================================================
# API 인증 정보
# ============================================================
# TODO: Move to .env for production
ACCESS_KEY = "1ca85dcc-8dad-4e8e-a501-919026061c0d"
SECRET_KEY = "b0711655725d6de688006ce4bebffd2fbaf5d3a6"
VENDOR_ID = "A00003300" 

# API 기본 URL
DOMAIN = "https://api-gateway.coupang.com"

def get_authorization(method: str, path: str, query: str = "") -> str:
    """쿠팡 HMAC 서명 생성"""
    datetime_str = datetime.now(timezone.utc).strftime("%y%m%dT%H%M%SZ")
    message = datetime_str + method + path + query
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    return (
        f"CEA algorithm=HmacSHA256, "
        f"access-key={ACCESS_KEY}, "
        f"signed-date={datetime_str}, "
        f"signature={signature}"
    )

def call_api(method: str, path: str, query_params: dict = None, use_market_header: bool = False) -> dict:
    """API 호출"""
    query_string = ""
    if query_params:
        query_string = "&".join([f"{k}={v}" for k, v in query_params.items()])

    authorization = get_authorization(method, path, query_string)
    headers = {
        "Authorization": authorization,
        "X-Requested-By": VENDOR_ID,  # VendorId 사용 (Access Key 아님!)
        "Content-Type": "application/json;charset=UTF-8"
    }

    # 로켓그로스 주문/재고 API는 X-MARKET 헤더 필요
    if use_market_header:
        headers["X-MARKET"] = "KR"  # 한국 마켓

    url = DOMAIN + path
    if query_string:
        url += "?" + query_string

    try:
        response = requests.request(method, url, headers=headers, timeout=30)
        
        try:
            return {"status_code": response.status_code, "data": response.json()}
        except:
            return {"status_code": response.status_code, "raw": response.text[:500]}
    except Exception as e:
        return {"error": str(e)}

def get_coupang_orders(days: int = 7):
    """
    최근 N일간의 로켓그로스 주문 목록 조회
    Endpoint: /v2/providers/rg_open_api/apis/api/v1/vendors/{vendorId}/rg/orders
    """
    today = datetime.now()
    start_date = today - timedelta(days=days)
    
    path = f"/v2/providers/rg_open_api/apis/api/v1/vendors/{VENDOR_ID}/rg/orders"
    params = {
        "paidDateFrom": start_date.strftime("%Y%m%d"),
        "paidDateTo": today.strftime("%Y%m%d")
    }
    
    result = call_api("GET", path, params, use_market_header=True)
    
    if result.get("status_code") == 200:
        data = result.get("data", {})
        orders = data.get("data", [])
        return {"success": True, "orders": orders, "count": len(orders)}
    else:
        return {"success": False, "error": result.get("data", result.get("raw"))}

def get_coupang_inventory():
    """
    로켓창고 재고 요약 조회
    Endpoint: /v2/providers/rg_open_api/apis/api/v1/vendors/{vendorId}/rg/inventory/summaries
    """
    path = f"/v2/providers/rg_open_api/apis/api/v1/vendors/{VENDOR_ID}/rg/inventory/summaries"
    result = call_api("GET", path, use_market_header=True)
    
    if result.get("status_code") == 200:
        data = result.get("data", {})
        inventory = data.get("data", [])
        return {"success": True, "inventory": inventory}
    else:
        return {"success": False, "error": result.get("data", result.get("raw"))}
