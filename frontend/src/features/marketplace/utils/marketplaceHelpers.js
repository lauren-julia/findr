import { apiUrl } from "../../../shared/utils/api";
import { imagePath } from "../../../shared/utils/imagePath";
import { formatRelativeTime } from "../../lost-found/utils/lostFoundHelpers";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_RAW_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 1600;

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">
      <rect width="400" height="260" fill="#eef1eb"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="16">No photo provided</text>
    </svg>`
  );

export function resolveMarketImage(imageUrl) {
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

export function formatPrice(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH")}`;
}

export function formatCampusName(code, name) {
  if (code === "TC") return "Talamban";
  if (code === "DC") return "Downtown";
  return name || code;
}

export function mapMarketItem(row) {
  return {
    id: row.m_item_id,
    user_id: row.seller_id,
    name: row.item_name,
    category: row.category_name,
    categoryId: row.category_id,
    campus: formatCampusName(row.campus_code, row.campus_name),
    campusName: row.campus_name,
    condition: row.condition,
    price: Number(row.price),
    description: row.description,
    status: row.status,
    pendingRequestCount: Number(row.pending_request_count || 0),
    image: resolveMarketImage(row.image_url),
    posted: `Posted ${formatRelativeTime(row.created_at)}`
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be read. Please choose another JPG or PNG."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function prepareListingPhoto(file) {
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("Please choose a JPG or PNG image.");
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new Error("That image is too large. Please choose one under 15 MB.");
  }
  if (file.size <= MAX_IMAGE_BYTES) return file;

  const image = await loadImage(file);
  let scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.85, 0.72, 0.6]) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
      }
    }
    scale *= 0.75;
  }

  throw new Error("We couldn't shrink this image below 2 MB. Please choose a smaller photo.");
}
