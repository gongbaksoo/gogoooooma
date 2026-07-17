"use client";

// 종합 코멘트용 경량 리치 텍스트 에디터 (contentEditable + execCommand, 무의존).
//   - 기능(핵심 세트): 굵게/기울임/밑줄/취소선, 글자색·형광펜, 글머리·번호 목록, 정렬(좌·중·우), 글자 크기
//   - 저장값은 HTML 문자열. 보기 모드 렌더는 sanitizeNoteHtml로 안전화(자체 localStorage 콘텐츠지만 방어).
//   - 붙여넣기는 평문으로 강제 → 외부 서식·이미지·스크립트 혼입 차단.
//   - 색상/크기는 input·select로 포커스가 이동하므로 선택영역(Range)을 저장·복원해 적용.
//   - 색상 피커는 브라우저 기본 UI라 그 안에 저장 기능을 못 넣음 → 툴바에 자체 스와치 줄(고정 ★ / 최근)을 둠.
import { useEffect, useRef, useState } from "react";
import {
  ColorSwatches,
  DEFAULT_COLOR_SWATCHES,
  SwatchKind,
  loadColorSwatches,
  pinColor,
  pushRecent,
  saveColorSwatches,
  unpinColor,
} from "./colorSwatchStorage";

const COLOR_META: Record<SwatchKind, { cmd: string; label: string; initial: string }> = {
  fore: { cmd: "foreColor", label: "글자색", initial: "#000000" },
  hilite: { cmd: "hiliteColor", label: "형광", initial: "#ffff00" },
};

const FONT_SIZES: { label: string; value: string }[] = [
  { label: "작게", value: "2" },
  { label: "보통", value: "3" },
  { label: "크게", value: "5" },
  { label: "더 크게", value: "6" },
];

// HTML 태그가 없으면 레거시 평문 → 줄바꿈 보존하며 이스케이프(과거 textarea 저장분 호환)
export function legacyTextToHtml(value: string): string {
  if (!value) return "";
  if (/<[a-z!/][\s\S]*>/i.test(value)) return value; // 이미 HTML
  const esc = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\n/g, "<br>");
}

// 저장/표시 전 위험 요소 제거
export function sanitizeNoteHtml(html: string): string {
  return html
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|form)[^>]*>/gi, "")
    .replace(/ on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "");
}

// contentEditable HTML 렌더용 공통 클래스 — Tailwind preflight가 지운 목록 스타일 복구
export const NOTE_HTML_CLASS =
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:my-1 [&_ol]:my-1";

function applyCmd(cmd: string, value?: string) {
  try {
    document.execCommand("styleWithCSS", false, "true");
  } catch {
    /* noop */
  }
  document.execCommand(cmd, false, value);
}

