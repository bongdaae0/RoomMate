// 1. 공통 유니온 타입
export type StorageLocation = "refrigerated" | "frozen" | "room_temp";
export type ItemCategory = "consumable" | "medicine" | "supplement" | "food";
export type EventCategory =
  | "bill"
  | "replace"
  | "expiry"
  | "memo"
  | "routine"
  | "cleaning"
  | "schedule";

// 2. 통합 재고/관리 아이템 (생필품, 상비약, 영양제, 냉장고 식재료)
export interface ManageItem {
  id: number;
  name: string; // 품목명
  category: ItemCategory; // 카테고리
  quantity: number; // 남은 수량
  expiryDate: string; // 유통기한 또는 다음 교체 예정일 ('YYYY-MM-DD')
  storage?: StorageLocation; // 보관 구역 (식재료일 때만 선택적으로 사용)
  memo?: string; // 메모 (선택)
  purchaseUrl?: string; // 최저가 구매 링크 (선택)
}

// 3. 월별 공과금 및 N빵 정산 항목
export interface UtilityBill {
  id: number;
  month: string; // 청구 월 ('YYYY-MM')
  dueDate?: string; // 납부 예정일 ('YYYY-MM-DD', 선택)
  title: string; // 항목명
  amount: number; // 총 금액 (원)
  splitCount: number; // N빵 인원수
  isPaid: boolean; // 납부 완료 여부
}

// 4. 캘린더 일정 및 자취 루틴
export interface CalendarEvent {
  id: number;
  date: string; // 날짜 ('YYYY-MM-DD')
  title: string; // 일정 제목
  category: EventCategory; // 일정 카테고리
  isCompleted?: boolean; // 완료 여부
  relatedId?: number; // 관련 아이템/공과금 ID (선택)
  groupId?: number; // 기간 일정 묶음 ID (선택)
}
