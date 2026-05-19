"use client";

import { useEffect, useMemo, useState } from "react";

export interface ProductOption {
  name: string;
  row_count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** 전체 옵션 (해당 브랜드의 모든 품목구분) */
  options: ProductOption[];
  /** 현재 선택된 상품명 리스트 */
  selected: string[];
  onApply: (next: string[]) => void;
  /** 검색 가능 여부 (옵션 많을 때) */
  searchable?: boolean;
}

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
  const [draft, setDraft] = useState<Set<string>>(new Set(selected));
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(new Set(selected));
      setQuery("");
    }
  }, [open, selected]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  if (!open) return null;

  const toggle = (name: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleApply = () => {
    // 원본 옵션 순서 유지하면서 선택된 것만 추출
    const ordered = options.filter((o) => draft.has(o.name)).map((o) => o.name);
    onApply(ordered);
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
              선택 <strong className="text-black">{draft.size}</strong> / {options.length}개
            </span>
            <button
              type="button"
              onClick={() => setDraft(new Set(options.map((o) => o.name)))}
              className="ml-auto underline hover:text-black"
            >
              모두
            </button>
            <button
              type="button"
              onClick={() => setDraft(new Set())}
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

        <div className="p-2 overflow-y-auto flex-1 min-h-0">
          {filteredOptions.length === 0 ? (
            <p className="text-center text-[12px] text-[#5d5d5d] py-8">
              검색 결과 없음
            </p>
          ) : (
            filteredOptions.map((opt) => (
              <label
                key={opt.name}
                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[#f5f5f5] rounded text-[13px]"
              >
                <input
                  type="checkbox"
                  checked={draft.has(opt.name)}
                  onChange={() => toggle(opt.name)}
                  className="w-4 h-4 accent-black"
                />
                <span className={draft.has(opt.name) ? "text-black" : "text-[#5d5d5d]"}>
                  {opt.name}
                </span>
                <span className="ml-auto text-[11px] text-[#5d5d5d]">
                  {opt.row_count.toLocaleString()} row
                </span>
              </label>
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
