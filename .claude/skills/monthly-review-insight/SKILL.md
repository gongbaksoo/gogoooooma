---
name: monthly-review-insight
description: AVK_Sales 월 매출 리뷰를 "데이터 자동 취합 + 사용자 문답"으로 작성한다. 웹 6섹션의 '시사점'을 넘어 왜·그래서 무엇을의 인사이트가 담긴 회의용 리뷰 문서(HTML+Markdown)를 reviews/에 생성한다. 사용자가 "월리뷰", "리뷰 자료 만들자", "이번 달 리뷰", "monthly review insight" 등을 요청하면 사용.
---

# 월 리뷰 인사이트 작성 스킬

웹 AI 분석은 **grounded(수치 정확) + 시사점**까지만 나온다. 진짜 인사이트(왜 그랬나·일회성인가 구조적인가·그래서 무엇을)는 **데이터에 없는 사람의 맥락**에서 나온다. 이 스킬은 그 맥락을 **구조화된 문답**으로 끌어내 회의용 리뷰 문서를 만든다.

핵심 원칙
- **추측 금지**: 수치는 데이터에 있는 값만. 사용자가 답한 맥락은 "현장 맥락"으로 명확히 구분 표기. 모르는 건 모른다고.
- **단위**: 백만원(데이터 원값 ÷ 1,000,000, 반올림). 임의 환산·창작 금지.
- **커밋/배포 자동 금지**: 문서 파일만 생성한다. 커밋은 사용자가 요청할 때만.
- 출력 언어: 한국어.

---

## 0. 준비 — 회사 컨텍스트 로드 + 대상 확정

**가장 먼저** 같은 디렉토리(`.claude/skills/monthly-review-insight/`)의 `company-context.md`를 읽는다. 거기 담긴 주력 채널·주력 상품·브랜드 구성·채널 분류·시즌성·주요 거래처·목표 기준을 **이번 분석의 전제**로 삼는다. 효과:
- 이미 아는 사실은 다시 묻지 않는다(예: "오픈마켓(사입)이 주력?"을 재질문 금지).
- 데이터가 **알려진 패턴에서 벗어날 때**(시즌 성수기인데 급감, 주력 상품이 비주력에 추월, 주력 채널 점유율 급락 등)를 인사이트 갭으로 우선 포착.
- `company-context.md`의 `[확인 요망]`은 아직 사실이 아니다 — 단정 금지. 다만 이번 달에 그 항목과 관련된 큰 신호가 있으면 질문에 1~2개 녹여 **컨텍스트도 함께 보강**(사용자 답을 받으면 그 파일에 반영 제안).

그다음 **대상 확정**:
- 사용자가 `월/파트`를 줬으면(예: "2026-05 전체") 그대로 사용. 파트는 `all`(전체) | `ecommerce`(이커머스) | `offline`(오프라인).
- 안 줬으면 **자동 감지 후 확인**: 최신 매출 파일 → 가용 월 → 가장 최근 "완료된" 월을 후보로 제시하고 사용자에게 월·파트를 1번만 확인받는다. (당월은 미완료일 수 있으니 직전 완료월을 기본 제안.)

## 1. 데이터 자동 취합 (prod API)

베이스 `API=https://api.gongbaksoo.com`, 모든 요청에 헤더 `-H "User-Agent: curl/8.7.1"`(Cloudflare 차단 회피) 필수.

```bash
UA="User-Agent: curl/8.7.1"; API="https://api.gongbaksoo.com"
# (a) 최신 매출 파일
curl -s -H "$UA" "$API/api/files/?t=1" | python3 -c "import sys,json;print([f['filename'] for f in json.load(sys.stdin)['files']][:5])"
# (b) 가용 월
curl -s -H "$UA" "$API/api/monthly-review/months/?filename=<FILE>" | python3 -c "import sys,json;print(json.load(sys.stdin)['months'][:6])"
# (c) 목표 파일
curl -s -H "$UA" "$API/api/monthly-review/targets/" | python3 -c "import sys,json;print([f['filename'] for f in json.load(sys.stdin)['files']])"
# (d) 종합 데이터(raw) — 저장
curl -s -H "$UA" "$API/api/monthly-review/summary/?filename=<FILE>&month=<YYYY-MM>&part=<PART>&target_file=<TARGET>" -o /tmp/mr_summary.json
```

