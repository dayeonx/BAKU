export type SignupMethod = "in_app_auto" | "manual" | "none";
export type DateMode = "single" | "range";
export type TimeMode = "none" | "start_only" | "range";
export type LocationMode = "single" | "double";

export type EventCategoryMeta = {
  value: string;
  label: string;
  color: string;
  signup: SignupMethod;
  dateMode: DateMode;
  timeMode: TimeMode;
  location: LocationMode;
  needsItems: boolean;
  itemsLabel: string;
  needsPrice: boolean;
  needsGoogleForm: boolean;
  googleFormLabel: string;
  needsHostName: boolean;
  hostLabel: string;
  needsStudioConfirm: boolean;
};

export const EVENT_CATEGORIES: EventCategoryMeta[] = [
  {
    value: "regular",
    label: "정기주최",
    color: "#A8632F",
    signup: "in_app_auto",
    dateMode: "single",
    timeMode: "range",
    location: "single",
    needsItems: true,
    itemsLabel: "베이킹 품목",
    needsPrice: true,
    needsGoogleForm: false,
    googleFormLabel: "",
    needsHostName: true,
    hostLabel: "주최자",
    needsStudioConfirm: true,
  },
  {
    value: "free",
    label: "자유주최",
    color: "#E0791F",
    signup: "in_app_auto",
    dateMode: "single",
    timeMode: "range",
    location: "single",
    needsItems: true,
    itemsLabel: "베이킹 품목",
    needsPrice: true,
    needsGoogleForm: false,
    googleFormLabel: "",
    needsHostName: true,
    hostLabel: "주최자",
    needsStudioConfirm: true,
  },
  {
    value: "monthly_special",
    label: "월별 스페셜 베이킹",
    color: "#C2410C",
    signup: "in_app_auto",
    dateMode: "single",
    timeMode: "range",
    location: "single",
    needsItems: true,
    itemsLabel: "베이킹 품목",
    needsPrice: true,
    needsGoogleForm: false,
    googleFormLabel: "",
    needsHostName: true,
    hostLabel: "주최자",
    needsStudioConfirm: true,
  },
  {
    value: "welcome",
    label: "신환회",
    color: "#B45309",
    signup: "manual",
    dateMode: "single",
    timeMode: "start_only",
    location: "single",
    needsItems: false,
    itemsLabel: "",
    needsPrice: false,
    needsGoogleForm: true,
    googleFormLabel: "구글폼으로 신청하기",
    needsHostName: false,
    hostLabel: "주최자",
    needsStudioConfirm: false,
  },
  {
    value: "mt",
    label: "엠티",
    color: "#0EA5E9",
    signup: "manual",
    dateMode: "range",
    timeMode: "none",
    location: "single",
    needsItems: false,
    itemsLabel: "",
    needsPrice: false,
    needsGoogleForm: true,
    googleFormLabel: "구글폼으로 신청하기",
    needsHostName: false,
    hostLabel: "주최자",
    needsStudioConfirm: false,
  },
  {
    value: "bread_tour",
    label: "빵지순례",
    color: "#65A30D",
    signup: "manual",
    dateMode: "range",
    timeMode: "none",
    location: "single",
    needsItems: false,
    itemsLabel: "",
    needsPrice: false,
    needsGoogleForm: true,
    googleFormLabel: "구글폼으로 신청하기",
    needsHostName: false,
    hostLabel: "주최자",
    needsStudioConfirm: false,
  },
  {
    value: "snack",
    label: "간식행사",
    color: "#DB2777",
    signup: "none",
    dateMode: "range",
    timeMode: "range",
    location: "double",
    needsItems: true,
    itemsLabel: "간식 품목",
    needsPrice: false,
    needsGoogleForm: false,
    googleFormLabel: "",
    needsHostName: false,
    hostLabel: "주최자",
    needsStudioConfirm: false,
  },
  {
    value: "pub",
    label: "주점",
    color: "#475569",
    signup: "manual",
    dateMode: "single",
    timeMode: "range",
    location: "single",
    needsItems: false,
    itemsLabel: "",
    needsPrice: false,
    needsGoogleForm: true,
    googleFormLabel: "구글폼으로 예약하기",
    needsHostName: true,
    hostLabel: "주준위",
    needsStudioConfirm: false,
  },
];

export function categoryMeta(value: string): EventCategoryMeta {
  return EVENT_CATEGORIES.find((c) => c.value === value) ?? EVENT_CATEGORIES[1];
}

export function categoryLabel(value: string): string {
  return categoryMeta(value).label;
}

export function categoryColor(value: string): string {
  return categoryMeta(value).color;
}
