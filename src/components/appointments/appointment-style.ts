/** Colour per appointment type, shared by the time grid and month view. */
export const TYPE_STYLE: Record<string, { card: string; dot: string; pill: string }> = {
  CONSULTATION: { card: "bg-violet-50 border-violet-200 hover:border-violet-300", dot: "bg-violet-500", pill: "bg-violet-50 text-violet-900" },
  CHECKUP: { card: "bg-emerald-50 border-emerald-200 hover:border-emerald-300", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-900" },
  CLEANING: { card: "bg-sky-50 border-sky-200 hover:border-sky-300", dot: "bg-sky-500", pill: "bg-sky-50 text-sky-900" },
  FILLING: { card: "bg-blue-50 border-blue-200 hover:border-blue-300", dot: "bg-blue-500", pill: "bg-blue-50 text-blue-900" },
  ROOT_CANAL: { card: "bg-rose-50 border-rose-200 hover:border-rose-300", dot: "bg-rose-500", pill: "bg-rose-50 text-rose-900" },
  EXTRACTION: { card: "bg-red-50 border-red-200 hover:border-red-300", dot: "bg-red-500", pill: "bg-red-50 text-red-900" },
  ORTHODONTIC: { card: "bg-indigo-50 border-indigo-200 hover:border-indigo-300", dot: "bg-indigo-500", pill: "bg-indigo-50 text-indigo-900" },
  SURGERY: { card: "bg-orange-50 border-orange-200 hover:border-orange-300", dot: "bg-orange-500", pill: "bg-orange-50 text-orange-900" },
  FOLLOW_UP: { card: "bg-teal-50 border-teal-200 hover:border-teal-300", dot: "bg-teal-500", pill: "bg-teal-50 text-teal-900" },
  OTHER: { card: "bg-slate-50 border-slate-200 hover:border-slate-300", dot: "bg-slate-500", pill: "bg-slate-50 text-slate-900" },
};

export const typeStyle = (type: string) => TYPE_STYLE[type] ?? TYPE_STYLE.OTHER;

/** Cancelled and no-show visits stay visible but recede. */
export const isInactiveStatus = (status: string) => status === "CANCELLED" || status === "NO_SHOW";
