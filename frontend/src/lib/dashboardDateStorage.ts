import axios from "axios";
import { API_BASE_URL } from "@/config/api";

// 매출 분석 대시보드 그래프별 "기간(시작월~종료월)" 설정을 백엔드에 저장/복원.
// 모든 기기가 같은 백엔드를 바라보므로 기기 간 공유된다.
// 백엔드가 아직 배포되지 않았거나 오류가 나도 조용히 폴백하여 그래프는 정상 동작한다.

export type ChartDatePref = { start: string; end: string };
type AllPrefs = Record<string, ChartDatePref>;

const ENDPOINT = `${API_BASE_URL}/custom/dashboard-dates/`;

// 6개 그래프가 동시에 마운트되어도 GET은 한 번만 나가도록 캐시 + 인플라이트 공유.
let cache: AllPrefs | null = null;
let inflight: Promise<AllPrefs> | null = null;

async function fetchAll(): Promise<AllPrefs> {
    if (cache) return cache;
    if (inflight) return inflight;

    inflight = axios
        .get<AllPrefs>(`${ENDPOINT}?t=${Date.now()}`)
        .then((res) => {
            cache = res.data && typeof res.data === "object" ? res.data : {};
            return cache;
        })
        .catch(() => {
            // 백엔드 미배포/오류 → 빈 설정으로 폴백 (그래프는 기본 기간 사용)
            cache = {};
            return cache;
        })
        .finally(() => {
            inflight = null;
        });

    return inflight;
}

/** 특정 그래프의 저장된 기간을 반환. 없거나 오류면 null. */
export async function loadDashboardDate(chartId: string): Promise<ChartDatePref | null> {
    const all = await fetchAll();
    const pref = all[chartId];
    if (pref && typeof pref.start === "string" && typeof pref.end === "string") {
        return pref;
    }
    return null;
}

/** 특정 그래프의 기간을 저장. 실패해도 throw하지 않음(조용히 무시). */
export async function saveDashboardDate(chartId: string, start: string, end: string): Promise<void> {
    // 로컬 캐시 즉시 갱신 (같은 세션 내 재마운트 시 일관성 유지)
    if (cache) {
        cache[chartId] = { start, end };
    }
    try {
        await axios.post(ENDPOINT, { chart_id: chartId, start, end });
    } catch {
        // 백엔드 미배포/오류 → 무시. 다음 접속 시 복원만 안 될 뿐 현재 동작엔 지장 없음.
    }
}
