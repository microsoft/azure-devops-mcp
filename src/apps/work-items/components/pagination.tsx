import { memo } from "react";

export const Pagination = memo(function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push(-1);
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push(-1);
    pages.push(totalPages);
  }

  return (
    <div className="pagination">
      <button className="page-nav" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="10 3 5 8 10 13" />
        </svg>
      </button>
      {pages.map((p, i) =>
        p === -1 ? (
          <span key={`dots-${i}`} style={{ padding: "4px 6px", fontSize: 12 }}>
            …
          </span>
        ) : (
          <button key={p} className={`page-btn ${p === currentPage ? "active" : ""}`} onClick={() => onPageChange(p)}>
            {p}
          </button>
        )
      )}
      <button className="page-nav" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 3 11 8 6 13" />
        </svg>
      </button>
    </div>
  );
});
