/**
 * /api/daily-review/summary/ 응답 타입.
 *
 * 여기에 dod / yoy / landing / B군 일별 시계열 필드가 없는 것은 실수가 아니다.
 * 백엔드가 그 필드를 만들지 않는다. 만들 수 없으면 그릴 수 없다.
 */

export interface Split {
  gross: number;
  returns: number;
  net: number;
}

export interface ChannelClass {
  name: string;
  group: "A" | "B";
  density: number;
  days_seen: number;
  cv: number | null;
  high_variance: boolean;
  net_60d: number;
  allow_daily_series: boolean;
}

export interface AChannelRow {
  channel: string;
  net: number;
  ref_min: number | null;
  ref_max: number | null;
  ref_median: number | null;
  ref_n: number;
  position: string;
  high_variance: boolean;
}

export interface Anomaly {
  level: "channel" | "account";
  kind: "surge" | "drop";
  entity: string;
  value: number;
  ref_min: number;
  ref_max: number;
  ref_median: number;
  ref_valid: number;
  gap: number;
}

export interface BEvent {
  channel: string;
  kind: "info" | "check";
  today_net: number;
  last_accrual_date: string;
  last_accrual_net: number;
  days_since: number;
  message: string;
}

export interface Pace {
  month: string;
  as_of_date: string;
  dom: number;
  days_in_month: number;
  progress_ratio: number;
  mtd: Split;
  target: number | null;
  achievement_pct: number | null;
  is_month_final: boolean;
  expected_share: { med: number; p25: number; p75: number } | null;
  expected_mtd_band: { low: number; high: number } | null;
  band_position: string | null;
  pace_index: number | null;
  base_rate: { mean_achievement: number; hit_100_count: number; n_months: number } | null;
  learned_months: string[] | null;
  suppressed_reason: string | null;
}

export interface DailyReview {
  status: "ok" | "non_core_day" | "no_data";
  message?: string;
  suggestion?: string | null;
  meta: {
    filename: string;
    file_hash: string | null;
    target_date: string;
    target_date_source: "auto_latest" | "user";
    weekday: string;
    dom: number;
    days_in_month: number;
    progress_ratio: number;
    day_flags: string[];
    prior_core_date: string | null;
    gap_days: number | null;
  };
  data_freshness: {
    latest_core_date: string;
    data_max_date: string;
    file_date: string | null;
    file_lag_days: number | null;
    stale: boolean;
    provisional: boolean;
  };
  channel_classification: {
    window: { start: string; end: string; n: number };
    thresholds: Record<string, number>;
    channels: ChannelClass[];
  };
  accrual_snapshot: {
    a_group: Split;
    b_group: Split;
    total: Split;
    a_channels: AChannelRow[];
    ref_dates: string[];
    footnote: string;
  };
  mtd_pace: Pace;
  anomalies: {
    flags: Anomaly[];
    suppressed_reason: string | null;
    checked: { channels: number; gates: { channel: number; account: number } };
  };
  bgroup_events: BEvent[];
  silence_log: {
    coverage_pct: number | null;
    skipped_bgroup: string[];
    skipped_shadow_product: string;
    note: string;
  };
}

export const FLAG_LABEL: Record<string, string> = {
  month_end_batch: "월말 마감 계상일",
  post_gap: "연휴·결측 직후",
  return_batch: "반품 배치일",
};