export function RichTextEditor({
  valueHtml,
  resetKey,
  onChange,
}: {
  valueHtml: string;
  resetKey: string; // `${month}|${part}` — 바뀌면 내용 리셋
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [colors, setColors] = useState<Record<SwatchKind, string>>({
    fore: COLOR_META.fore.initial,
    hilite: COLOR_META.hilite.initial,
  });
  // 스와치는 SSR에서 localStorage를 못 읽으므로 마운트 후 복원 (다른 섹션 저장소와 동일 패턴)
  const [swatches, setSwatches] = useState<ColorSwatches>(DEFAULT_COLOR_SWATCHES);
  // 피커에서 실제로 색을 바꿨을 때만 blur 시점에 '최근'으로 기록하기 위한 표시
  const pickerDirty = useRef<Record<SwatchKind, boolean>>({ fore: false, hilite: false });

  useEffect(() => {
    setSwatches(loadColorSwatches());
  }, []);

  // resetKey(월·파트) 변경 시 에디터 내용을 해당 조합 저장값으로 시드
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = legacyTextToHtml(valueHtml || "");
    // valueHtml은 resetKey와 함께 부모에서 갱신되므로 resetKey만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  // 토글 버튼: onMouseDown preventDefault로 에디터 포커스·선택 유지 → 바로 적용
  const runToggle = (cmd: string) => {
    applyCmd(cmd);
    emit();
  };

  // 색/크기: input·select로 포커스가 옮겨가므로 선택영역 복원 후 적용
  const runWithRestore = (cmd: string, value: string) => {
    restoreSelection();
    applyCmd(cmd, value);
    emit();
  };

  // 색 적용. 피커 드래그 중엔 change가 연속 발생하므로 '최근'에는 쌓지 않고(recordRecent=false),
  // 피커를 닫아 blur될 때·스와치를 눌렀을 때만 최종값 1건을 기록한다.
  const applyColor = (kind: SwatchKind, color: string, recordRecent: boolean) => {
    setColors((prev) => ({ ...prev, [kind]: color }));
    runWithRestore(COLOR_META[kind].cmd, color);
    if (recordRecent) setSwatches((prev) => saveColorSwatches(pushRecent(prev, kind, color)));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const Btn = ({ cmd, label, title }: { cmd: string; label: string; title: string }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.preventDefault();
        runToggle(cmd);
      }}
      className="min-w-[26px] h-[24px] px-1 border border-[#d5d5d5] rounded text-[12px] leading-none bg-white hover:border-black"
    >
      {label}
    </button>
  );

  const Sep = () => <span className="w-px h-4 bg-[#dddddd] mx-0.5" aria-hidden />;

  // 색 피커 (label로 감싼 input[type=color]) — 드래그 중 실시간 적용, 닫힐 때 '최근'에 1건 기록
  const colorPicker = (kind: SwatchKind, faceLabel: string) => (
    <label
      title={COLOR_META[kind].label}
      className="flex items-center gap-0.5 h-[24px] px-1 border border-[#d5d5d5] rounded bg-white cursor-pointer hover:border-black"
      onMouseDown={saveSelection}
    >
      <span className="text-[12px] leading-none">{faceLabel}</span>
      <input
        type="color"
        value={colors[kind]}
        onChange={(e) => {
          pickerDirty.current[kind] = true;
          applyColor(kind, e.target.value, false);
        }}
        onBlur={() => {
          if (!pickerDirty.current[kind]) return;
          pickerDirty.current[kind] = false;
          setSwatches((prev) => saveColorSwatches(pushRecent(prev, kind, colors[kind])));
        }}
        className="w-[16px] h-[16px] p-0 border-0 bg-transparent cursor-pointer"
      />
    </label>
  );

  // 저장 색 스와치 줄: ★(고정) + 최근. 컴포넌트가 아니라 함수 호출로 렌더 → 리렌더 시 input 상태 유지.
  const swatchDot = (kind: SwatchKind, color: string, title: string, onAlt: () => void) => (
    <button
      key={`${kind}-${color}`}
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()} // 에디터 선택영역 유지
      onClick={() => applyColor(kind, color, true)}
      onContextMenu={(e) => {
        e.preventDefault();
        onAlt();
      }}
      style={{ backgroundColor: color }}
      className="w-[16px] h-[16px] rounded-sm border border-[#c4c4c4] hover:border-black"
    />
  );

  const swatchStrip = (kind: SwatchKind) => {
    const { pinned, recent } = swatches[kind];
    const name = COLOR_META[kind].label;
    return (
      <div className="flex items-center gap-1">
        <span className="text-[11px] leading-none text-[#666666]">{name}</span>
        <button
          type="button"
          title={`현재 ${name}(${colors[kind]})을 고정색으로 저장`}
          aria-label={`현재 ${name} 고정색으로 저장`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setSwatches((prev) => saveColorSwatches(pinColor(prev, kind, colors[kind])))}
          className="flex items-center h-[18px] px-1 border border-[#d5d5d5] rounded text-[11px] leading-none bg-white hover:border-black"
        >
          ★+
        </button>
        {pinned.map((c) =>
          swatchDot(kind, c, `${name} ${c} 적용 (우클릭: 고정 해제)`, () =>
            setSwatches((prev) => saveColorSwatches(unpinColor(prev, kind, c)))
          )
        )}
        {recent.length > 0 && (
          <>
            <Sep />
            <span className="text-[11px] leading-none text-[#999999]">최근</span>
            {recent.map((c) =>
              swatchDot(kind, c, `${name} ${c} 적용 (우클릭: 고정)`, () =>
                setSwatches((prev) => saveColorSwatches(pinColor(prev, kind, c)))
              )
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="border border-[#c4c4c4] rounded">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-1 px-1.5 py-1 border-b border-[#e5e5e5] bg-[#fafafa]">
        <Btn cmd="bold" label="B" title="굵게" />
        <Btn cmd="italic" label="I" title="기울임" />
        <Btn cmd="underline" label="U" title="밑줄" />
        <Btn cmd="strikeThrough" label="S" title="취소선" />
        <Sep />
        {colorPicker("fore", "가")}
        {colorPicker("hilite", "형광")}
        <Sep />
        <Btn cmd="insertUnorderedList" label="• 목록" title="글머리 목록" />
        <Btn cmd="insertOrderedList" label="1. 목록" title="번호 목록" />
        <Sep />
        <Btn cmd="justifyLeft" label="좌" title="왼쪽 정렬" />
        <Btn cmd="justifyCenter" label="중" title="가운데 정렬" />
        <Btn cmd="justifyRight" label="우" title="오른쪽 정렬" />
        <Sep />
        <select
          title="글자 크기"
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => {
            const v = e.target.value;
            e.currentTarget.selectedIndex = 0;
            if (v) runWithRestore("fontSize", v);
          }}
          className="h-[24px] border border-[#d5d5d5] rounded text-[12px] bg-white px-1 hover:border-black focus:outline-none"
        >
          <option value="">크기</option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* 저장한 색: 클릭하면 적용, 우클릭으로 고정/해제 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5 py-1 border-b border-[#e5e5e5] bg-[#fcfcfc]">
        {swatchStrip("fore")}
        {swatchStrip("hilite")}
      </div>

      {/* 편집 영역 */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-ph="종합 코멘트를 입력하세요 (대상 월·파트별 저장)"
        onInput={emit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        onPaste={handlePaste}
        className={`min-h-[180px] max-h-[420px] overflow-y-auto px-2.5 py-2 text-[13px] leading-relaxed focus:outline-none empty:before:content-[attr(data-ph)] empty:before:text-[#aaaaaa] ${NOTE_HTML_CLASS}`}
      />
    </div>
  );
}
