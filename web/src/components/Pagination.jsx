export default function Pagination({ pagination, itemLabel, onPageChange }) {
  if (!pagination) return null;

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  return (
    <nav className="pagination" aria-label={`${itemLabel} pages`}>
      <span>{pagination.total} {itemLabel} · Page {currentPage} of {totalPages}</span>
      <div>
        <button
          type="button"
          className="secondary-action"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
