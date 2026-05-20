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

interface ChannelData {
  name: string;
  row_count: number;
  vendors: { name: string; row_count: number; values: number[] }[];
  brands: { name: string; row_count: number; values: number[] }[];
}

interface Props {
  part: Part;
  channels: ChannelData[]; // 백엔드 channel_issue[part].channels
  months: string[];
  groups: GroupDef[];
  onGroupsChange: (next: GroupDef[]) => void;
}


const toMan = (v: number) => Math.round(v / 1_000_000);
const shortLabel = (m: string) => {
  const t = m.match(/^(\d{4})-(\d{2})$/);
  return t ? `${t[1].slice(-2)}.${t[2]}` : m;
};

interface AggregatedOption {
  name: string;
  row_count: number;
  values: number[];
}

// 그룹의 채널들에 속한 row를 vendor/brand 기준으로 합산
function aggregate(
  channels: ChannelData[],
  groupChannels: string[],
  kind: "vendors" | "brands",
  monthsCount: number
): AggregatedOption[] {
  const map = new Map<string, AggregatedOption>();
  for (const ch of channels) {
    if (!groupChannels.includes(ch.name)) continue;
    for (const item of ch[kind]) {
      const existing = map.get(item.name);
      if (existing) {
        existing.row_count += item.row_count;
        for (let i = 0; i < monthsCount; i++) {
          existing.values[i] += item.values[i] ?? 0;
        }
      } else {
        map.set(item.name, {
          name: item.name,
          row_count: item.row_count,
          values: [...item.values],
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.row_count - a.row_count);
}

interface MiniChartProps {
  title: string;
  subtitle: string;
  data: AggregatedOption[];
  selected: string[];
  months: string[];
  onEdit: () => void;
  editLabel: string;
}

function MiniLineChart({
  title,
  subtitle,
  data,
  selected,
  months,
  onEdit,
  editLabel,
}: MiniChartProps) {
  // 사용자가 정한 selected 순서 그대로 (표시 우선순위)
  const selectedItems = useMemo(() => {
    const byName = new Map(data.map((d) => [d.name, d]));
    return selected
      .map((name) => byName.get(name))
      .filter((d): d is AggregatedOption => Boolean(d));
  }, [data, selected]);

  const styles = selectedItems.map((_, i) => getMultiSeriesStyle(i));

  const chartData = months.map((m, idx) => {
    const row: Record<string, string | number> = { month: shortLabel(m) };
    selectedItems.forEach((it) => {
      row[it.name] = toMan(it.values[idx] ?? 0);
    });
    return row;
  });

  return (
    <div className="bg-white border border-[#c4c4c4] p-4">
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <h4 className="text-[13px] font-bold text-black">{title}</h4>
        <button
          type="button"
          onClick={onEdit}
          className="text-[11px] border border-[#c4c4c4] px-2 py-1 rounded hover:border-black whitespace-nowrap"
        >
          {editLabel} ▾
        </button>
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
                    key={it.name}
                    type="monotone"
                    dataKey={it.name}
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

  // 그룹별 집계 데이터
  const groupAggs = useMemo(() => {
    return groups.map((g) => ({
      group: g,
      vendors: aggregate(channels, g.channels, "vendors", months.length),
      brands: aggregate(channels, g.channels, "brands", months.length),
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
    const items = editing.kind === "vendor" ? ga.vendors : ga.brands;
    const selected = editing.kind === "vendor" ? ga.group.vendorSelection : ga.group.brandSelection;
    return {
      title: `${ga.group.name} — 표시 ${editing.kind === "vendor" ? "거래처" : "브랜드"} 수정`,
      description: `${ga.group.name} 그룹 (${ga.group.channels.join(" / ") || "—"})의 ${editing.kind === "vendor" ? "R열 거래처" : "D열 브랜드"} unique 목록. 체크된 항목만 차트에 표시.`,
      options: items.map((it) => ({ name: it.name, row_count: it.row_count })) as ProductOption[],
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
        <button
          type="button"
          onClick={() => setGroupModalOpen(true)}
          className="text-[11px] border border-[#c4c4c4] px-2 py-1 rounded hover:border-black"
        >
          그룹 설정 ▾
        </button>
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
                subtitle={`최근 12개월 (백만) · R열 거래처명 기준${
                  ga.group.channels.length > 0 ? "" : " · 채널 미지정 → 빈 데이터"
                }`}
                data={ga.vendors}
                selected={ga.group.vendorSelection}
                months={months}
                onEdit={() => setEditing({ groupId: ga.group.id, kind: "vendor" })}
                editLabel="표시 거래처 수정"
              />
              <MiniLineChart
                title="브랜드별 매출 트렌드"
                subtitle="최근 12개월 (백만) · D열 품목그룹1 기준"
                data={ga.brands}
                selected={ga.group.brandSelection}
                months={months}
                onEdit={() => setEditing({ groupId: ga.group.id, kind: "brand" })}
                editLabel="표시 브랜드 수정"
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
