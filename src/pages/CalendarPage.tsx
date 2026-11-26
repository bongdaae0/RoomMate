import { useMemo, useState } from "react";
import type { CalendarEvent } from "../types";

interface CalendarPageProps {
  events: CalendarEvent[];
  onAddEvent: (
    newEvent: Omit<CalendarEvent, "id"> & { endDate?: string },
  ) => void;
  onToggleEvent: (id: number, toggleAllGroup?: boolean) => void;
  onDeleteEvent: (id: number, deleteAllGroup?: boolean) => void;
}

type EventCategory = CalendarEvent["category"];

interface CalendarCell {
  dateStr: string;
  day: number;
  inCurrentMonth: boolean;
}

interface RangeSegment {
  key: string;
  title: string;
  category: EventCategory;
  startCol: number;
  span: number;
  isStart: boolean;
  isEnd: boolean;
  isCompleted: boolean;
  sampleEventId: number;
}

const CATEGORY_LABEL: Partial<Record<EventCategory, string>> = {
  routine: "생활 루틴",
  schedule: "일정",
  cleaning: "청소·분리수거",
  expiry: "유통기한",
  replace: "교체일",
  bill: "공과금",
  memo: "메모",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return formatDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function isNextDay(prevDateStr: string, nextDateStr: string): boolean {
  return addDays(prevDateStr, 1) === nextDateStr;
}

function groupEvents(allEvents: CalendarEvent[]) {
  const sorted = [...allEvents].sort((a, b) => a.date.localeCompare(b.date));
  const rawGroups: {
    key: string;
    groupId?: number;
    title: string;
    category: EventCategory;
    dates: string[];
    eventIds: number[];
    completedFlags: boolean[];
  }[] = [];

  for (const ev of sorted) {
    if (ev.groupId !== undefined) {
      const found = rawGroups.find((g) => g.groupId === ev.groupId);
      if (found) {
        found.dates.push(ev.date);
        found.eventIds.push(ev.id);
        found.completedFlags.push(Boolean(ev.isCompleted));
      } else {
        rawGroups.push({
          key: `group-${ev.groupId}`,
          groupId: ev.groupId,
          title: ev.title,
          category: ev.category,
          dates: [ev.date],
          eventIds: [ev.id],
          completedFlags: [Boolean(ev.isCompleted)],
        });
      }
      continue;
    }

    const contiguous = rawGroups.find(
      (g) =>
        g.groupId === undefined &&
        !ev.relatedId &&
        g.title === ev.title &&
        g.category === ev.category &&
        isNextDay(g.dates[g.dates.length - 1], ev.date),
    );

    if (contiguous) {
      contiguous.dates.push(ev.date);
      contiguous.eventIds.push(ev.id);
      contiguous.completedFlags.push(Boolean(ev.isCompleted));
    } else {
      rawGroups.push({
        key: `single-${ev.id}`,
        title: ev.title,
        category: ev.category,
        dates: [ev.date],
        eventIds: [ev.id],
        completedFlags: [Boolean(ev.isCompleted)],
      });
    }
  }

  return rawGroups;
}

function buildWeekRangeSegments(
  weekCells: CalendarCell[],
  rawGroups: ReturnType<typeof groupEvents>,
): {
  segments: RangeSegment[];
  groupedEventIds: Set<number>;
} {
  const weekStart = weekCells[0].dateStr;
  const weekEnd = weekCells[weekCells.length - 1].dateStr;

  const groupedEventIds = new Set<number>();
  const segments: RangeSegment[] = [];

  for (const group of rawGroups) {
    if (group.dates.length < 2) continue;

    for (const id of group.eventIds) {
      groupedEventIds.add(id);
    }

    const rangeStart = group.dates[0];
    const rangeEnd = group.dates[group.dates.length - 1];

    if (rangeEnd < weekStart || rangeStart > weekEnd) continue;

    const overlapStart = rangeStart > weekStart ? rangeStart : weekStart;
    const overlapEnd = rangeEnd < weekEnd ? rangeEnd : weekEnd;

    const startCol = weekCells.findIndex((c) => c.dateStr === overlapStart);
    const endCol = weekCells.findIndex((c) => c.dateStr === overlapEnd);

    if (startCol === -1 || endCol === -1 || endCol < startCol) continue;

    segments.push({
      key: `${group.key}-${weekStart}`,
      title: group.title,
      category: group.category,
      startCol,
      span: endCol - startCol + 1,
      isStart: rangeStart >= weekStart,
      isEnd: rangeEnd <= weekEnd,
      isCompleted: group.completedFlags.every(Boolean),
      sampleEventId: group.eventIds[0],
    });
  }

  return { segments, groupedEventIds };
}

export function CalendarPage({
  events,
  onAddEvent,
  onToggleEvent,
  onDeleteEvent,
}: CalendarPageProps) {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 11월
  const [selectedDate, setSelectedDate] = useState<string>("2026-11-26");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 상단 빠른 추가 폼 상태
  const [quickDate, setQuickDate] = useState("2026-11-26");
  const [quickEndDate, setQuickEndDate] = useState("2026-11-26");
  const [quickCategory, setQuickCategory] = useState<EventCategory>("routine");
  const [quickTitle, setQuickTitle] = useState("");

  // 모달 내부 추가 폼 상태
  const [modalEndDate, setModalEndDate] = useState("2026-11-26");
  const [modalCategory, setModalCategory] = useState<EventCategory>("routine");
  const [modalTitle, setModalTitle] = useState("");

  const todayStr = useMemo(() => {
    const now = new Date();
    return formatDate(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const rawGroups = useMemo(() => groupEvents(events), [events]);

  const rangeInfoByEventId = useMemo(() => {
    const map = new Map<
      number,
      {
        startDate: string;
        endDate: string;
        count: number;
        allCompleted: boolean;
      }
    >();
    for (const g of rawGroups) {
      if (g.dates.length >= 2) {
        const info = {
          startDate: g.dates[0],
          endDate: g.dates[g.dates.length - 1],
          count: g.dates.length,
          allCompleted: g.completedFlags.every(Boolean),
        };
        for (const id of g.eventIds) {
          map.set(id, info);
        }
      }
    }
    return map;
  }, [rawGroups]);

  const handleStepMonth = (delta: number) => {
    const total = currentYear * 12 + currentMonth + delta;
    setCurrentYear(Math.floor(total / 12));
    setCurrentMonth(((total % 12) + 12) % 12);
  };

  const weeks = useMemo(() => {
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    const lastDateOfMonth = new Date(
      currentYear,
      currentMonth + 1,
      0,
    ).getDate();
    const lastDateOfPrevMonth = new Date(
      currentYear,
      currentMonth,
      0,
    ).getDate();

    const cells: CalendarCell[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = lastDateOfPrevMonth - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      cells.push({
        dateStr: formatDate(prevY, prevM, day),
        day,
        inCurrentMonth: false,
      });
    }

    for (let day = 1; day <= lastDateOfMonth; day++) {
      cells.push({
        dateStr: formatDate(currentYear, currentMonth, day),
        day,
        inCurrentMonth: true,
      });
    }

    let nextDay = 1;
    while (cells.length < 42) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      cells.push({
        dateStr: formatDate(nextY, nextM, nextDay),
        day: nextDay,
        inCurrentMonth: false,
      });
      nextDay++;
    }

    const chunkedWeeks: CalendarCell[][] = [];
    for (let w = 0; w < 6; w++) {
      chunkedWeeks.push(cells.slice(w * 7, w * 7 + 7));
    }
    return chunkedWeeks;
  }, [currentYear, currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  const handleQuickStartChange = (nextStart: string) => {
    setQuickDate(nextStart);
    setSelectedDate(nextStart);
    if (quickEndDate < nextStart) {
      setQuickEndDate(nextStart);
    }
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickDate) return;

    onAddEvent({
      date: quickDate,
      endDate: quickEndDate >= quickDate ? quickEndDate : quickDate,
      title: quickTitle.trim(),
      category: quickCategory,
      isCompleted: false,
    });

    setSelectedDate(quickDate);
    setQuickTitle("");
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setQuickDate(dateStr);
    setQuickEndDate(dateStr);
    setModalEndDate(dateStr);
    setModalTitle("");
    setIsModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    onAddEvent({
      date: selectedDate,
      endDate: modalEndDate >= selectedDate ? modalEndDate : selectedDate,
      title: modalTitle.trim(),
      category: modalCategory,
      isCompleted: false,
    });

    setModalTitle("");
  };

  const selectedDayEvents = eventsByDate.get(selectedDate) ?? [];

  return (
    <div className="space-y-4">
      {/* 달력 위 바로 추가 폼 (기간 지원) */}
      <form
        onSubmit={handleQuickSubmit}
        className="space-y-2.5 rounded-xl border border-neutral-800 bg-[#171717] p-3.5"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
          <span className="font-medium text-neutral-400">기간</span>
          <input
            type="date"
            value={quickDate}
            onChange={(e) => handleQuickStartChange(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-emerald-500"
          />
          <span>~</span>
          <input
            type="date"
            min={quickDate}
            value={quickEndDate}
            onChange={(e) => setQuickEndDate(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-emerald-500"
          />

          <div className="flex gap-1">
            {[
              { label: "당일", days: 0 },
              { label: "2일", days: 1 },
              { label: "4일", days: 3 },
              { label: "7일", days: 6 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setQuickEndDate(addDays(quickDate, preset.days))}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select
            value={quickCategory}
            onChange={(e) => setQuickCategory(e.target.value as EventCategory)}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
          >
            <option value="routine">생활 루틴</option>
            <option value="cleaning">청소·분리수거</option>
            <option value="schedule">일정</option>
          </select>

          <input
            type="text"
            placeholder="일정/루틴 입력 (예: 여행, 시험 기간)"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500 sm:col-span-2"
          />

          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
          >
            + 추가
          </button>
        </div>
      </form>

      {/* 월간 달력 */}
      <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[#171717] text-neutral-100">
        <div className="flex items-center justify-center gap-3 border-b border-neutral-800 py-4">
          <button
            type="button"
            onClick={() => handleStepMonth(-1)}
            className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            title="이전 달"
          >
            ▲
          </button>

          <h2 className="text-lg font-bold tracking-tight">
            {currentYear}. {String(currentMonth + 1).padStart(2, "0")}.
          </h2>

          <button
            type="button"
            onClick={() => handleStepMonth(1)}
            className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            title="다음 달"
          >
            ▼
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-neutral-800 text-center text-xs font-medium">
          {WEEKDAYS.map((dayName, idx) => (
            <div
              key={dayName}
              className={`py-2 ${
                idx === 0
                  ? "text-rose-400"
                  : idx === 6
                    ? "text-indigo-400"
                    : "text-neutral-300"
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        <div className="divide-y divide-neutral-800/90">
          {weeks.map((weekCells, weekIdx) => {
            const { segments, groupedEventIds } = buildWeekRangeSegments(
              weekCells,
              rawGroups,
            );

            return (
              <div key={weekIdx} className="relative">
                {/* 7일 배경 칸 */}
                <div className="grid grid-cols-7 divide-x divide-neutral-800/90">
                  {weekCells.map((cell, colIndex) => {
                    const dayEvents = (
                      eventsByDate.get(cell.dateStr) ?? []
                    ).filter((ev) => !groupedEventIds.has(ev.id));
                    const isSelected = cell.dateStr === selectedDate;
                    const isToday = cell.dateStr === todayStr;

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => handleDayClick(cell.dateStr)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            handleDayClick(cell.dateStr);
                        }}
                        className={`group flex min-h-24 cursor-pointer flex-col justify-between p-1.5 transition ${
                          isSelected
                            ? "bg-neutral-800/80"
                            : "hover:bg-neutral-800/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                                isToday
                                  ? "bg-neutral-200 text-neutral-950"
                                  : !cell.inCurrentMonth
                                    ? "text-neutral-600"
                                    : colIndex === 0
                                      ? "text-rose-400"
                                      : colIndex === 6
                                        ? "text-indigo-400"
                                        : "text-neutral-200"
                              }`}
                            >
                              {cell.day}
                            </span>

                            <span className="text-[11px] text-neutral-500 opacity-0 transition group-hover:opacity-100">
                              + 추가
                            </span>
                          </div>

                          {/* 기간 바가 들어갈 세로 공간 확보 */}
                          {segments.length > 0 && (
                            <div
                              style={{
                                height: `${segments.length * 22}px`,
                              }}
                            />
                          )}
                        </div>

                        {/* 단일 일정 및 연동 항목 칩 */}
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              className={`truncate rounded px-1.5 py-0.5 text-[11px] ${
                                ev.isCompleted
                                  ? "bg-neutral-800 text-neutral-500 line-through"
                                  : "bg-neutral-700/90 text-neutral-100"
                              }`}
                            >
                              {ev.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="px-1 text-[10px] text-neutral-400">
                              +{dayEvents.length - 2}개 더
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 주 단위로 끊김 없이 이어지는 기간 일정 바 */}
                {segments.length > 0 && (
                  <div className="pointer-events-none absolute left-0 right-0 top-8 space-y-1">
                    {segments.map((seg, segIdx) => {
                      const leftPercent = (seg.startCol / 7) * 100;
                      const widthPercent = (seg.span / 7) * 100;
                      const startDateInSeg = weekCells[seg.startCol].dateStr;

                      return (
                        <div
                          key={seg.key}
                          style={{
                            left: `calc(${leftPercent}% + ${seg.isStart ? "4px" : "0px"})`,
                            width: `calc(${widthPercent}% - ${
                              (seg.isStart ? 4 : 0) + (seg.isEnd ? 4 : 0)
                            }px)`,
                            top: `${segIdx * 22}px`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDayClick(startDateInSeg);
                          }}
                          title={seg.title}
                          className={`pointer-events-auto absolute flex h-4.5 cursor-pointer items-center truncate px-2 text-[11px] font-medium transition ${
                            seg.isCompleted
                              ? "bg-neutral-800/90 text-neutral-500 line-through"
                              : "bg-emerald-500/25 text-emerald-200 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/35"
                          } ${
                            seg.isStart && seg.isEnd
                              ? "rounded-md"
                              : seg.isStart
                                ? "rounded-l-md rounded-r-none"
                                : seg.isEnd
                                  ? "rounded-r-md rounded-l-none"
                                  : "rounded-none"
                          }`}
                        >
                          <span className="truncate">{seg.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 우측 하단 플로팅 + 버튼 */}
        <button
          type="button"
          onClick={() => {
            setModalEndDate(selectedDate);
            setIsModalOpen(true);
          }}
          aria-label="일정 추가"
          className="fixed bottom-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800 text-2xl text-neutral-100 shadow-lg ring-1 ring-neutral-700 transition hover:bg-neutral-700"
        >
          +
        </button>

        {/* 날짜 클릭 시 열리는 일정 추가·관리 모달 */}
        {isModalOpen && (
          <div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="w-full max-w-md space-y-4 rounded-xl border border-neutral-700 bg-[#1f1f1f] p-5 text-neutral-100 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <div className="text-xs text-neutral-400">시작 날짜</div>
                  <h3 className="text-base font-bold">{selectedDate}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                >
                  닫기 ✕
                </button>
              </div>

              <form onSubmit={handleModalSubmit} className="space-y-2.5">
                {/* 종료일 & 빠른 기간 버튼 */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-neutral-400">종료일</span>
                  <input
                    type="date"
                    min={selectedDate}
                    value={modalEndDate}
                    onChange={(e) => setModalEndDate(e.target.value)}
                    className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-100 outline-none focus:border-neutral-500"
                  />
                  {[
                    { label: "당일", days: 0 },
                    { label: "2일", days: 1 },
                    { label: "4일", days: 3 },
                    { label: "7일", days: 6 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setModalEndDate(addDays(selectedDate, preset.days))
                      }
                      className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <select
                    value={modalCategory}
                    onChange={(e) =>
                      setModalCategory(e.target.value as EventCategory)
                    }
                    className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-100 outline-none focus:border-neutral-500"
                  >
                    <option value="routine">생활 루틴</option>
                    <option value="cleaning">청소·분리수거</option>
                    <option value="schedule">일정</option>
                  </select>

                  <input
                    type="text"
                    autoFocus
                    placeholder="일정이나 루틴 입력 (예: 본가 방문)"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
                >
                  {modalEndDate > selectedDate
                    ? `${selectedDate} ~ ${modalEndDate} 일정 추가`
                    : `${selectedDate}에 일정 추가`}
                </button>
              </form>

              <div className="max-h-64 space-y-2 overflow-y-auto pt-1">
                {selectedDayEvents.length === 0 ? (
                  <p className="py-4 text-center text-xs text-neutral-400">
                    등록된 일정이 없습니다. 위에서 바로 추가해 보세요.
                  </p>
                ) : (
                  selectedDayEvents.map((ev) => {
                    const rangeInfo = rangeInfoByEventId.get(ev.id);

                    return (
                      <div
                        key={ev.id}
                        className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/90 px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(ev.isCompleted)}
                              onChange={() => onToggleEvent(ev.id, false)}
                              className="h-4 w-4 shrink-0 accent-emerald-500"
                            />
                            <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
                              {CATEGORY_LABEL[ev.category] ?? ev.category}
                            </span>
                            <div className="min-w-0">
                              <div
                                className={`truncate text-sm ${
                                  ev.isCompleted
                                    ? "text-neutral-500 line-through"
                                    : ""
                                }`}
                              >
                                {ev.title}
                              </div>
                              {rangeInfo && (
                                <div className="text-[10px] text-emerald-400/90">
                                  기간: {rangeInfo.startDate} ~{" "}
                                  {rangeInfo.endDate} ({rangeInfo.count}일)
                                </div>
                              )}
                            </div>
                          </label>

                          {!rangeInfo && (
                            <button
                              type="button"
                              onClick={() => onDeleteEvent(ev.id, false)}
                              className="shrink-0 rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-950/50"
                            >
                              삭제
                            </button>
                          )}
                        </div>

                        {rangeInfo && (
                          <div className="flex flex-wrap justify-end gap-1.5 border-t border-neutral-800/80 pt-2">
                            <button
                              type="button"
                              onClick={() => onToggleEvent(ev.id, true)}
                              className="rounded bg-emerald-950/70 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/70"
                            >
                              {rangeInfo.allCompleted
                                ? "전체 완료 해제"
                                : "전체 완료"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEvent(ev.id, false)}
                              className="rounded px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
                            >
                              이날만 삭제
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEvent(ev.id, true)}
                              className="rounded bg-rose-950/60 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-900/70"
                            >
                              전체 삭제
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
