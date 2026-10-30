import { useEffect } from "react";

/**
 * Client-side pagination shared by the roster, past sessions and the
 * admin tables. Shows at most `pageSize` rows at a time.
 */
export default function TablePagination({
  total,
  page,
  pageSize = 15,
  onPageChange,
  label = "rows",
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* Keep the page number valid when the data set shrinks. */
  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  /* Window of at most 5 page numbers around the current page. */
  let start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav className="pager" aria-label={`${label} pagination`}>
      <p className="pager__summary">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of{" "}
        <strong>{total}</strong> {label}
      </p>

      <div className="pager__controls">
        <button
          type="button"
          className="pager__btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Previous</span>
        </button>

        <ul className="pager__pages">
          {start > 1 && (
            <>
              <li>
                <button
                  type="button"
                  className="pager__num"
                  onClick={() => onPageChange(1)}
                >
                  1
                </button>
              </li>
              {start > 2 && <li className="pager__gap">…</li>}
            </>
          )}

          {pages.map((p) => (
            <li key={p}>
              <button
                type="button"
                className={`pager__num${p === page ? " is-active" : ""}`}
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            </li>
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && <li className="pager__gap">…</li>}
              <li>
                <button
                  type="button"
                  className="pager__num"
                  onClick={() => onPageChange(totalPages)}
                >
                  {totalPages}
                </button>
              </li>
            </>
          )}
        </ul>

        <button
          type="button"
          className="pager__btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <span>Next</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
