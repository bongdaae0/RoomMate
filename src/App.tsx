import { useEffect, useRef, useState } from "react";
import type { ManageItem, UtilityBill, CalendarEvent } from "./types";
import { DashboardPage } from "./pages/DashboardPage";
import { ItemsPage } from "./pages/ItemsPage";
import { BillsPage } from "./pages/BillsPage";
import { CalendarPage } from "./pages/CalendarPage";

type TabKey = "dashboard" | "items" | "bills" | "calendar";

interface BackupPayload {
  app: "room-manager";
  version: 1;
  exportedAt: string;
  items: ManageItem[];
  bills: UtilityBill[];
  events: CalendarEvent[];
}

const STORAGE_KEYS = {
  items: "room_manager_items_v1",
  bills: "room_manager_bills_v1",
  events: "room_manager_events_v1",
} as const;

const INITIAL_ITEMS: ManageItem[] = [
  {
    id: 1,
    name: "칫솔 (미세모)",
    category: "consumable",
    quantity: 2,
    expiryDate: "2026-12-01",
    memo: "한 달 주기 교체",
  },
  {
    id: 2,
    name: "서울우유 1L",
    category: "food",
    quantity: 1,
    expiryDate: "2026-11-29",
    storage: "refrigerated",
  },
  {
    id: 3,
    name: "타이레놀",
    category: "medicine",
    quantity: 10,
    expiryDate: "2027-05-10",
  },
];

const INITIAL_BILLS: UtilityBill[] = [
  {
    id: 1,
    month: "2026-11",
    dueDate: "2026-11-25",
    title: "관리비",
    amount: 84000,
    splitCount: 2,
    isPaid: false,
  },
];

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 1,
    date: "2026-11-26",
    title: "분리수거 하는 날",
    category: "routine",
    isCompleted: false,
  },
];

function formatTodayStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + daysToAdd);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function findContiguousGroupIds(
  events: CalendarEvent[],
  target: CalendarEvent,
): Set<number> {
  if (target.groupId !== undefined) {
    return new Set(
      events.filter((ev) => ev.groupId === target.groupId).map((ev) => ev.id),
    );
  }

  const sameSeries = events
    .filter(
      (ev) =>
        ev.groupId === undefined &&
        !ev.relatedId &&
        ev.title === target.title &&
        ev.category === target.category,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const targetIdx = sameSeries.findIndex((ev) => ev.id === target.id);
  const ids = new Set<number>([target.id]);
  if (targetIdx === -1) return ids;

  for (let i = targetIdx - 1; i >= 0; i--) {
    if (addDaysToDateStr(sameSeries[i].date, 1) === sameSeries[i + 1].date) {
      ids.add(sameSeries[i].id);
    } else {
      break;
    }
  }
  for (let i = targetIdx + 1; i < sameSeries.length; i++) {
    if (addDaysToDateStr(sameSeries[i - 1].date, 1) === sameSeries[i].date) {
      ids.add(sameSeries[i].id);
    } else {
      break;
    }
  }

  return ids;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<ManageItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.items, INITIAL_ITEMS),
  );
  const [bills, setBills] = useState<UtilityBill[]>(() =>
    loadFromStorage(STORAGE_KEYS.bills, INITIAL_BILLS),
  );
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    loadFromStorage(STORAGE_KEYS.events, INITIAL_EVENTS),
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
    } catch {
      // 스토리지 용량 초과 등 예외 무시
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.bills, JSON.stringify(bills));
    } catch {
      // 스토리지 용량 초과 등 예외 무시
    }
  }, [bills]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
    } catch {
      // 스토리지 용량 초과 등 예외 무시
    }
  }, [events]);

  const showNotice = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleExportBackup = () => {
    const payload: BackupPayload = {
      app: "room-manager",
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
      bills,
      events,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `room-manager-backup-${formatTodayStr()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showNotice("백업 JSON 파일을 다운로드했어요.");
  };

  const handleRestoreFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupPayload>;

      if (
        !Array.isArray(parsed.items) ||
        !Array.isArray(parsed.bills) ||
        !Array.isArray(parsed.events)
      ) {
        showNotice("올바른 자취 룸 매니저 백업 파일이 아니에요.");
        return;
      }

      const confirmed = window.confirm(
        `현재 데이터를 백업 파일 내용으로 덮어쓸까요?\n(재고 ${parsed.items.length}개, 공과금 ${parsed.bills.length}건, 일정 ${parsed.events.length}개)`,
      );
      if (!confirmed) return;

      setItems(parsed.items);
      setBills(parsed.bills);
      setEvents(parsed.events);
      showNotice("백업 데이터를 복원했어요.");
    } catch {
      showNotice("JSON 파일을 읽는 중 오류가 발생했어요.");
    }
  };

  const handleResetSampleData = () => {
    const confirmed = window.confirm(
      "모든 데이터를 초기 샘플 상태로 되돌릴까요? 직접 추가한 내역은 지워집니다.",
    );
    if (!confirmed) return;

    setItems(INITIAL_ITEMS);
    setBills(INITIAL_BILLS);
    setEvents(INITIAL_EVENTS);
    showNotice("초기 샘플 데이터로 되돌렸어요.");
  };

  const handleAddItem = (newItem: Omit<ManageItem, "id">) => {
    const newId = Date.now();
    setItems((prev) => [...prev, { ...newItem, id: newId }]);

    if (newItem.expiryDate) {
      const isConsumable = newItem.category === "consumable";
      setEvents((prev) => [
        ...prev,
        {
          id: newId + 1,
          date: newItem.expiryDate,
          title: isConsumable
            ? `교체 예정: ${newItem.name}`
            : `유통기한: ${newItem.name}`,
          category: isConsumable ? "replace" : "expiry",
          isCompleted: false,
          relatedId: newId,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (id: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item,
      ),
    );
  };

  const handleDeleteItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setEvents((prev) =>
      prev.filter(
        (ev) =>
          ev.relatedId !== id ||
          (ev.category !== "expiry" && ev.category !== "replace"),
      ),
    );
  };

  const handleAddBill = (newBill: Omit<UtilityBill, "id">) => {
    const newId = Date.now();
    const resolvedDueDate =
      newBill.dueDate || (newBill.month ? `${newBill.month}-25` : "");
    setBills((prev) => [
      ...prev,
      { ...newBill, dueDate: resolvedDueDate || undefined, id: newId },
    ]);

    if (resolvedDueDate) {
      setEvents((prev) => [
        ...prev,
        {
          id: newId + 1,
          date: resolvedDueDate,
          title: `공과금: ${newBill.title} (${newBill.amount.toLocaleString()}원)`,
          category: "bill",
          isCompleted: newBill.isPaid,
          relatedId: newId,
        },
      ]);
    }
  };

  const handleTogglePaid = (id: number) => {
    setBills((prev) =>
      prev.map((bill) =>
        bill.id === id ? { ...bill, isPaid: !bill.isPaid } : bill,
      ),
    );
    setEvents((prev) =>
      prev.map((ev) =>
        ev.relatedId === id && ev.category === "bill"
          ? { ...ev, isCompleted: !ev.isCompleted }
          : ev,
      ),
    );
  };

  const handleDeleteBill = (id: number) => {
    setBills((prev) => prev.filter((bill) => bill.id !== id));
    setEvents((prev) =>
      prev.filter((ev) => !(ev.relatedId === id && ev.category === "bill")),
    );
  };

  const handleAddEvent = (
    newEvent: Omit<CalendarEvent, "id"> & { endDate?: string },
  ) => {
    const startStr = newEvent.date;
    const endStr =
      newEvent.endDate && newEvent.endDate >= startStr
        ? newEvent.endDate
        : startStr;

    const dates: string[] = [];
    let current = startStr;
    let guard = 0;

    while (current <= endStr && guard < 366) {
      dates.push(current);
      current = addDaysToDateStr(current, 1);
      guard++;
    }

    const baseEvent: Omit<CalendarEvent, "id"> = {
      date: newEvent.date,
      title: newEvent.title,
      category: newEvent.category,
      isCompleted: newEvent.isCompleted,
      relatedId: newEvent.relatedId,
    };
    const baseId = Date.now();
    const isRange = dates.length > 1;

    setEvents((prev) => [
      ...prev,
      ...dates.map((date, idx) => ({
        ...baseEvent,
        date,
        id: baseId + idx,
        ...(isRange ? { groupId: baseId } : {}),
      })),
    ]);
  };

  const handleToggleEvent = (id: number, toggleAllGroup = false) => {
    setEvents((prev) => {
      const target = prev.find((ev) => ev.id === id);
      if (!target) return prev;

      if (!toggleAllGroup) {
        return prev.map((ev) =>
          ev.id === id ? { ...ev, isCompleted: !ev.isCompleted } : ev,
        );
      }

      const groupIds = findContiguousGroupIds(prev, target);
      const allCompleted = prev
        .filter((ev) => groupIds.has(ev.id))
        .every((ev) => Boolean(ev.isCompleted));
      const nextCompleted = !allCompleted;

      return prev.map((ev) =>
        groupIds.has(ev.id) ? { ...ev, isCompleted: nextCompleted } : ev,
      );
    });
  };

  const handleDeleteEvent = (id: number, deleteAllGroup = false) => {
    setEvents((prev) => {
      const target = prev.find((ev) => ev.id === id);
      if (!target || !deleteAllGroup) {
        return prev.filter((ev) => ev.id !== id);
      }

      const idsToDelete = findContiguousGroupIds(prev, target);
      return prev.filter((ev) => !idsToDelete.has(ev.id));
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">🏠 RoomMate</h1>
            <p className="mt-1 text-sm text-slate-400">
              재고 · 유통기한 · 공과금 N빵 · 자취 루틴을 한곳에서 관리하세요.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleExportBackup}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500 hover:text-emerald-300"
            >
              백업 저장
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
            >
              백업 불러오기
            </button>

            <button
              type="button"
              onClick={handleResetSampleData}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-rose-500/60 hover:text-rose-300"
            >
              초기화
            </button>
          </div>
        </header>

        {statusMessage && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300">
            {statusMessage}
          </div>
        )}

        <nav className="mb-6 grid grid-cols-4 gap-2 rounded-xl bg-slate-900 p-1.5">
          {[
            { key: "dashboard", label: "대시보드" },
            { key: "items", label: "재고/유통기한" },
            { key: "bills", label: "공과금 정산" },
            { key: "calendar", label: "달력/루틴" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`rounded-lg py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "dashboard" && (
          <DashboardPage items={items} bills={bills} events={events} />
        )}
        {activeTab === "items" && (
          <ItemsPage
            items={items}
            onAddItem={handleAddItem}
            onUpdateQuantity={handleUpdateQuantity}
            onDeleteItem={handleDeleteItem}
          />
        )}
        {activeTab === "bills" && (
          <BillsPage
            bills={bills}
            onAddBill={handleAddBill}
            onTogglePaid={handleTogglePaid}
            onDeleteBill={handleDeleteBill}
          />
        )}
        {activeTab === "calendar" && (
          <CalendarPage
            events={events}
            onAddEvent={handleAddEvent}
            onToggleEvent={handleToggleEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </div>
    </div>
  );
}

export default App;
