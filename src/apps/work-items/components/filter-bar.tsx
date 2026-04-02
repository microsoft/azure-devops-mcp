// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { memo, useCallback, useRef } from "react";
import type { ActiveFilters, FilterOptions } from "../types.ts";

export const FilterBar = memo(function FilterBar({
  filters,
  onChange,
  onClear,
  filterOptions,
  totalCount,
  filteredCount,
}: {
  filters: ActiveFilters;
  onChange: (key: keyof ActiveFilters, value: string) => void;
  onClear: () => void;
  filterOptions: FilterOptions;
  totalCount: number;
  filteredCount: number;
}) {
  const hasFilters = !!(filters.search || filters.state || filters.type || filters.assignedTo || filters.priority || filters.tag);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange("search", e.target.value.trim().toLowerCase()), 200);
    },
    [onChange]
  );

  return (
    <div className="filter-bar">
      <div className="search-wrapper">
        <svg className="search-icon" viewBox="0 0 16 16">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
        </svg>
        <input ref={searchRef} type="text" className="filter-search" placeholder="Search by title or ID…" defaultValue={filters.search} onChange={handleSearch} />
      </div>
      <select className="filter-select" value={filters.state} onChange={(e) => onChange("state", e.target.value)}>
        <option value="">All States</option>
        {filterOptions.states.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select className="filter-select" value={filters.type} onChange={(e) => onChange("type", e.target.value)}>
        <option value="">All Types</option>
        {filterOptions.types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select className="filter-select" value={filters.assignedTo} onChange={(e) => onChange("assignedTo", e.target.value)}>
        <option value="">All Assignees</option>
        {filterOptions.assignees.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select className="filter-select" value={filters.priority} onChange={(e) => onChange("priority", e.target.value)}>
        <option value="">All Priorities</option>
        {filterOptions.priorities.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select className="filter-select" value={filters.tag} onChange={(e) => onChange("tag", e.target.value)}>
        <option value="">All Tags</option>
        {filterOptions.tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {hasFilters && (
        <button className="filter-clear-btn" onClick={onClear}>
          Clear Filters
        </button>
      )}
      {hasFilters && (
        <span className="filter-active-count">
          <strong>{filteredCount}</strong> of {totalCount}
        </span>
      )}
    </div>
  );
});
