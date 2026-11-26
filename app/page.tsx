"use client";

import React, { useState, useEffect } from "react";

interface FoodItem {
  id: number;
  name: string;
  expiryDate: string;
}

interface BillItem {
  id: number;
  title: string;
  amount: number;
}

export default function HomePage() {
  // 1. 식재료 유통기한 상태
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [foodName, setFoodName] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");

  // 2. 공과금 N빵 정산 상태
  const [bills, setBills] = useState<BillItem[]>([]);
  const [billTitle, setBillTitle] = useState<string>("");
  const [billAmount, setBillAmount] = useState<string>("");
  const [peopleCount, setPeopleCount] = useState<number>(2);

  // 초기 데이터 로드 (localStorage)
  useEffect(() => {
    const savedFoods = localStorage.getItem("room_manager_foods");
    if (savedFoods) {
      setFoods(JSON.parse(savedFoods));
    } else {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 5);
      setFoods([
        {
          id: 1,
          name: "우유 1L",
          expiryDate: nextWeek.toISOString().split("T")[0],
        },
      ]);
    }

    const savedBills = localStorage.getItem("room_manager_bills");
    if (savedBills) {
      setBills(JSON.parse(savedBills));
    } else {
      setBills([
        { id: 1, title: "전기요금", amount: 34000 },
        { id: 2, title: "도시가스", amount: 22000 },
      ]);
    }
  }, []);

  // 데이터 자동 저장
  useEffect(() => {
    if (foods.length > 0) {
      localStorage.setItem("room_manager_foods", JSON.stringify(foods));
    }
  }, [foods]);

  useEffect(() => {
    if (bills.length > 0) {
      localStorage.setItem("room_manager_bills", JSON.stringify(bills));
    }
  }, [bills]);

  // 식재료 추가/삭제
  const handleAddFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim() || !expiryDate) return;
    setFoods([...foods, { id: Date.now(), name: foodName.trim(), expiryDate }]);
    setFoodName("");
    setExpiryDate("");
  };

  const handleDeleteFood = (id: number) => {
    const updated = foods.filter((f) => f.id !== id);
    setFoods(updated);
    localStorage.setItem("room_manager_foods", JSON.stringify(updated));
  };

  // D-Day 계산
  const getDday = (dateStr: string) => {
    const target = new Date(dateStr);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // 공과금 추가/삭제
  const handleAddBill = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(billAmount);
    if (!billTitle.trim() || numericAmount <= 0) return;
    setBills([
      ...bills,
      { id: Date.now(), title: billTitle.trim(), amount: numericAmount },
    ]);
    setBillTitle("");
    setBillAmount("");
  };

  const handleDeleteBill = (id: number) => {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);
    localStorage.setItem("room_manager_bills", JSON.stringify(updated));
  };

  const totalBill = bills.reduce((sum, item) => sum + item.amount, 0);
  const perPerson = peopleCount > 0 ? Math.ceil(totalBill / peopleCount) : 0;

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="text-center space-y-2">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
            Next.js + TypeScript 1인 가구 생활 관리 MVP
          </span>
          <h1 className="text-3xl font-bold text-slate-900">
            🏠 자취방 통합 매니저
          </h1>
          <p className="text-slate-600 text-sm">
            냉장고 식재료 유통기한 알림과 월별 공과금 정산을 한눈에 관리합니다.
          </p>
        </header>

        {/* 섹션 1: 식재료 유통기한 트래커 */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
          <h2 className="text-xl font-bold text-slate-800">
            🥬 냉장고 식재료 유통기한 관리
          </h2>
          <form onSubmit={handleAddFood} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="식재료명 (예: 계란 1판)"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer"
            >
              식재료 등록
            </button>
          </form>

          <ul className="divide-y divide-slate-100">
            {foods.map((item) => {
              const dDay = getDday(item.expiryDate);
              return (
                <li key={item.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">기한: {item.expiryDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full ${
                        dDay <= 3
                          ? "bg-red-100 text-red-600"
                          : "bg-indigo-50 text-indigo-700"
                      }`}
                    >
                      {dDay < 0 ? `D+${Math.abs(dDay)}` : dDay === 0 ? "D-Day" : `D-${dDay}`}
                    </span>
                    <button
                      onClick={() => handleDeleteFood(item.id)}
                      className="text-xs text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 섹션 2: 공과금 정산 계산기 */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">
              🧾 월별 공과금 · 관리비 정산
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-slate-600 font-medium">정산 인원:</label>
              <input
                type="number"
                min={1}
                value={peopleCount}
                onChange={(e) => setPeopleCount(Number(e.target.value))}
                className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-semibold"
              />
              <span className="text-slate-600">명</span>
            </div>
          </div>

          <form onSubmit={handleAddBill} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="항목 (예: 수도세)"
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="금액 (원)"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition cursor-pointer"
            >
              항목 추가
            </button>
          </form>

          <ul className="divide-y divide-slate-100">
            {bills.map((bill) => (
              <li key={bill.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{bill.title}</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900">
                    {bill.amount.toLocaleString()}원
                  </span>
                  <button
                    onClick={() => handleDeleteBill(bill.id)}
                    className="text-xs text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="p-4 bg-indigo-50 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs text-indigo-700 font-medium">
                총 합계: {totalBill.toLocaleString()}원
              </p>
              <p className="text-lg font-extrabold text-indigo-900">
                1인당 부담액: {perPerson.toLocaleString()}원
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}