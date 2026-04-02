// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useState, useRef, useEffect, useCallback } from "react";
import type { App } from "@modelcontextprotocol/ext-apps";

interface Identity {
  id: string;
  displayName: string;
  descriptor?: string;
}

export interface PeoplePickerProps {
  value: string;
  onChange: (value: string) => void;
  app: App | null | undefined;
  disabled?: boolean;
  /** Root element CSS class. Default: "people-picker" */
  className?: string;
  /** Prefix for internal CSS classes. Default: "pp" */
  classPrefix?: string;
  /** Additional class(es) on the <input> element. Default: "" */
  inputClassName?: string;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] ?? "?").toUpperCase();
}

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ((hash % 360) + 360) % 360;
}

function Avatar({ name, size = 28, cx }: { name: string; size?: number; cx: (n: string) => string }) {
  const initials = getInitials(name);
  const hue = nameToHue(name);
  return (
    <span className={cx("avatar")} style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: `hsl(${hue}, 55%, 45%)` }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function PeoplePicker({ value, onChange, app, disabled, className = "people-picker", classPrefix = "pp", inputClassName = "" }: PeoplePickerProps) {
  const cx = (name: string) => `${classPrefix}-${name}`;

  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Identity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<Identity | null>(value ? { id: "", displayName: value } : null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const editingRef = useRef(false);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
    setQuery(value);
    if (value) setSelected((prev) => (prev && prev.displayName === value ? prev : { id: "", displayName: value }));
    else setSelected(null);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchIdentities = useCallback(
    async (filter: string) => {
      if (!app || filter.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setIsOpen(false);
        setLoading(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        let identities: Identity[] = [];

        // Try the Identity Picker API (prefix/partial match)
        try {
          const result = await app.callServerTool({ name: "mcp_app_search_identities", arguments: { query: filter } });
          if (controller.signal.aborted) return;
          if (!result?.isError) {
            const text = result?.content?.find((c: { type: string }) => c.type === "text") as { text?: string } | undefined;
            if (text?.text && !text.text.startsWith("Error")) {
              const parsed = JSON.parse(text.text);
              if (Array.isArray(parsed)) {
                identities = parsed.filter((id: { displayName?: string }) => id.displayName).slice(0, MAX_RESULTS);
              }
            }
          }
        } catch {
          // Tool may not be available, fall through to legacy API
        }

        // Fallback: legacy General identity search
        if (identities.length === 0 && !controller.signal.aborted) {
          try {
            const result = await app.callServerTool({ name: "core_get_identity_ids", arguments: { searchFilter: filter } });
            if (controller.signal.aborted) return;
            if (!result?.isError) {
              const text = result?.content?.find((c: { type: string }) => c.type === "text") as { text?: string } | undefined;
              if (text?.text && !text.text.startsWith("No ") && !text.text.startsWith("Error")) {
                const parsed = JSON.parse(text.text);
                if (Array.isArray(parsed)) {
                  identities = parsed.filter((id: { displayName?: string }) => id.displayName).slice(0, MAX_RESULTS);
                }
              }
            }
          } catch {
            // Both APIs failed
          }
        }

        if (controller.signal.aborted) return;
        setResults(identities);
        setIsOpen(identities.length > 0);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setIsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [app]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    editingRef.current = true;
    setQuery(val);
    if (!val.trim()) {
      setSelected(null);
      setResults([]);
      setIsOpen(false);
      onChange("");
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchIdentities(val.trim()), DEBOUNCE_MS);
  };

  const handleBlur = () => {
    editingRef.current = false;
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (!selected && query.trim()) {
      onChange(query.trim());
    }
  };

  const selectIdentity = (identity: Identity) => {
    editingRef.current = false;
    justSelectedRef.current = true;
    setQuery(identity.displayName);
    setSelected(identity);
    setIsOpen(false);
    setResults([]);
    onChange(identity.displayName);
    inputRef.current?.blur();
  };

  const clearSelection = () => {
    editingRef.current = true;
    setQuery("");
    setSelected(null);
    setResults([]);
    setIsOpen(false);
    onChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) selectIdentity(results[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  useEffect(() => {
    if (activeIndex < 0) return;
    const list = containerRef.current?.querySelector(`.${cx("dropdown")}`);
    const item = list?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, cx]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    []
  );

  const highlightMatch = (text: string) => {
    const q = query.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className={cx("highlight")}>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const showSelected = selected && !isOpen && query === selected.displayName;

  useEffect(() => {
    if (!selected && editingRef.current) {
      inputRef.current?.focus();
    }
  }, [selected]);

  return (
    <div className={`${className}${isOpen ? ` ${cx("open")}` : ""}`} ref={containerRef}>
      {showSelected ? (
        <div
          className={cx("selected")}
          onClick={() => {
            if (!disabled) {
              editingRef.current = true;
              setSelected(null);
            }
          }}>
          <Avatar name={selected.displayName} size={24} cx={cx} />
          <span className={cx("selected-name")}>{selected.displayName}</span>
          {!disabled && (
            <button
              className={cx("clear")}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearSelection();
              }}
              aria-label="Clear selection">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M8 8.707l3.646 3.647.708-.708L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className={cx("input-wrap")}>
          <svg className={cx("search-icon")} viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04-1.06 1.06-3.04-3.04z" />
          </svg>
          <input
            ref={inputRef}
            className={`${inputClassName ? inputClassName + " " : ""}${cx("input")}`}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              editingRef.current = true;
              if (results.length > 0) setIsOpen(true);
            }}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder="Type a name to search..."
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${classPrefix}-option-${activeIndex}` : undefined}
          />
          {loading && <span className={cx("spinner")} aria-label="Searching..." />}
        </div>
      )}
      {isOpen && (
        <ul className={cx("dropdown")} role="listbox">
          {loading && results.length === 0 && (
            <li className={cx("status")}>
              <span className={`${cx("spinner")} ${cx("spinner-inline")}`} /> Searching...
            </li>
          )}
          {!loading && results.length === 0 && query.trim().length >= MIN_QUERY_LENGTH && <li className={cx("status")}>No people found for &ldquo;{query.trim()}&rdquo;</li>}
          {results.map((identity, i) => (
            <li
              key={identity.id}
              id={`${classPrefix}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`${cx("option")}${i === activeIndex ? ` ${cx("option--active")}` : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectIdentity(identity)}
              onMouseEnter={() => setActiveIndex(i)}>
              <Avatar name={identity.displayName} size={30} cx={cx} />
              <div className={cx("option-text")}>
                <span className={cx("name")}>{highlightMatch(identity.displayName)}</span>
              </div>
              {selected?.id === identity.id && (
                <svg className={cx("check")} viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
