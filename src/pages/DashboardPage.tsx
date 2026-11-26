import type { ManageItem, UtilityBill, CalendarEvent } from "../types";

interface DashboardPageProps {
  items: ManageItem[];
  bills: UtilityBill[];
  events: CalendarEvent[];
}

interface GroupedEvent {
  key: string;
  title: string;
  category: CalendarEvent["category"];
  startDate: string;
  endDate: string;
  isCompleted: boolean;
}

function getDaysDiff(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function isNextDay(prevDateStr: string, nextDateStr: string): boolean {
  const [py, pm, pd] = prevDateStr.split("-").map(Number);
  const prev = new Date(py, pm - 1, pd + 1);
  const yyyy = prev.getFullYear();
  const mm = String(prev.getMonth() + 1).padStart(2, "0");
  const dd = String(prev.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` === nextDateStr;
}

function groupCalendarEvents(events: CalendarEvent[]): GroupedEvent[] {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const result: GroupedEvent[] = [];
  const groupIndexMap = new Map<number, number>();

  for (const ev of sorted) {
    if (ev.groupId !== undefined) {
      const existingIdx = groupIndexMap.get(ev.groupId);
      if (existingIdx !== undefined) {
        const target = result[existingIdx];
        if (ev.date < target.startDate) target.startDate = ev.date;
        if (ev.date > target.endDate) target.endDate = ev.date;
        target.isCompleted = target.isCompleted && Boolean(ev.isCompleted);
        continue;
      }
      groupIndexMap.set(ev.groupId, result.length);
      result.push({
        key: `group-${ev.groupId}`,
        title: ev.title,
        category: ev.category,
        startDate: ev.date,
        endDate: ev.date,
        isCompleted: Boolean(ev.isCompleted),
      });
      continue;
    }

    const contiguousTarget = result.find(
      (item) =>
        item.title === ev.title &&
        item.category === ev.category &&
        !ev.relatedId &&
        isNextDay(item.endDate, ev.date),
    );

    if (contiguousTarget) {
      contiguousTarget.endDate = ev.date;
      contiguousTarget.isCompleted =
        contiguousTarget.isCompleted && Boolean(ev.isCompleted);
    } else {
      result.push({
        key: `single-${ev.id}`,
        title: ev.title,
        category: ev.category,
        startDate: ev.date,
        endDate: ev.date,
        isCompleted: Boolean(ev.isCompleted),
      });
    }
  }

  return result.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function DashboardPage({ items, bills, events }: DashboardPageProps) {
  const urgentItems = items
    .map((item) => ({ ...item, dDay: getDaysDiff(item.expiryDate) }))
    .filter((item) => item.dDay <= 7)
    .sort((a, b) => a.dDay - b.dDay);

  const unpaidBills = bills.filter((bill) => !bill.isPaid);
  const myTotalUnpaid = unpaidBills.reduce(
    (sum, bill) => sum + Math.round(bill.amount / bill.splitCount),
    0,
  );

  const groupedEvents = groupCalendarEvents(events);
  const remainingEvents = groupedEvents.filter((ev) => !ev.isCompleted);
  const upcomingEvents = remainingEvents.slice(0, 3);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs text-slate-400">
            임박/만료 품목 (7일 이내)
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-400">
            {urgentItems.length}개
          </div>
          <div className="mt-1 text-xs text-slate-500">
            전체 {items.length}개 관리 중
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs text-slate-400">미정산 내 부담금</div>
          <div className="mt-1 text-2xl font-bold text-amber-400">
            {myTotalUnpaid.toLocaleString()}원
          </div>
          <div className="mt-1 text-xs text-slate-500">
            미정산 {unpaidBills.length}건 / 전체 {bills.length}건
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs text-slate-400">남은 할 일 · 루틴</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">
            {remainingEvents.length}개
          </div>
          <div className="mt-1 text-xs text-slate-500">
            전체 {groupedEvents.length}개 등록됨
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-base font-semibold">
          ⚠️ 유통기한 · 교체 임박 품목
        </h2>
        {urgentItems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            7일 이내 만료되거나 교체할 품목이 없습니다. 아주 쾌적해요!
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {urgentItems.map((item) => {
              const badgeText =
                item.dDay < 0
                  ? `${Math.abs(item.dDay)}일 지남`
                  : item.dDay === 0
                    ? "오늘 만료"
                    : `D-${item.dDay}`;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3.5 py-2.5 text-sm"
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      ({item.expiryDate} · {item.quantity}개)
                    </span>
                  </div>
                  <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                    {badgeText}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-base font-semibold">💸 미정산 공과금</h2>
          {unpaidBills.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              모두 정산 완료되었습니다.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {unpaidBills.map((bill) => (
                <li
                  key={bill.id}
                  className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2"
                >
                  <span>
                    [{bill.month}] {bill.title}
                  </span>
                  <span className="font-semibold text-amber-300">
                    {Math.round(bill.amount / bill.splitCount).toLocaleString()}
                    원
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-base font-semibold">📅 다가오는 루틴 · 일정</h2>
          {upcomingEvents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">남은 일정이 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {upcomingEvents.map((ev) => (
                <li
                  key={ev.key}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/70 px-3 py-2"
                >
                  <span className="truncate">{ev.title}</span>
                  <span className="shrink-0 text-xs text-emerald-400">
                    {ev.startDate === ev.endDate
                      ? ev.startDate
                      : `${ev.startDate} ~ ${ev.endDate}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
