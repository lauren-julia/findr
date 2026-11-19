import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages < 1) return null;

  return (
    <div className="feed-pagination" aria-label="Pagination">
      <button
        type="button"
        className="feed-page-arrow"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        aria-label="Previous page"
      >
        <ChevronLeft size={18} />
      </button>

      <span className="feed-page-info">
        Page {currentPage} of {totalPages}
      </span>

      <button
        type="button"
        className="feed-page-arrow"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        aria-label="Next page"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
