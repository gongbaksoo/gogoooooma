"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import ProductSelectionModal, { ProductOption } from "./ProductSelectionModal";
import GroupConfigModal from "./GroupConfigModal";
import { GroupDef, Part } from "./channelIssueStorage";
import { getMultiSeriesStyle } from "@/lib/chartPalette";

interface NamedSeries {
  name: string;
  row_count: number;
  values: number[];
}

interface ChannelData {
  name: string;
  row_count: number;
  values?: number[]; // 채널(P열) 12개월 합계 (백엔드 보강)
  vendors: NamedSeries[]; // R열 거래처명
  brands: NamedSeries[]; // D열 품목그룹1
  products?: NamedSeries[]; // S열 품목 구분 (백엔드 보강)
}

interface Props {
  part: Part;
  channels: ChannelData[]; // 백엔드 channel_issue[part].channels
  months: string[];
  groups: GroupDef[];
  onGroupsChange: (next: GroupDef[]) => void;
  editMode: boolean;
}

const toMan = (v: number) => Math.round(v / 1_000_000);
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

// 차트/모달 공통 옵션 — id로 식별(이름 충돌 대비), group으로 묶음 구분
interface ChartOption {
  id: string; // "P:..." | "R:..." | "D:..." | "S:..."
  name: string;
  row_count: number;
  values: number[];
  group: string;
}

// 그룹의 각 채널(P열)을 채널 합계 라인으로 (그룹 채널 순서 유지)
function channelOptions(
  channels: ChannelData[],
  groupChannels: string[],
  monthsCount: number,
  group: string
): ChartOption[] {
  const byName = new Map(channels.map((c) => [c.name, c]));
  const out: ChartOption[] = [];
  for (const name of groupChannels) {
    const ch = byName.get(name);
    if (!ch) continue;
    const values = ch.values ? [...ch.values] : new Array(monthsCount).fill(0);
    out.push({ id: `P:${ch.name}`, name: ch.name, row_count: ch.row_count, values, group });
  }
  return out;
}

