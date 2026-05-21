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

interface ProductSeries extends NamedSeries {
  brand: string; // 품목그룹1 (D열) — 같은 상품명도 브랜드 다르면 별도 엔트리
}

interface ChannelData {
  name: string;
  row_count: number;
  values?: number[]; // 채널(P열) 12개월 합계 (백엔드 보강)
  vendors: NamedSeries[]; // R열 거래처명 (채널별)
  brands: NamedSeries[]; // D열 품목그룹1
  products?: ProductSeries[]; // S열 품목 구분 × 브랜드
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
const koSort = (a: string, b: string) => a.localeCompare(b, "ko");

// 차트 모델 — 부모(채널 P열 / 브랜드 D열) 합계 + 자식(거래처 R열 / 상품 S열) 분해.
// 자식 라인 값은 "선택된 부모"에 따라 동적 스코프되므로 부모/자식 값을 모두 보관.
interface ChartModel {
  parentPrefix: string; // "P:" | "D:"
  childPrefix: string; // "R:" | "S:"
  parentTotals: Map<string, number[]>; // 부모명 → 12개월 합계
  childByParent: Map<string, Map<string, number[]>>; // 자식명 → 부모명 → 12개월 값
  options: ProductOption[]; // 모달 옵션 (부모합계 먼저, 자식 가나다순 / 자식은 속한 모든 부모 그룹에 표시)
}

// 한 그룹의 채널들로부터 부모-자식 차트 모델 구성.
function buildChartModel(
  channels: ChannelData[],
  groupChannels: string[],
  monthsCount: number,
  kind: "vendor" | "brand"
): ChartModel {
  const parentPrefix = kind === "vendor" ? "P:" : "D:";
  const childPrefix = kind === "vendor" ? "R:" : "S:";
  const inGroup = new Set(groupChannels);
  const groupCh = channels.filter((c) => inGroup.has(c.name));

  const parentTotals = new Map<string, number[]>();
  const parentRowCount = new Map<string, number>();
  const parentOrder: string[] = [];
  const childByParent = new Map<string, Map<string, number[]>>();
  const childRowCount = new Map<string, number>(); // 자식 전체 row (fallback)
  const childRowByParent = new Map<string, Map<string, number>>(); // 자식 × 부모별 row

  const addParent = (name: string, values: number[], rc: number) => {
    if (!parentTotals.has(name)) {
      parentTotals.set(name, new Array(monthsCount).fill(0));
      parentRowCount.set(name, 0);
      parentOrder.push(name);
    }
    const acc = parentTotals.get(name)!;
    for (let i = 0; i < monthsCount; i++) acc[i] += values[i] ?? 0;
    parentRowCount.set(name, parentRowCount.get(name)! + rc);
  };
  const addChild = (child: string, parent: string, values: number[], rc: number) => {
    if (!childByParent.has(child)) {
      childByParent.set(child, new Map());
      childRowCount.set(child, 0);
      childRowByParent.set(child, new Map());
    }
    const m = childByParent.get(child)!;
    if (!m.has(parent)) m.set(parent, new Array(monthsCount).fill(0));
    const acc = m.get(parent)!;
    for (let i = 0; i < monthsCount; i++) acc[i] += values[i] ?? 0;
    childRowCount.set(child, childRowCount.get(child)! + rc);
    const rm = childRowByParent.get(child)!;
    rm.set(parent, (rm.get(parent) ?? 0) + rc);
  };

  if (kind === "vendor") {
    // 부모 = 채널(P열): 그룹의 채널 순서 유지. 자식 = 거래처(R열, 채널별)
    for (const name of groupChannels) {
      const ch = groupCh.find((c) => c.name === name);
      if (!ch) continue;
      addParent(ch.name, ch.values ?? new Array(monthsCount).fill(0), ch.row_count);
      for (const v of ch.vendors ?? []) addChild(v.name, ch.name, v.values, v.row_count);
    }
  } else {
    // 부모 = 브랜드(D열): 그룹 채널들 가로질러 합산. 자식 = 상품(S열) × 브랜드
    for (const ch of groupCh) {
      for (const b of ch.brands ?? []) addParent(b.name, b.values, b.row_count);
      for (const p of ch.products ?? []) addChild(p.name, p.brand, p.values, p.row_count);
    }
  }

  // 부모 표시 순서: 거래처 차트는 채널 순서, 브랜드 차트는 row_count 내림차순
  let orderedParents = parentOrder;
  if (kind === "brand") {
    orderedParents = [...parentOrder].sort(
      (a, b) => (parentRowCount.get(b) ?? 0) - (parentRowCount.get(a) ?? 0)
    );
  }
  // 자식이 참조하지만 부모합계가 없는 orphan 부모(예: "(미분류)") → 뒤에 가나다로
  const known = new Set(orderedParents);
  const orphan: string[] = [];
  for (const m of childByParent.values()) {
    for (const p of m.keys()) {
      if (!known.has(p) && !orphan.includes(p)) orphan.push(p);
    }
  }
  orphan.sort(koSort);
  const allParents = [...orderedParents, ...orphan];
  const parentIndex = new Map(allParents.map((p, i) => [p, i]));

  // 모달 옵션: 부모합계(순서) → 자식(가나다). 자식은 속한 모든 부모 그룹에 표시(groups[]).
  const options: ProductOption[] = [];
  for (const p of orderedParents) {
    options.push({
      id: `${parentPrefix}${p}`,
      name: p,
      row_count: parentRowCount.get(p) ?? 0,
      group: p,
    });
  }
  const children = [...childByParent.keys()].sort(koSort);
  for (const c of children) {
    const parents = [...childByParent.get(c)!.keys()].sort(
      (a, b) => (parentIndex.get(a) ?? 0) - (parentIndex.get(b) ?? 0)
    );
    const rm = childRowByParent.get(c)!;
    const rowCountByGroup: Record<string, number> = {};
    for (const p of parents) rowCountByGroup[p] = rm.get(p) ?? 0;
    options.push({
      id: `${childPrefix}${c}`,
      name: c,
      row_count: childRowCount.get(c) ?? 0,
      groups: parents,
      rowCountByGroup,
    });
  }

  return { parentPrefix, childPrefix, parentTotals, childByParent, options };
}

interface MiniChartProps {
  title: string;
  subtitle: string;
  model: ChartModel;
  selected: string[]; // id 리스트 (표시 순서)
  months: string[];
  onEdit: () => void;
  editLabel: string;
  editMode: boolean;
}

function MiniLineChart({
  title,
  subtitle,
  model,
  selected,
  months,
  onEdit,
  editLabel,
  editMode,
}: MiniChartProps) {
  const { parentPrefix, childPrefix, parentTotals, childByParent } = model;

  // 선택된 부모로 자식 라인을 동적 스코프:
  //   부모 미선택 → 자식 전체 합산 / 부모 선택 → (선택 부모 ∩ 자식 소속 부모) 합산 / 교집합 없음 → 0
  const selectedSeries = useMemo(() => {
    const selParents = new Set(
      selected
        .filter((id) => id.startsWith(parentPrefix))
        .map((id) => id.slice(parentPrefix.length))
    );
    const out: { id: string; name: string; values: number[] }[] = [];
    for (const id of selected) {
      if (id.startsWith(parentPrefix)) {
        const name = id.slice(parentPrefix.length);
        const vals = parentTotals.get(name);
        if (vals) out.push({ id, name, values: vals });
      } else if (id.startsWith(childPrefix)) {
        const name = id.slice(childPrefix.length);
        const byParent = childByParent.get(name);
        if (!byParent) continue;
        const allP = [...byParent.keys()];
        const scope =
          selParents.size === 0 ? allP : allP.filter((p) => selParents.has(p));
        const values = months.map((_, i) =>
          scope.reduce((s, p) => s + (byParent.get(p)?.[i] ?? 0), 0)
        );
        out.push({ id, name, values });
      }
    }
    return out;
  }, [selected, parentTotals, childByParent, parentPrefix, childPrefix, months]);

  const styles = selectedSeries.map((_, i) => getMultiSeriesStyle(i));

  const chartData = months.map((m, idx) => {
    const row: Record<string, string | number> = { month: shortLabel(m) };
    selectedSeries.forEach((it) => {
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
      {selectedSeries.length === 0 ? (
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
              <Legend wrapperStyle={{ fontSize: 10 }} itemSorter={null} iconType="plainline" />
              {selectedSeries.map((it, i) => {
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
  const [editing, setEditing] = useState<{
    groupId: string;
    kind: "vendor" | "brand";
  } | null>(null);

  const availableChannels = useMemo(() => channels.map((c) => c.name), [channels]);

  // 그룹별 차트 모델 — 거래처 차트: 채널(P열)+거래처(R열), 브랜드 차트: 브랜드(D열)+상품(S열)
  const groupModels = useMemo(() => {
    const n = months.length;
    return groups.map((g) => ({
      group: g,
      vendor: buildChartModel(channels, g.channels, n, "vendor"),
      brand: buildChartModel(channels, g.channels, n, "brand"),
    }));
  }, [channels, groups, months.length]);

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

  const editingContext = useMemo(() => {
    if (!editing) return null;
    const gm = groupModels.find((x) => x.group.id === editing.groupId);
    if (!gm) return null;
    const isVendor = editing.kind === "vendor";
    const model = isVendor ? gm.vendor : gm.brand;
    const selected = isVendor ? gm.group.vendorSelection : gm.group.brandSelection;
    return {
      title: `${gm.group.name} — 표시 ${isVendor ? "거래처" : "브랜드"} 수정`,
      description: isVendor
        ? `${gm.group.name} 그룹 (${gm.group.channels.join(" / ") || "—"}) — 채널(P열)별로 거래처(R열)를 묶어 표시. 채널을 함께 선택하면 그 채널의 거래처만, 채널 미선택 시 전체 채널 합산.`
        : `${gm.group.name} 그룹 (${gm.group.channels.join(" / ") || "—"}) — 브랜드(D열)별로 상품(S열)을 묶어 표시. 브랜드를 함께 선택하면 그 브랜드의 상품만, 브랜드 미선택 시 전체 브랜드 합산.`,
      options: model.options,
      selected,
    };
  }, [editing, groupModels]);

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
          {groupModels.map((gm) => (
            <div key={gm.group.id} className="flex flex-col gap-3">
              <div className="text-[12px] font-bold text-[#5d5d5d] uppercase tracking-wide pb-1 border-b border-dashed border-[#c4c4c4]">
                {gm.group.name}
                {gm.group.channels.length === 0 && (
                  <span className="ml-2 text-[10px] font-normal text-[#ff0066]">
                    채널 미지정
                  </span>
                )}
              </div>
              <MiniLineChart
                title="거래처별 매출 트렌드"
                subtitle={`최근 12개월 (백만) · 채널(P열) + 거래처(R열)${
                  gm.group.channels.length > 0 ? "" : " · 채널 미지정 → 빈 데이터"
                }`}
                model={gm.vendor}
                selected={gm.group.vendorSelection}
                months={months}
                onEdit={() => setEditing({ groupId: gm.group.id, kind: "vendor" })}
                editLabel="표시 거래처 수정"
                editMode={editMode}
              />
              <MiniLineChart
                title="브랜드별 매출 트렌드"
                subtitle="최근 12개월 (백만) · 브랜드(D열) + 상품(S열)"
                model={gm.brand}
                selected={gm.group.brandSelection}
                months={months}
                onEdit={() => setEditing({ groupId: gm.group.id, kind: "brand" })}
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
