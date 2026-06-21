# reviews/ — 월 매출 리뷰 자료

`/monthly-review-insight` 스킬이 생성한 회의용 월 리뷰 문서가 쌓이는 폴더.

- 파일명: `{YYYY-MM}_{파트}_리뷰.md` / `.html` (파트: 전체 / 이커머스 / 오프라인)
- `.md` = 편집·버전관리용, `.html` = 공유·보기용(독립 실행, 외부 의존 없음)
- 작성 방식: 데이터 자동 취합(prod API) + 사용자 문답으로 현장 맥락을 결합 → 시사점이 아닌 **인사이트**(왜·그래서 무엇을) 중심.

스킬 정의: `.claude/skills/monthly-review-insight/SKILL.md`