// 그룹 채널들을 가로질러 vendors/brands/products를 이름 기준 합산
function aggregate(
  channels: ChannelData[],
  groupChannels: string[],
  kind: "vendors" | "brands" | "products",
  monthsCount: number,
  prefix: string,
  group: string
): ChartOption[] {
  const map = new Map<string, ChartOption>();
  for (const ch of channels) {
    if (!groupChannels.includes(ch.name)) continue;
    const items = (ch[kind] ?? []) as NamedSeries[];
    for (const item of items) {
      const id = `${prefix}${item.name}`;
      const existing = map.get(id);
      if (existing) {
        existing.row_count += item.row_count;
        for (let i = 0; i < monthsCount; i++) {
          existing.values[i] += item.values[i] ?? 0;
        }
      } else {
        map.set(id, {
          id,
          name: item.name,
          row_count: item.row_count,
          values: [...item.values],
          group,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.row_count - a.row_count);
}

interface MiniChartProps {
  title: string;
  subtitle: string;
  data: ChartOption[];
  selected: string[]; // id 리스트
  months: string[];
  onEdit: () => void;
  editLabel: string;
  editMode: boolean;
}

function MiniLineChart({
  title,
  subtitle,
  data,
  selected,
  months,
  onEdit,
  editLabel,
  editMode,
}: MiniChartProps) {
  // 사용자가 정한 selected(id) 순서 그대로 (표시 우선순위)
  const selectedItems = useMemo(() => {
    const byId = new Map(data.map((d) => [d.id, d]));
    return selected
      .map((id) => byId.get(id))
      .filter((d): d is ChartOption => Boolean(d));
  }, [data, selected]);

  const styles = selectedItems.map((_, i) => getMultiSeriesStyle(i));

  const chartData = months.map((m, idx) => {
    const row: Record<string, string | number> = { month: shortLabel(m) };
    selectedItems.forEach((it) => {
      row[it.id] = toMan(it.values[idx] ?? 0);
    });
    return row;
  });

  return (
    <div className="bg-white border border-[#c4c4c4] p-4">
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <h4 className="text-[13px] font-bold text-black">{title}</h4>
        {editMode && (
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] border border-[#c4c4c4] px-2 py-1 rounded hover:border-black whitespace-nowrap"
          >
            {editLabel} ▾
          </button>
        )}
      </div>
      <div className="text-[11px] text-[#5d5d5d] mb-2">{subtitle}</div>
      {selectedItems.length === 0 ? (
        <div className="text-center text-[12px] text-[#5d5d5d] py-12 border border-dashed border-[#c4c4c4]">
          표시할 항목을 선택해주세요
        </div>
      ) : (
        <div key={`chart-${selected.join("|")}`}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="#5d5d5d"
                tick={{ fontSize: 10 }}
                axisLine={{ stroke: "#c4c4c4" }}
              />
              <YAxis stroke="#5d5d5d" tick={{ fontSize: 10 }} axisLine={{ stroke: "#c4c4c4" }} />
              <Tooltip
                contentStyle={{ border: "1px solid #c4c4c4", borderRadius: 2, fontSize: 12 }}
                formatter={(v: number, name: string) => [`${v.toLocaleString()} 백만`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} itemSorter={null} />
              {selectedItems.map((it, i) => {
                const s = styles[i];
                return (
                  <Line
                    key={it.id}
                    type="monotone"
                    dataKey={it.id}
                    name={it.name}
                    stroke={s.stroke}
                    strokeWidth={s.strokeWidth}
                    strokeDasharray={s.strokeDasharray}
                    dot={{ r: 1.5, fill: s.stroke }}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function ChannelIssueSection({
  part,
  channels,
  months,
  groups,
  onGroupsChange,
  editMode,
}: Props) {
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  // 모달 open: vendor/brand selection
  const [editing, setEditing] = useState<{
    groupId: string;
    kind: "vendor" | "brand";
  } | null>(null);

  const availableChannels = useMemo(
    () => channels.map((c) => c.name),
    [channels]
  );

  // 그룹별 차트 옵션 — 거래처 차트: P열(위)+R열(아래), 브랜드 차트: D열(위)+S열(아래)
  const groupAggs = useMemo(() => {
    const n = months.length;
    return groups.map((g) => ({
      group: g,
      vendorData: [
        ...channelOptions(channels, g.channels, n, "채널 (P열)"),
        ...aggregate(channels, g.channels, "vendors", n, "R:", "거래처 (R열)"),
      ],
      brandData: [
        ...aggregate(channels, g.channels, "brands", n, "D:", "브랜드 (D열)"),
        ...aggregate(channels, g.channels, "products", n, "S:", "상품 (S열)"),
      ],
    }));
  }, [channels, groups, months.length]);

  // 모달 적용 → 해당 그룹의 vendorSelection 또는 brandSelection 업데이트
  const handleApplySelection = (next: string[]) => {
    if (!editing) return;
    const updated = groups.map((g) => {
      if (g.id !== editing.groupId) return g;
      return editing.kind === "vendor"
        ? { ...g, vendorSelection: next }
        : { ...g, brandSelection: next };
    });
    onGroupsChange(updated);
  };

  // editing 정보 → 모달 props
  const editingContext = useMemo(() => {
    if (!editing) return null;
    const ga = groupAggs.find((x) => x.group.id === editing.groupId);
    if (!ga) return null;
    const isVendor = editing.kind === "vendor";
    const items = isVendor ? ga.vendorData : ga.brandData;
    const selected = isVendor ? ga.group.vendorSelection : ga.group.brandSelection;
    return {
      title: `${ga.group.name} — 표시 ${isVendor ? "거래처" : "브랜드"} 수정`,
      description: isVendor
        ? `${ga.group.name} 그룹 (${ga.group.channels.join(" / ") || "—"}) — 채널(P열) 합계와 거래처(R열) 항목. 체크된 항목만 차트에 표시.`
        : `${ga.group.name} 그룹 (${ga.group.channels.join(" / ") || "—"}) — 브랜드(D열)와 하위 상품(S열) 항목. 체크된 항목만 차트에 표시.`,
      options: items.map((it) => ({
        id: it.id,
        name: it.name,
        row_count: it.row_count,
        group: it.group,
      })) as ProductOption[],
      selected,
    };
  }, [editing, groupAggs]);

  // 그리드: 그룹 수에 따라 컬럼 수 결정 (1~3은 그대로, 4+ 는 자동 줄바꿈)
  const gridCols =
    groups.length === 1
      ? "grid-cols-1"
      : groups.length === 2
      ? "grid-cols-1 lg:grid-cols-2"
      : "grid-cols-1 lg:grid-cols-3";

  return (
    <>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#c4c4c4]">
        <h2 className="text-[15px] font-bold text-black">주요 채널 이슈</h2>
        {editMode && (
          <button
            type="button"
            onClick={() => setGroupModalOpen(true)}
            className="text-[11px] border border-[#c4c4c4] px-2 py-1 rounded hover:border-black"
          >
            그룹 설정 ▾
          </button>
        )}
      </div>

      {channels.length === 0 ? (
        <div className="text-center text-[13px] text-[#5d5d5d] py-12 border border-[#c4c4c4]">
          해당 파트에 P열 채널구분 값이 없습니다.
        </div>
      ) : (
        <div className={`grid ${gridCols} gap-4`}>
          {groupAggs.map((ga) => (
            <div key={ga.group.id} className="flex flex-col gap-3">
              <div className="text-[12px] font-bold text-[#5d5d5d] uppercase tracking-wide pb-1 border-b border-dashed border-[#c4c4c4]">
                {ga.group.name}
                {ga.group.channels.length === 0 && (
                  <span className="ml-2 text-[10px] font-normal text-[#ff0066]">
                    채널 미지정
                  </span>
                )}
              </div>
              <MiniLineChart
                title="거래처별 매출 트렌드"
                subtitle={`최근 12개월 (백만) · 채널(P열) + 거래처(R열)${
                  ga.group.channels.length > 0 ? "" : " · 채널 미지정 → 빈 데이터"
                }`}
                data={ga.vendorData}
                selected={ga.group.vendorSelection}
                months={months}
                onEdit={() => setEditing({ groupId: ga.group.id, kind: "vendor" })}
                editLabel="표시 거래처 수정"
                editMode={editMode}
              />
              <MiniLineChart
                title="브랜드별 매출 트렌드"
                subtitle="최근 12개월 (백만) · 브랜드(D열) + 상품(S열)"
                data={ga.brandData}
                selected={ga.group.brandSelection}
                months={months}
                onEdit={() => setEditing({ groupId: ga.group.id, kind: "brand" })}
                editLabel="표시 브랜드 수정"
                editMode={editMode}
              />
            </div>
          ))}
        </div>
      )}

      <GroupConfigModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title={`주요 채널 이슈 — 그룹 설정 (${
          part === "all" ? "전체" : part === "ecommerce" ? "이커머스" : "오프라인"
        })`}
        availableChannels={availableChannels}
        groups={groups}
        onApply={onGroupsChange}
      />

      {editingContext && (
        <ProductSelectionModal
          open={editing !== null}
          onClose={() => setEditing(null)}
          title={editingContext.title}
          description={editingContext.description}
          options={editingContext.options}
          selected={editingContext.selected}
          onApply={handleApplySelection}
        />
      )}
    </>
  );
}
