import { memo } from "react";

interface StatusScreenProps {
  status: "loading" | "error" | "empty";
}

const LOADING_ICON = (
  <div className="loading-container">
    <div className="spinner" />
    <span>Loading work items…</span>
  </div>
);

const ERROR_ICON = (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const EMPTY_ICON = (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
  </svg>
);

export const StatusScreen = memo(function StatusScreen({ status }: StatusScreenProps) {
  if (status === "loading") {
    return <div className="content">{LOADING_ICON}</div>;
  }

  if (status === "error") {
    return (
      <div className="content">
        <div className="empty-state">
          {ERROR_ICON}
          <div className="empty-state-title">Something went wrong</div>
          <div className="empty-state-detail">Unable to load work items. Please try again.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="empty-state">
        {EMPTY_ICON}
        <div className="empty-state-title">No work items found</div>
        <div className="empty-state-detail">No items match your current filters or iteration. Try adjusting your search criteria.</div>
      </div>
    </div>
  );
});
