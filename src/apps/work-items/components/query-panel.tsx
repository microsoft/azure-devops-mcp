import { memo, useState, useMemo, useCallback } from "react";
import type { ActiveFilters, QueryContext } from "../types.ts";
import { generateWiql, highlightWiql } from "../utils.ts";

export const QueryPanel = memo(function QueryPanel({ isOpen, filters, queryContext }: { isOpen: boolean; filters: ActiveFilters; queryContext?: QueryContext }) {
  const [copied, setCopied] = useState(false);
  const wiql = useMemo(() => generateWiql(filters, queryContext), [filters, queryContext]);
  const highlightedWiql = useMemo(() => highlightWiql(wiql), [wiql]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(wiql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [wiql]);

  if (!isOpen) return null;

  return (
    <div className="query-panel open">
      <div className="query-panel-inner">
        <button className={`query-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
        <pre className="query-code">
          <code dangerouslySetInnerHTML={{ __html: highlightedWiql }} />
        </pre>
      </div>
    </div>
  );
});
