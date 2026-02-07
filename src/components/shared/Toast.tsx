import { useToastStore } from "../../store/toast-store.ts";

const colorMap = {
  success: "bg-emerald-600",
  error: "bg-red-600",
  warning: "bg-amber-600",
} as const;

export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-in rounded px-4 py-2 text-xs text-white shadow-lg ${colorMap[t.type]} cursor-pointer`}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
