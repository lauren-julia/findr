import { useEffect } from "react";
import { CircleCheck, CircleAlert, X } from "lucide-react";
import "../styles/marketplace-pages.css";

export default function Toast({ toast, onDismiss, duration = 4500 }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, duration]);

  if (!toast) return null;

  const isError = toast.type === "error";
  const Icon = isError ? CircleAlert : CircleCheck;

  return (
    <div className={`mk-toast ${isError ? "error" : "success"}`} role={isError ? "alert" : "status"}>
      <Icon size={18} />
      <span>{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={15} />
      </button>
    </div>
  );
}
