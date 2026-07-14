/**
 * 일 리뷰 전용 금액 포맷터.
 *
 * 이름에 단위를 박아둔다. 기존 차트 컴포넌트 8곳에 `toMan`이라는 같은 이름의 함수가 있는데
 * ChannelIssueSection만 ÷10,000이고 나머지 7곳은 ÷1,000,000이다(docs/error.md §45).
 * 일 값은 월 값의 약 1/30이라 백만원으로 반올림하면 0~수십으로 뭉개진다. 일 리뷰는 만원 고정.
 */

/** 원 → 만원 (숫자). */
export function toManwon(won: number): number {
  return won / 10_000;
}

/** 원 → "1,063만원". 반올림. */
export function fmtManwon(won: number | null | undefined): string {
  if (won === null || won === undefined || Number.isNaN(won)) return "-";
  return `${Math.round(won / 10_000).toLocaleString("ko-KR")}만원`;
}

/** 원 → "1,063" (단위 없이. 표 안에서 헤더에 단위를 한 번만 쓸 때). */
export function fmtManwonBare(won: number | null | undefined): string {
  if (won === null || won === undefined || Number.isNaN(won)) return "-";
  return Math.round(won / 10_000).toLocaleString("ko-KR");
}

/** 원 → "5.9억" 같은 축약. 60일 순매출처럼 큰 값에만. */
export function fmtEok(won: number | null | undefined): string {
  if (won === null || won === undefined || Number.isNaN(won)) return "-";
  return `${(won / 100_000_000).toFixed(1)}억`;
}
