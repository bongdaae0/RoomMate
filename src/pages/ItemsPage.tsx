import { useEffect, useMemo, useRef, useState } from "react";
import Tesseract from "tesseract.js";
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

async function detectExpiryDateFromImage(
  imageDataUrl: string,
): Promise<string | null> {
  try {
    const processedUrl = await preprocessImageForOcr(imageDataUrl);
    const { data } = await Tesseract.recognize(processedUrl, "kor+eng");
    console.log("[RoomMate OCR 인식 텍스트]", data.text);
    return extractDateFromText(data.text);
  } catch {
    return null;
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
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [isScanningDate, setIsScanningDate] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<"all" | ItemCategory>(
    "all",
  );
  const [previewPhoto, setPreviewPhoto] = useState<{
    title: string;
    url: string;
  } | null>(null);

  const [webcamOpen, setWebcamOpen] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
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

  const applyPhotoAndDetectDate = async (dataUrl: string) => {
    setPhotoUrl(dataUrl);
    setOcrMessage(null);
    setIsScanningDate(true);
    const detectedDate = await detectExpiryDateFromImage(dataUrl);
    if (detectedDate) {
      setExpiryDate(detectedDate);
      setOcrMessage(`인식된 날짜(${detectedDate})로 자동 입력했어요.`);
    } else {
      setOcrMessage(
        "날짜를 자동으로 읽지 못했어요. 직접 선택하거나 다시 찍어주세요.",
      );
    }
    setIsScanningDate(false);
  };

  const handleCaptureWebcam = async () => {
    if (!videoRef.current) return;
    const dataUrl = captureVideoFrame(videoRef.current);
    if (!dataUrl) return;
    setWebcamOpen(false);
    await applyPhotoAndDetectDate(dataUrl);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const compressed = await readCompressedImage(file);
      await applyPhotoAndDetectDate(compressed);
    } catch {
      // 이미지 처리 실패 시 무시
    }
  };

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
      ...(photoUrl ? { photoUrl } : {}),
    });

    setName("");
    setQuantity(1);
    setMemo("");
    setPhotoUrl(undefined);
    setOcrMessage(null);
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
            className="min-w-36 flex-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
          />

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
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
            onClick={() => photoInputRef.current?.click()}
            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
          >
            🖼️ 사진 선택
          </button>
        </div>

        {photoUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-2">
            <img
              src={photoUrl}
              alt="선택한 품목 미리보기"
              className="h-12 w-12 rounded object-cover"
            />
            <span className="text-xs text-emerald-300">
              {isScanningDate
                ? "사진에서 유통기한 날짜 읽는 중..."
                : ocrMessage ||
                  "사진이 첨부되었어요. 날짜를 확인 후 + 추가를 눌러주세요."}
            </span>
            <button
              type="button"
              onClick={() => {
                setPhotoUrl(undefined);
                setOcrMessage(null);
              }}
              className="ml-auto rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-950/50"
            >
              사진 제거
            </button>
          </div>
        )}
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
              <div className="flex items-center gap-3">
                {item.photoUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewPhoto({ title: item.name, url: item.photoUrl! })
                    }
                    className="shrink-0 overflow-hidden rounded-lg border border-slate-700 hover:border-emerald-500"
                    title="사진 크게 보기"
                  >
                    <img
                      src={item.photoUrl}
                      alt={item.name}
                      className="h-14 w-14 object-cover"
                    />
                  </button>
                )}

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

      {/* 사진 확대 모달 */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{previewPhoto.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                닫기 ✕
              </button>
            </div>
            <img
              src={previewPhoto.url}
              alt={previewPhoto.title}
              className="max-h-[70vh] w-full rounded-lg bg-slate-950 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
