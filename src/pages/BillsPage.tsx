import { useState } from "react";
import type { UtilityBill } from "../types";

interface BillsPageProps {
  bills: UtilityBill[];
  onAddBill: (newBill: Omit<UtilityBill, "id">) => void;
  onTogglePaid: (id: number) => void;
  onDeleteBill: (id: number) => void;
}

function getDefaultDueDate(monthStr: string): string {
  if (!monthStr) return "2026-11-25";
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return `${monthStr}-25`;
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(25, lastDay);
  return `${monthStr}-${String(day).padStart(2, "0")}`;
}

export function BillsPage({
  bills,
  onAddBill,
  onTogglePaid,
  onDeleteBill,
}: BillsPageProps) {
  const [month, setMonth] = useState("2026-11");
  const [dueDate, setDueDate] = useState("2026-11-25");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [splitCount, setSplitCount] = useState(2);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleMonthChange = (nextMonth: string) => {
    setMonth(nextMonth);
    setDueDate(getDefaultDueDate(nextMonth));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || !parsedAmount || parsedAmount <= 0) return;

    onAddBill({
      month,
      dueDate: dueDate || getDefaultDueDate(month),
      title: title.trim(),
      amount: parsedAmount,
      splitCount: Math.max(1, Number(splitCount) || 1),
      isPaid: false,
    });

    setTitle("");
    setAmount("");
  };

  const handleCopyKakaoText = async (bill: UtilityBill) => {
    const perPerson = Math.round(bill.amount / bill.splitCount);
    const dueLine = bill.dueDate ? `\n- 납부일: ${bill.dueDate}` : "";
    const text = `[${bill.month} ${bill.title} 정산]${dueLine}\n- 총 금액: ${bill.amount.toLocaleString()}원\n- 인원: ${bill.splitCount}명\n- 1인당 보낼 금액: ${perPerson.toLocaleString()}원`;

    await navigator.clipboard.writeText(text);
    setCopiedId(bill.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* 공과금 추가 폼 */}
      <form
        onSubmit={handleSubmit}
        className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900 p-4"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span>청구 월</span>
            <input
              type="month"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span>납부 예정일 (달력 연동)</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            type="text"
            placeholder="항목 (예: 전기세, 가스비)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />

          <input
            type="number"
            min={0}
            placeholder="총 금액 (원)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
            <input
              type="number"
              min={1}
              max={20}
              value={splitCount}
              onChange={(e) => setSplitCount(Number(e.target.value))}
              className="w-full bg-transparent text-slate-100 outline-none"
            />
            <span className="shrink-0 text-xs text-slate-400">명 N빵</span>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            + 추가
          </button>
        </div>
      </form>

      {/* 공과금 목록 */}
      <div className="space-y-3">
        {bills.map((bill) => {
          const perPerson = Math.round(bill.amount / bill.splitCount);
          return (
            <div
              key={bill.id}
              className={`rounded-xl border p-4 transition ${
                bill.isPaid
                  ? "border-slate-800/60 bg-slate-900/50 opacity-70"
                  : "border-slate-800 bg-slate-900"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      [{bill.month}] {bill.title}
                    </span>
                    {bill.dueDate && (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                        납부일 {bill.dueDate}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        bill.isPaid
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {bill.isPaid ? "정산 완료" : "미정산"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    총액 {bill.amount.toLocaleString()}원 · {bill.splitCount}명
                    N빵 →{" "}
                    <span className="font-semibold text-emerald-400">
                      1인당 {perPerson.toLocaleString()}원
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyKakaoText(bill)}
                    className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300"
                  >
                    {copiedId === bill.id ? "복사됨!" : "카톡 복사"}
                  </button>

                  <button
                    type="button"
                    onClick={() => onTogglePaid(bill.id)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    {bill.isPaid ? "미정산으로" : "정산 완료"}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteBill(bill.id)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
