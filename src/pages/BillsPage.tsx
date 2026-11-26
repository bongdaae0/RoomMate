import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import type { UtilityBill } from "../types";

interface BillsPageProps {
  bills: UtilityBill[];
  onAddBill: (newBill: Omit<UtilityBill, "id">) => void;
  onTogglePaid: (id: number) => void;
  onDeleteBill: (id: number) => void;
}

interface DetectedBillInfo {
  date: string | null;
  amount: string | null;
}

function getDefaultDueDate(monthStr: string): string {
  if (!monthStr) return "2026-11-25";
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return `${monthStr}-25`;
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(25, lastDay);
  return `${monthStr}-${String(day).padStart(2, "0")}`;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

function extractDateFromText(rawText: string): string | null {
  const normalized = rawText
    .replace(/[O오o]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/[：:]/g, ".")
    .replace(/\s+/g, " ");

  const candidates: string[] = [];

  const fullRegex =
    /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g;
  for (const match of normalized.matchAll(fullRegex)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (isValidDateParts(year, month, day)) {
      candidates.push(
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      );
    }
  }

  if (candidates.length > 0) {
    return candidates[candidates.length - 1];
  }

  const shortRegex = /(\d{1,2})\s*[./월]\s*(\d{1,2})\s*일?/g;
  for (const match of normalized.matchAll(shortRegex)) {
    const year = new Date().getFullYear();
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (isValidDateParts(year, month, day)) {
      candidates.push(
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      );
    }
  }

  if (candidates.length > 0) {
    return candidates[candidates.length - 1];
  }

  return null;
}

function parseAmountNumber(raw: string): number | null {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  const num = Number(digitsOnly);
  if (!Number.isFinite(num) || num < 100 || num > 100_000_000) return null;
  return num;
}

function extractAmountFromText(rawText: string): string | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[O오o]/g, "0")
        .replace(/[lI|]/g, "1")
        .trim(),
    )
    .filter(Boolean);

  // 1) 청구서 핵심 금액 키워드(당월금액, 합계금액, 청구금액, 납부금액, 총액, 금액) 우선 탐색
  const priorityKeywords = [
    "당월금액",
    "합계금액",
    "청구금액",
    "납부금액",
    "총금액",
    "총액",
    "금액",
  ];

  for (const keyword of priorityKeywords) {
    for (const line of lines) {
      if (!line.includes(keyword)) continue;
      const commaMatches = [...line.matchAll(/\d{1,3}(?:,\d{3})+/g)];
      if (commaMatches.length > 0) {
        const lastMatch = commaMatches[commaMatches.length - 1][0];
        const parsed = parseAmountNumber(lastMatch);
        if (parsed !== null) return String(parsed);
      }

      const plainMatches = [...line.matchAll(/\d{3,8}/g)];
      if (plainMatches.length > 0) {
        const lastMatch = plainMatches[plainMatches.length - 1][0];
        const parsed = parseAmountNumber(lastMatch);
        if (parsed !== null) return String(parsed);
      }
    }
  }

  // 2) "원" 앞에 붙은 쉼표 포함 금액(예: 93,300 원) 탐색
  const wonMatches = [...rawText.matchAll(/(\d{1,3}(?:,\d{3})+)\s*원/g)];
  if (wonMatches.length > 0) {
    const parsed = parseAmountNumber(wonMatches[wonMatches.length - 1][1]);
    if (parsed !== null) return String(parsed);
  }

  // 3) 전체 텍스트에서 쉼표가 들어간 가장 큰 금액 후보 선택
  const allCommaMatches = [...rawText.matchAll(/\b\d{1,3}(?:,\d{3})+\b/g)];
  let bestAmount: number | null = null;
  for (const m of allCommaMatches) {
    const parsed = parseAmountNumber(m[0]);
    if (parsed !== null && (bestAmount === null || parsed > bestAmount)) {
      bestAmount = parsed;
    }
  }

  return bestAmount !== null ? String(bestAmount) : null;
}

function preprocessImageForOcr(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }

      ctx.filter = "grayscale(100%) contrast(155%) brightness(105%)";
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

async function detectBillInfoFromImage(
  imageDataUrl: string,
): Promise<DetectedBillInfo> {
  try {
    const processedUrl = await preprocessImageForOcr(imageDataUrl);
    const { data } = await Tesseract.recognize(processedUrl, "kor+eng");
    console.log("[RoomMate 영수증 OCR 인식 텍스트]", data.text);
    return {
      date: extractDateFromText(data.text),
      amount: extractAmountFromText(data.text),
    };
  } catch {
    return { date: null, amount: null };
  }
}

