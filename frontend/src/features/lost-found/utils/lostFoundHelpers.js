import { apiUrl } from "../../../shared/utils/api";
import { imagePath } from "../../../shared/utils/imagePath";

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">
      <rect width="400" height="260" fill="#eef1eb"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="16">No photo provided</text>
    </svg>`
  );

export function resolveLfImage(imageUrl) {
  if (!imageUrl) return FALLBACK_IMAGE;
  if (
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("data:")
  ) {
    return imageUrl;
  }
  if (imageUrl.startsWith("/api/")) return apiUrl(imageUrl);
  if (imageUrl.startsWith("/images/") || imageUrl.startsWith("images/")) {
    return `${import.meta.env.BASE_URL}${imageUrl.replace(/^\//, "")}`;
  }
  if (!imageUrl.startsWith("/")) return imagePath(imageUrl);
  return imageUrl;
}

export function formatEventDate(dateStr) {
  if (!dateStr) return "—";
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
