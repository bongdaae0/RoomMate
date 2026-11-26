import { useMemo, useState } from "react";
import type { ManageItem, ItemCategory, StorageLocation } from "../types";

interface ItemsPageProps {
  items: ManageItem[];
  onAddItem: (newItem: Omit<ManageItem, "id">) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  onDeleteItem: (id: number) => void;
}

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  consumable: "생필품",
  food: "식재료",
  medicine: "상비약",
  supplement: "영양제",
};

const STORAGE_LABEL: Record<StorageLocation, string> = {
  refrigerated: "냉장",
  frozen: "냉동",
  room_temp: "실온",
};

function addDaysFromToday(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ItemsPage({
  items,
  onAddItem,
  onUpdateQuantity,
  onDeleteItem,
}: ItemsPageProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ItemCategory>("consumable");
  const [storage, setStorage] = useState<StorageLocation>("refrigerated");
  const [quantity, setQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState("2026-12-10");
  const [memo, setMemo] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | ItemCategory>(
    "all",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddItem({
      name: name.trim(),
      category,
      quantity: Math.max(0, Number(quantity) || 1),
      expiryDate,
      ...(category === "food" ? { storage } : {}),
      ...(memo.trim() ? { memo: memo.trim() } : {}),
    });

    setName("");
    setQuantity(1);
    setMemo("");
  };

  const getLowestPriceUrl = (itemName: string, customUrl?: string) => {
    if (customUrl && customUrl.trim()) return customUrl;
    return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(itemName)}`;
  };

  const filteredItems = useMemo(() => {
    const base =
      filterCategory === "all"
        ? items
        : items.filter((item) => item.category === filterCategory);
    return [...base].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }, [items, filterCategory]);

  return (
    <div className="space-y-4">
      {/* 새 항목 추가 폼 */}
      <form
        onSubmit={handleSubmit}
        className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900 p-4"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            type="text"
            placeholder="품목명 (예: 물티슈, 우유)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 sm:col-span-2"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ItemCategory)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="consumable">생필품</option>
            <option value="food">식재료</option>
            <option value="medicine">상비약</option>
            <option value="supplement">영양제</option>
          </select>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-transparent text-slate-100 outline-none"
            />
            <span className="shrink-0 text-xs text-slate-400">개</span>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            + 추가
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>만료/교체일:</span>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 outline-none focus:border-emerald-500"
          />

          <div className="flex gap-1">
            {[
              { label: "+7일", days: 7 },
              { label: "+1개월", days: 30 },
              { label: "+3개월", days: 90 },
              { label: "+6개월", days: 180 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setExpiryDate(addDaysFromToday(preset.days))}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {category === "food" && (
            <select
              value={storage}
              onChange={(e) => setStorage(e.target.value as StorageLocation)}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
            >
              <option value="refrigerated">냉장 보관</option>
              <option value="frozen">냉동 보관</option>
              <option value="room_temp">실온 보관</option>
            </select>
          )}

          <input
            type="text"
            placeholder="메모 (선택, 예: 1달마다 교체)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="min-w-40 flex-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
          />
        </div>
      </form>

      {/* 카테고리 필터 탭 */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "consumable", "food", "medicine", "supplement"] as const).map(
          (key) => {
            const isActive = filterCategory === key;
            const count =
              key === "all"
                ? items.length
                : items.filter((item) => item.category === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterCategory(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {key === "all" ? "전체" : CATEGORY_LABEL[key]} ({count})
              </button>
            );
          },
        )}
      </div>

      {/* 아이템 목록 */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
            해당 카테고리에 등록된 품목이 없습니다.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                    {CATEGORY_LABEL[item.category]}
                  </span>
                  {item.category === "food" && item.storage && (
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                      {STORAGE_LABEL[item.storage]}
                    </span>
                  )}
                  <span className="font-semibold">{item.name}</span>
                  {item.quantity === 0 && (
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-medium text-rose-300">
                      재고 소진
                    </span>
                  )}
                </div>

                <div className="mt-1 text-sm text-slate-400">
                  만료/교체일: {item.expiryDate}
                  {item.memo && (
                    <span className="ml-2 text-xs text-slate-500">
                      · {item.memo}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 수량 즉시 조절 */}
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    disabled={item.quantity <= 0}
                    className="px-2.5 py-1.5 text-sm font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                    aria-label="수량 감소"
                  >
                    -
                  </button>
                  <span className="min-w-10 text-center text-xs font-semibold text-slate-100">
                    {item.quantity}개
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    className="px-2.5 py-1.5 text-sm font-bold text-slate-300 hover:bg-slate-700"
                    aria-label="수량 증가"
                  >
                    +
                  </button>
                </div>

                <a
                  href={getLowestPriceUrl(item.name, item.purchaseUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  최저가 찾기
                </a>

                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