function readCompressedImage(file: File, maxSize = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

function captureVideoFrame(
  video: HTMLVideoElement,
  maxSize = 1280,
): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(
    1,
    maxSize / Math.max(video.videoWidth, video.videoHeight),
  );
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
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
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  const [isScanningDate, setIsScanningDate] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<{
    title: string;
    url: string;
  } | null>(null);

  const [webcamOpen, setWebcamOpen] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!webcamOpen) {
      stopWebcam();
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      setWebcamError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setWebcamError("이 브라우저에서는 웹캠 스트림을 지원하지 않아요.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setWebcamError(
          "웹캠 권한이 거부되었거나 연결된 카메라를 찾을 수 없어요.",
        );
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopWebcam();
    };
  }, [webcamOpen]);

  const applyReceiptAndDetectInfo = async (dataUrl: string) => {
    setReceiptUrl(dataUrl);
    setOcrMessage(null);
    setIsScanningDate(true);

    const { date: detectedDate, amount: detectedAmount } =
      await detectBillInfoFromImage(dataUrl);

    const appliedNotes: string[] = [];

    if (detectedDate) {
      setDueDate(detectedDate);
      setMonth(detectedDate.slice(0, 7));
      appliedNotes.push(`납부일 ${detectedDate}`);
    }

    if (detectedAmount) {
      setAmount(detectedAmount);
      appliedNotes.push(`금액 ${Number(detectedAmount).toLocaleString()}원`);
    }

    if (appliedNotes.length > 0) {
      setOcrMessage(`${appliedNotes.join(" · ")} 자동 입력했어요.`);
    } else {
      setOcrMessage("날짜나 금액을 자동으로 읽지 못했어요. 직접 입력해주세요.");
    }

    setIsScanningDate(false);
  };

  const handleCaptureWebcam = async () => {
    if (!videoRef.current) return;
    const dataUrl = captureVideoFrame(videoRef.current);
    if (!dataUrl) return;
    setWebcamOpen(false);
    await applyReceiptAndDetectInfo(dataUrl);
  };

  const handleMonthChange = (nextMonth: string) => {
    setMonth(nextMonth);
    setDueDate(getDefaultDueDate(nextMonth));
  };

  const handleReceiptChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const compressed = await readCompressedImage(file);
      await applyReceiptAndDetectInfo(compressed);
    } catch {
      // 이미지 처리 실패 시 무시
    }
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
      ...(receiptUrl ? { receiptUrl } : {}),
    });

    setTitle("");
    setAmount("");
    setReceiptUrl(undefined);
    setOcrMessage(null);
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

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <input
            ref={receiptInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleReceiptChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setWebcamOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
          >
            🎥 웹캠 촬영
          </button>

          <button
            type="button"
            onClick={() => receiptInputRef.current?.click()}
            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
          >
            🖼️ 사진 선택
          </button>
          <span>선택 사항 · 정산 증빙용</span>
        </div>

        {receiptUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-2">
            <img
              src={receiptUrl}
              alt="선택한 고지서·영수증 미리보기"
              className="h-12 w-12 rounded object-cover"
            />
            <span className="text-xs text-emerald-300">
              {isScanningDate
                ? "영수증/고지서에서 날짜·금액 읽는 중..."
                : ocrMessage || "고지서/영수증 사진이 첨부되었어요."}
            </span>
            <button
              type="button"
              onClick={() => {
                setReceiptUrl(undefined);
                setOcrMessage(null);
              }}
              className="ml-auto rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-950/50"
            >
              사진 제거
            </button>
          </div>
        )}
      </form>

      {/* 공과금 목록 */}
      <div className="space-y-3">
        {bills.map((bill) => {
          const perPerson = Math.round(bill.amount / bill.splitCount);
          const billReceiptUrl = bill.receiptUrl;
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
                <div className="flex items-center gap-3">
                  {billReceiptUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewReceipt({
                          title: `[${bill.month}] ${bill.title}`,
                          url: billReceiptUrl,
                        })
                      }
                      className="shrink-0 overflow-hidden rounded-lg border border-slate-700 hover:border-emerald-500"
                      title="영수증 크게 보기"
                    >
                      <img
                        src={billReceiptUrl}
                        alt={`${bill.title} 영수증`}
                        className="h-14 w-14 object-cover"
                      />
                    </button>
                  )}

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
                      총액 {bill.amount.toLocaleString()}원 · {bill.splitCount}
                      명 N빵 →{" "}
                      <span className="font-semibold text-emerald-400">
                        1인당 {perPerson.toLocaleString()}원
                      </span>
                    </div>
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

      {/* 웹캠 캡처 모달 */}
      {webcamOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setWebcamOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">🎥 웹캠 촬영</h3>
              <button
                type="button"
                onClick={() => setWebcamOpen(false)}
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                닫기 ✕
              </button>
            </div>

            {webcamError ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {webcamError}
              </p>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-video w-full rounded-lg bg-slate-950 object-cover"
              />
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWebcamOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCaptureWebcam}
                disabled={Boolean(webcamError)}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
              >
                📸 사진 찍기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 영수증 확대 모달 */}
      {previewReceipt && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPreviewReceipt(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{previewReceipt.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                닫기 ✕
              </button>
            </div>
            <img
              src={previewReceipt.url}
              alt={previewReceipt.title}
              className="max-h-[70vh] w-full rounded-lg bg-slate-950 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
