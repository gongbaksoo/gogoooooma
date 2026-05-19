"use client";

import { useEffect, useState } from "react";
import { GroupDef, createEmptyGroup } from "./channelIssueStorage";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 해당 파트의 P열 채널구분 unique values (옵션 풀) */
  availableChannels: string[];
  /** 현재 그룹 정의 */
  groups: GroupDef[];
  onApply: (next: GroupDef[]) => void;
}

export default function GroupConfigModal({
  open,
  onClose,
  title,
  availableChannels,
  groups,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<GroupDef[]>(groups);

  useEffect(() => {
    if (open) {
      setDraft(JSON.parse(JSON.stringify(groups)));
    }
  }, [open, groups]);

  if (!open) return null;

  const renameGroup = (id: string, name: string) => {
    setDraft((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
  };

  const toggleChannel = (groupId: string, channel: string) => {
    setDraft((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const has = g.channels.includes(channel);
        return {
          ...g,
          channels: has ? g.channels.filter((c) => c !== channel) : [...g.channels, channel],
        };
      })
    );
  };

  const addGroup = () => {
    setDraft((prev) => [...prev, createEmptyGroup(`그룹 ${prev.length + 1}`)]);
  };

  const removeGroup = (id: string) => {
    if (draft.length <= 1) return;
    setDraft((prev) => prev.filter((g) => g.id !== id));
  };

  const moveGroup = (id: string, dir: -1 | 1) => {
    setDraft((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const out = [...prev];
      const [item] = out.splice(idx, 1);
      out.splice(next, 0, item);
      return out;
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#c4c4c4] max-w-6xl w-full max-h-[85vh] flex flex-col"
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

        <div className="p-4 border-b border-[#c4c4c4] flex items-center justify-between">
          <p className="text-[12px] text-[#5d5d5d]">
            그룹 이름·순서·소속 채널(P열 채널구분)을 편집합니다. 그룹 1개당 1 컬럼으로 표시됩니다.
          </p>
          <button
            type="button"
            onClick={addGroup}
            className="border border-[#c4c4c4] bg-white text-black text-[12px] px-3 py-1 rounded hover:border-black"
          >
            + 그룹 추가
          </button>
        </div>

        <div className="overflow-auto flex-1 min-h-0">
          {/* Header row: channel names across columns */}
          <table className="text-[12px] border-collapse" style={{ minWidth: "100%" }}>
            <thead>
              <tr className="border-b border-[#c4c4c4] bg-white">
                <th
                  className="text-left font-bold py-2 px-3 sticky left-0 bg-white z-10 border-r border-[#c4c4c4]"
                  style={{ minWidth: 160 }}
                >
                  그룹 이름
                </th>
                {availableChannels.map((c) => (
                  <th
                    key={c}
                    className="font-normal py-2 px-2 text-[11px] text-[#5d5d5d] whitespace-nowrap text-center"
                    style={{ minWidth: 80 }}
                  >
                    {c}
                  </th>
                ))}
                <th
                  className="text-right py-2 px-3 font-normal text-[#5d5d5d] text-[11px] sticky right-0 bg-white z-10 border-l border-[#c4c4c4]"
                  style={{ minWidth: 90 }}
                >
                  순서 / 삭제
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.map((g, idx) => (
                <tr key={g.id} className="border-b border-[#f0f0f0]">
                  <td className="py-2 px-3 sticky left-0 bg-white z-10 border-r border-[#c4c4c4]" style={{ minWidth: 160 }}>
                    <input
                      type="text"
                      value={g.name}
                      onChange={(e) => renameGroup(g.id, e.target.value)}
                      className="w-full border border-[#c4c4c4] rounded px-2 py-1 text-[12px] focus:border-black focus:outline-none"
                      placeholder="그룹 이름"
                    />
                  </td>
                  {availableChannels.map((c) => {
                    const checked = g.channels.includes(c);
                    return (
                      <td key={c} className="text-center py-2 px-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleChannel(g.id, c)}
                          className="w-4 h-4 accent-black"
                        />
                      </td>
                    );
                  })}
                  <td className="text-right py-2 px-3 whitespace-nowrap sticky right-0 bg-white z-10 border-l border-[#c4c4c4]">
                    <button
                      type="button"
                      onClick={() => moveGroup(g.id, -1)}
                      disabled={idx === 0}
                      className="text-[12px] px-1 text-[#5d5d5d] hover:text-black disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveGroup(g.id, 1)}
                      disabled={idx === draft.length - 1}
                      className="text-[12px] px-1 text-[#5d5d5d] hover:text-black disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGroup(g.id)}
                      disabled={draft.length <= 1}
                      className="text-[12px] px-1 text-[#5d5d5d] hover:text-[#ff0066] disabled:opacity-30"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {availableChannels.length === 0 && (
            <p className="text-center text-[12px] text-[#5d5d5d] py-8">
              파트 데이터에 P열 채널구분 값이 없습니다.
            </p>
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
