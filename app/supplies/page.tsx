"use client";

import React, { useState, useEffect } from "react";

// TypeScript 인터페이스: 생필품 데이터 구조 정의
interface SupplyItem {
  id: number;
  name: string;
  cycleDays: number; // 교체 주기 (일 단위: 예 30일, 90일)
  lastReplaced: string; // 마지막 교체일 (YYYY-MM-DD)
}

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [name, setName] = useState<string>("");
  const [cycleDays, setCycleDays] = useState<number>(30);
  const [lastReplaced, setLastReplaced] = useState<string>("");

  // 초기 기본 예시 데이터 및 localStorage 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("room_manager_supplies");
    if (saved) {
      setSupplies(JSON.parse(saved));
    } else {
      // 처음 접속 시 포트폴리오 화면이 비어 보이지 않도록 샘플 데이터 2개 제공
      const todayStr = new Date().toISOString().split("T")[0];
      setSupplies([
        { id: 1, name: "칫솔 / 면도날", cycleDays: 30, lastReplaced: todayStr },
        { id: 2, name: "샤워기 필터", cycleDays: 60, lastReplaced: todayStr },
      ]);
    }
  }, []);

  // 데이터 변경 시 자동 저장
  useEffect(() => {
    if (supplies.length > 0) {
      localStorage.setItem("room_manager_supplies", JSON.stringify(supplies));
    }
  }, [supplies]);

  // 새 생필품 등록
  const handleAddSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lastReplaced || cycleDays <= 0) return;

    const newItem: SupplyItem = {
      id: Date.now(),
      name: name.trim(),
      cycleDays,
      lastReplaced,
    };

    setSupplies([...supplies, newItem]);
    setName("");
    setCycleDays(30);
    setLastReplaced("");
  };

  // '오늘 교체 완료' 버튼 클릭 시 마지막 교체일을 오늘 날짜로 리셋
  const handleResetToday = (id: number) => {
    const todayStr = new Date().toISOString().split("T")[0];
    setSupplies(
      supplies.map((item) =>
        item.id === id ? { ...item, lastReplaced: todayStr } : item
      )
    );
  };

  // 삭제
  const handleDelete = (id: number) => {
    const updated = supplies.filter((item) => item.id !== id);
    setSupplies(updated);
    localStorage.setItem("room_manager_supplies", JSON.stringify(updated));
  };

  // 다음 교체 예정일 및 남은 일수 계산 함수
  const getNextReplaceInfo = (lastDateStr: string, cycle: number) => {
    const lastDate = new Date(lastDateStr);
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + cycle);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    nextDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const nextDateFormatted = nextDate.toISOString().split("T")[0];

    return { nextDateFormatted, diffDays };
  };

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-100 rounded-full">
            Next.js App Router 서브 페이지 (/supplies)
          </span>
          <h1 className="text-3xl font-bold text-slate-900">
            🪥 생필품 교체주기 관리
          </h1>
          <p className="text-slate-600 text-sm">
            칫솔, 필터, 수세미 등 깜빡하기 쉬운 자취 생필품 교체 시기를 자동으로 계산합니다.
          </p>
        </header>

        {/* 등록 폼 */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">새 생필품 등록</h2>
          <form
            onSubmit={handleAddSupply}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3"
          >
            <input
              type="text"
              placeholder="품목명 (예: 수세미)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:col-span-2 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="number"
              min={1}
              placeholder="주기(일)"
              value={cycleDays}
              onChange={(e) => setCycleDays(Number(e.target.value))}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="date"
              value={lastReplaced}
              onChange={(e) => setLastReplaced(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              className="sm:col-span-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition cursor-pointer"
            >
              교체 주기 등록하기
            </button>
          </form>
        </section>

        {/* 목록 카드 */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {supplies.map((item) => {
            const { nextDateFormatted, diffDays } = getNextReplaceInfo(
              item.lastReplaced,
              item.cycleDays
            );
            const isOverdue = diffDays <= 0;

            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      교체 주기: {item.cycleDays}일마다
                    </p>
                    <p className="text-xs text-slate-500">
                      다음 예정일: {nextDateFormatted}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full ${
                      isOverdue
                        ? "bg-red-100 text-red-600"
                        : "bg-teal-50 text-teal-700"
                    }`}
                  >
                    {diffDays < 0
                      ? `${Math.abs(diffDays)}일 지남`
                      : diffDays === 0
                      ? "오늘 교체!"
                      : `${diffDays}일 남음`}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleResetToday(item.id)}
                    className="flex-1 py-2 text-xs font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-lg transition cursor-pointer"
                  >
                    🔄 오늘 교체 완료
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-3 py-2 text-xs text-slate-400 hover:text-red-500 transition cursor-pointer"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}