raw `summary`에서 내가 직접 읽을 핵심 필드(원 단위 → 백만원은 ÷1e6):
- `chart1` = `{target, actual, achievement_rate}` — 목표비/달성률.
- `chart2` = `[{month, current_year, prev_year}, …]`(12개월) — 최근 3개월 흐름(MoM 연쇄)·전년동월비.
- `brand_focus` = `[{name, current_month, prev_month, prev_year, monthly_avg, target, channels:[{name,value}]}]`(마/누/쏭, part=all 전용).
- `brand_products` = `{브랜드:[{name, row_count, values[13]}]}` — `values[-1]`=대상월, `values[-2]`=직전월. 매출순 top·전월비 movers 산출.

디지스트 추출(읽기용):
```bash
python3 - <<'PY'
import json
s=json.load(open('/tmp/mr_summary.json')); M=1_000_000; man=lambda v: round((v or 0)/M)
c1=s.get('chart1',{}); print('TOPLINE 실적%d 목표%s 달성률%s'%(man(c1.get('actual')),man(c1.get('target')) if c1.get('target') else '미설정',c1.get('achievement_rate')))
for r in s.get('chart2',[])[-3:]: print('월',r['month'],'당해',man(r['current_year']),'전년',man(r['prev_year']))
for b in s.get('brand_focus',[]):
    ch=', '.join('%s %d'%(c['name'],man(c['value'])) for c in b.get('channels',[])[:6])
    print('BRAND',b['name'],'대상',man(b['current_month']),'직전',man(b['prev_month']),'전년',man(b['prev_year']),'월평균',man(b['monthly_avg']),'목표',man(b['target']) if b.get('target') else '-','| 채널:',ch)
for bn in ['마이비','누비','쏭레브']:
    items=[(it['name'],man(it['values'][-1]),man(it['values'][-2])) for it in (s.get('brand_products') or {}).get(bn,[]) if (it['values'][-1] or 0)>0]
    top=sorted(items,key=lambda x:-x[1])[:5]; mv=sorted(items,key=lambda x:-(x[1]-x[2]))[:3]; dn=sorted(items,key=lambda x:(x[1]-x[2]))[:3]
    print('PROD',bn,'매출top5',top,'| 상승',[(n,c-p) for n,c,p in mv],'| 하락',[(n,c-p) for n,c,p in dn])
PY
```

채널 레벨(견인/부진·채널별 브랜드·상품)은 raw 스키마가 복잡하니, **웹과 동일한 grounded 6섹션 초안**을 받아 baseline으로 쓴다:
```bash
python3 - <<'PY'
import json,urllib.request
s=json.load(open('/tmp/mr_summary.json'))
body=json.dumps({'month':'<YYYY-MM>','part':'<PART>','summary':s}).encode()
req=urllib.request.Request('https://api.gongbaksoo.com/api/monthly-review/ai-analysis/',data=body,method='POST',headers={'Content-Type':'application/json','User-Agent':'curl/8.7.1'})
print(json.load(urllib.request.urlopen(req,timeout=120))['analysis'])
PY
```
→ 이 6섹션 초안(채널 동향/채널별/브랜드별 grounded)을 사실 베이스로, raw 디지스트로 교차검증한다.

## 2. 인사이트 갭 질문 도출

데이터에서 **설명되지 않는 지점**을 찾아, "사람만 아는 것"을 묻는 질문 5~8개를 **우선순위 순 번호 목록**으로 만든다. 아래 체크리스트를 매번 적용(해당 월에 신호가 있는 것만):

1. **급변 채널/브랜드/상품의 원인** — 큰 증감(예: ±수십백만원)에 대해: 행사·딜 종료, 단가 변동, 신규/이탈 거래처, 입점 변동, 밀어내기 중 무엇인가?
2. **MoM↔YoY 괴리 / base effect** — 전월 대비 빠졌는데 전년 대비 늘었으면: 직전월이 일회성 피크였나? → "부진"이 아니라 "정상화"일 수 있음(총평 프레이밍이 바뀜).
3. **목표 미달/초과의 실제 드라이버** — 달성률을 끌어내린/올린 1~2개 요인은? 통제 가능한가?
4. **시즌성·재고·프로모션 종료** — 급감(특히 키즈/시즌 상품)이 계절·재고소진·프로모션 종료 때문인가? 다음 달 회복 예정인가?
5. **다음 달 확정 계획/이벤트** — 신규 입점, 행사, 단가 조정, 신상품 등 이미 잡힌 일정은? (액션의 근거가 됨)
6. **리스크 vs 일회성 구분** — 이번 하락/상승이 구조적 추세인지 일회성인지에 대한 현장 판단.

질문은 **구체적 수치를 인용**해 묻는다(예: "스페셜 채널이 직전월 대비 52백만원(−98%) 빠졌는데, 행사 종료인가요 거래 이탈인가요?"). 답하기 쉽게 한 번에 번호로 제시하고, 모르면 "스킵" 가능함을 안내.

