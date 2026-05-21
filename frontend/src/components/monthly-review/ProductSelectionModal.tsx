"use client";

import { useEffect, useMemo, useState } from "react";

export interface ProductOption {
  name: string;
  /** row 수 — 미지정 시 "n row" 표기를 숨김 (row 개념이 없는 시리즈용) */
  row_count?: number;
  /** 선택 식별자 — 미지정 시 name 사용. 같은 이름이 다른 묶음에 있을 때 충돌 방지 */
  id?: string;
  /** 묶음 라벨 — 지정 시 옵션 목록을 묶음별 헤더+구분선으로 분리 표시 */
  group?: string;
  /** 다중 묶음 — 지정 시 항목이 여러 헤더 아래 동시 표시 (체크박스는 id 기준 1개로 동기화) */
  groups?: string[];
  /** 묶음별 row 수 — 지정 시 각 헤더 아래에서 그 묶음 몫의 row 수를 표시 (미지정 묶음은 row_count) */
  rowCountByGroup?: Record<string, number>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** 전체 옵션 */
  options: ProductOption[];
  /** 현재 선택된 id 리스트 (순서 = 표시 우선순위) */
  selected: string[];
  onApply: (next: string[]) => void;
  /** 검색 가능 여부 (옵션 많을 때) */
  searchable?: boolean;
}

const optId = (o: ProductOption) => o.id ?? o.name;

export default function ProductSelectionModal({
  open,
  onClose,
  title,
  description,
  options,
  selected,
  onApply,
  searchable = true,
}: Props) {
  // draft = 선택된 id의 순서 있는 배열 (표시 우선순위)
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(selected);
      setQuery("");
      setDragIndex(null);
    }
  }, [open, selected]);

  const draftSet = useMemo(() => new Set(draft), [draft]);

  // 옵션 고유 id 집합 (한 항목이 여러 그룹에 중복 표시될 수 있어 카운트/전체선택은 dedupe)
  const uniqueIds = useMemo(() => {
    const s = new Set<string>();
    options.forEach((o) => s.add(optId(o)));
    return s;
  }, [options]);

  // id → 표시 이름
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    options.forEach((o) => map.set(optId(o), o.name));
    return map;
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  // 묶음별로 그룹핑 (group/groups 미지정이면 단일 묶음). groups 지정 시 여러 헤더에 동시 표시.
  const grouped = useMemo(() => {
    const hasGroups = options.some((o) => o.group || (o.groups && o.groups.length));
    if (!hasGroups) return [{ label: null as string | null, items: filteredOptions }];
    const order: string[] = [];
    const map = new Map<string, ProductOption[]>();
    for (const o of filteredOptions) {
      const gs = o.groups && o.groups.length ? o.groups : [o.group ?? ""];
      for (const g of gs) {
        if (!map.has(g)) {
          map.set(g, []);
          order.push(g);
        }
        map.get(g)!.push(o);
      }
    }
    return order.map((g) => ({ label: g, items: map.get(g)! }));
  }, [options, filteredOptions]);

  if (!open) return null;

  // 체크: 맨 뒤에 추가 / 해제: 제거 (순서 보존)
  const toggle = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const reorderByDrag = (from: number, to: number) => {
    setDraft((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length)
        return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleApply = () => {
    // 사용자가 정한 순서 그대로 반환 (재정렬하지 않음)
    onApply(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#c4c4c4] max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#c4c4c4]">
          <h3 className="text-[15px] font-bold text-black">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5d5d5d] hover:text-black text-[13px]"
          >
            × 닫기
          </button>
        </div>

        <div className="p-4 border-b border-[#c4c4c4] flex flex-col gap-2">
          {description && (
            <p className="text-[12px] text-[#5d5d5d] leading-relaxed">{description}</p>
          )}
          <div className="flex items-center gap-2 text-[12px] text-[#5d5d5d]">
            <span>
              선택 <strong className="text-black">{draft.length}</strong> / {uniqueIds.size}개
            </span>
            <button
              type="button"
              onClick={() => setDraft([...uniqueIds])}
              className="ml-auto underline hover:text-black"
            >
              모두
            </button>
            <button
              type="button"
              onClick={() => setDraft([])}
              className="underline hover:text-black"
            >
              해제
            </button>
          </div>
          {searchable && (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="상품명 검색"
              className="border border-[#c4c4c4] rounded text-[13px] px-3 py-1.5 focus:border-black focus:outline-none"
            />
          )}
        </div>

        {/* 표시 순서 (드래그 / ▲▼ 로 정렬) — 묶음 구분 없이 통합 */}
        {draft.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b border-[#c4c4c4]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#5d5d5d] uppercase tracking-wider">
                표시 순서
              </span>
              <span className="text-[10px] text-[#9d9d9d]">
                드래그 또는 ▲▼ 로 순서 변경 (차트 선 색상·범례 순서)
              </span>
            </div>
            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
              {draft.map((id, i) => (
                <div
                  key={id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) reorderByDrag(dragIndex, i);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-[13px] border ${
                    dragIndex === i
                      ? "border-black bg-[#f5f5f5]"
                      : "border-transparent bg-[#fafafa]"
                  }`}
                >
                  <span className="cursor-grab text-[#9d9d9d] select-none" title="드래그로 이동">
                    ≡
                  </span>
                  <span className="text-[11px] text-[#9d9d9d] w-4 text-right">{i + 1}</span>
                  <span className="text-black truncate flex-1">{nameById.get(id) ?? id}</span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-[#5d5d5d] hover:text-black disabled:opacity-25 disabled:cursor-not-allowed px-1"
                    title="위로"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === draft.length - 1}
                    className="text-[#5d5d5d] hover:text-black disabled:opacity-25 disabled:cursor-not-allowed px-1"
                    title="아래로"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="text-[#5d5d5d] hover:text-black px-1"
                    title="제거"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-2 overflow-y-auto flex-1 min-h-0">
          {filteredOptions.length === 0 ? (
            <p className="text-center text-[12px] text-[#5d5d5d] py-8">
              검색 결과 없음
            </p>
          ) : (
            grouped.map((section, gi) => (
              <div key={section.label ?? "default"}>
                {section.label && (
                  <div
                    className={`px-2 pb-1 text-[11px] font-bold text-[#5d5d5d] uppercase tracking-wider ${
                      gi > 0 ? "pt-3 mt-1 border-t border-[#c4c4c4]" : "pt-1"
                    }`}
                  >
                    {section.label}
                  </div>
                )}
                {section.items.map((opt) => {
                  const id = optId(opt);
                  const checked = draftSet.has(id);
                  // 묶음별 row 수 우선 (대상 X 처럼 여러 묶음에 걸친 항목은 그 묶음 몫만 표시)
                  const count =
                    section.label != null && opt.rowCountByGroup?.[section.label] != null
                      ? opt.rowCountByGroup[section.label]
                      : opt.row_count;
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[#f5f5f5] rounded text-[13px]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                        className="w-4 h-4 accent-black"
                      />
                      <span className={checked ? "text-black" : "text-[#5d5d5d]"}>
                        {opt.name}
                      </span>
                      {count != null && (
                        <span className="ml-auto text-[11px] text-[#5d5d5d]">
                          {count.toLocaleString()} row
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-[#c4c4c4] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#c4c4c4] bg-white text-black text-[13px] px-4 py-2 rounded hover:border-black"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="bg-black text-white text-[13px] font-bold px-4 py-2 rounded-[2px]"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