## 3. 문답

사용자 답변을 받는다. 답변에서 추가로 파고들 지점이 있으면 1~2개 후속 질문. 답이 충분해지면 종합으로 넘어간다. (사용자가 빨리 끝내려 하면 받은 답만으로 진행.)

## 4. 종합 → 리뷰 문서

답변(현장 맥락)을 데이터에 결합해 **왜·그래서 무엇을**이 담긴 문서를 만든다. 수치=데이터, 맥락=사용자 답변으로 출처를 구분(예: "(현장)" 표기). 구조:

```
# {YYYY년 M월} 월 매출 리뷰 — {파트 라벨}
> 데이터: {파일} · 대상월 {YYYY-MM} · 작성 {작성일} · 파트 {파트}

## 1. 총평
- 한 줄 결론(맥락 반영 프레이밍: 단순 호조/부진이 아니라 "왜 그렇게 봐야 하는지"). 근거 수치 1개.

## 2. 핵심 실적
- 대상월 실적 / 목표비(달성률·차액) / 전년동월비(±%·차액) / 최근 흐름(최근 3개월 MoM 연쇄).

## 3. 채널 인사이트
- 견인/부진 채널을 수치로 짚고, **왜**(현장 맥락)와 **그래서 무엇을**까지. 일회성/구조적 구분.

## 4. 브랜드 인사이트 (마이비 / 누비 / 쏭레브)
- 각 브랜드: 실적(직전월·전년·월평균·달성률) + 주요 상품(매출 상위 + 전월비) + 현장 맥락.

## 5. 리스크 & 기회
- 사용자 답변 기반으로 모니터링할 리스크와 키울 기회를 분리. 각 항목에 근거 수치.

## 6. 다음 달 액션
- '대상 + 무엇을 + 근거 수치(+ 확정 계획)' 한 문장씩. 데이터+현장계획에 근거한 것만(당위적 일반론 금지).

## 7. 모니터링 포인트
- 다음 달 지켜볼 채널·브랜드·상품 1~3개 + 판단 기준.

## 부록: 문답 기록
- 이번 리뷰에서 주고받은 Q/A를 그대로 보존(추적성).
```

## 5. 저장 & 마무리

- `reviews/` 폴더에 **같은 이름으로 .md와 .html 둘 다** 저장. 파일명: `reviews/{YYYY-MM}_{파트}_리뷰.{md,html}` (파트: all→전체, ecommerce→이커머스, offline→오프라인). 폴더 없으면 생성.
- HTML은 아래 스타일을 인라인으로 넣은 **독립 실행 HTML**(외부 의존 없음)으로, md와 동일 내용을 표·서식으로 보기 좋게.
- 저장 후 두 파일 경로를 사용자에게 보고. **커밋/푸시는 자동으로 하지 말 것**(사용자가 요청하면 진행).

HTML 골격(스타일 고정 — 가독성·표 위주, 이모지 금지):
```html
<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{YYYY-MM} 월 매출 리뷰 — {파트}</title>
<style>
  body{font-family:-apple-system,"Pretendard","맑은 고딕",sans-serif;max-width:840px;margin:32px auto;padding:0 20px;color:#1a1a1a;line-height:1.7;font-size:14px}
  h1{font-size:22px;border-bottom:2px solid #1a1a1a;padding-bottom:8px}
  h2{font-size:17px;margin-top:28px;border-left:4px solid #1a1a1a;padding-left:8px}
  .meta{color:#666;font-size:12px;margin:-8px 0 20px}
  table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f5f5f5}
  .ctx{color:#0a5} /* 현장 맥락 표시색 */
  ul{padding-left:20px}
  blockquote{color:#666;border-left:3px solid #ddd;margin:0;padding:4px 12px}
</style></head><body>
<!-- md 내용을 동일하게 HTML로 변환해 채움 -->
</body></html>
```

## 가드레일 (요약)
- **분석 전 `company-context.md` 로드 필수.** 거기 standing 사실은 전제로 쓰되, `[확인 요망]`은 사실로 단정하지 말 것.
- 수치는 데이터만, 맥락은 사용자 답변만 — 출처 구분. 데이터에 없는 지표(객단가·ROAS·재고수량 등) 창작 금지.
- 채널·브랜드·상품 전년비는 전년 수치가 있는 곳에서만(파트 전체=chart2, 브랜드=brand_focus). 상품은 전년 수치 없음.
- 단위 백만원 통일. Cloudflare 우회 위해 모든 prod 호출에 `User-Agent` 헤더.
- 파일 생성만; 커밋/푸시/배포는 사용자 요청 시에만.
