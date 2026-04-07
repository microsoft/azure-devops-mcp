// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import type { App } from "@modelcontextprotocol/ext-apps";
import type { WorkItem, EditState, WorkItemTypeMetadata } from "../types.ts";
import { formatAssignedTo, getPriorityLabel, getWorkItemId, getWorkItemWebUrl, stripHtml, renderSafeHtml, renderMarkdownToHtml, getFieldLabel, isHtmlContent } from "../utils.ts";
import { TagEditor } from "./tag-editor.tsx";
import { PeoplePicker } from "./people-picker.tsx";
import { RoosterEditor } from "../../shared/rooster-editor/index.ts";

/* ===== SVG icon paths for meta field labels ===== */
const META_ICONS: Record<string, string> = {
  "System.AssignedTo": "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0H3z",
  "Microsoft.VSTS.Common.Priority": "M3 2v12h1V8.5l8-3V2L3 2z",
  "Microsoft.VSTS.Common.Severity": "M8 1l7 13H1L8 1zm-.5 5v3.5h1V6h-1zm.5 5.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z",
  "System.State": "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z",

  "Microsoft.VSTS.Common.Activity": "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.5 3a.5.5 0 0 1 1 0v3.793l2.354 2.353a.5.5 0 0 1-.708.708l-2.5-2.5A.5.5 0 0 1 7.5 8V4z",
  "Microsoft.VSTS.Scheduling.RemainingWork": "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.5 3a.5.5 0 0 1 1 0v3.793l2.354 2.353a.5.5 0 0 1-.708.708l-2.5-2.5A.5.5 0 0 1 7.5 8V4z",
  "Microsoft.VSTS.Scheduling.OriginalEstimate": "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 0 1 0 10V3z",
  "Microsoft.VSTS.Scheduling.StoryPoints": "M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm1 3v2h3V4H4zm0 4v2h3V8H4zm5-4v2h3V4H9zm0 4v2h3V8H9z",
  "Microsoft.VSTS.Common.ValueArea": "M8 1l2.5 5 5.5.8-4 3.9.9 5.3L8 13.5 3.1 16l.9-5.3-4-3.9 5.5-.8L8 1z",
};

function MetaIcon({ field }: { field: string }) {
  const d = META_ICONS[field];
  if (!d) return null;
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ opacity: 0.7, flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

/* ===== Dynamic field classification constants ===== */

/**
 * Whitelist of meta fields to show as key-value pairs in the expanded view.
 * Only these fields appear in the meta section — everything else is excluded
 * unless it contains HTML (shown as a rich-text section).
 * This approach is robust for custom work item types: unknown fields are
 * silently ignored rather than accidentally displayed.
 */
const META_FIELDS_WHITELIST = new Set([
  "System.AssignedTo",
  "System.State",
  "Microsoft.VSTS.Common.Priority",
  "Microsoft.VSTS.Common.Severity",
  "Microsoft.VSTS.Common.Activity",
  "Microsoft.VSTS.Common.ValueArea",
  "Microsoft.VSTS.Scheduling.StoryPoints",
  "Microsoft.VSTS.Scheduling.RemainingWork",
  "Microsoft.VSTS.Scheduling.CompletedWork",
  "Microsoft.VSTS.Scheduling.OriginalEstimate",
]);

const META_FIELD_ORDER = [
  "System.AssignedTo",
  "Microsoft.VSTS.Common.Priority",
  "System.State",
  "Microsoft.VSTS.Scheduling.StoryPoints",
  "Microsoft.VSTS.Scheduling.RemainingWork",
  "Microsoft.VSTS.Scheduling.CompletedWork",
  "Microsoft.VSTS.Scheduling.OriginalEstimate",
];

const SECTION_FIELD_ORDER = ["System.Description", "Microsoft.VSTS.TCM.ReproSteps", "Microsoft.VSTS.Common.AcceptanceCriteria", "Microsoft.VSTS.TCM.SystemInfo"];

/** Fields whose values are always numeric (hours, points). Used to pick the right input type in edit mode. */
const NUMERIC_FIELDS = new Set([
  "Microsoft.VSTS.Scheduling.StoryPoints",
  "Microsoft.VSTS.Scheduling.RemainingWork",
  "Microsoft.VSTS.Scheduling.CompletedWork",
  "Microsoft.VSTS.Scheduling.OriginalEstimate",
]);

/** Fields that should render as dropdowns in edit mode. Values come from server metadata at runtime. */
const ENUM_FIELDS = new Set(["Microsoft.VSTS.Common.Priority", "Microsoft.VSTS.Common.Severity", "Microsoft.VSTS.Common.Activity", "Microsoft.VSTS.Common.ValueArea"]);

/* ===== Rich Text Editor (RoosterJS) ===== */
function RichEditorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="edit-field">
      <label className="edit-field-label">{label}</label>
      <RoosterEditor initialContent={value} onChange={onChange} placeholder={`Enter ${label.toLowerCase()}…`} />
    </div>
  );
}

export function ExpandedContent({
  wi,
  editState,
  onEdit,
  onSave,
  onCancel,
  onFieldChange,
  app,
  allowedStates,
  typeMetadataMap,
}: {
  wi: WorkItem;
  editState: EditState | null;
  onEdit: (id: number) => void;
  onSave: (id: number) => void;
  onCancel: () => void;
  onFieldChange: (field: string, value: string | number) => void;
  app: App | undefined;
  allowedStates: string[];
  typeMetadataMap: Record<string, WorkItemTypeMetadata>;
}) {
  const fields = wi.fields;
  if (!fields)
    return (
      <div className="expanded-content">
        <span>No details available</span>
      </div>
    );

  const type = fields["System.WorkItemType"] ?? "";
  const tags = fields["System.Tags"]
    ? String(fields["System.Tags"])
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const wiId = getWorkItemId(wi);
  const isEditing = editState !== null && editState.id === wiId;
  const webUrl = getWorkItemWebUrl(wi);

  const metaConfigs: { field: string; label: string }[] = [];
  const sectionFields: { field: string; label: string; format: string }[] = [];

  // Build set of whitelisted fields that actually exist in this work item type's metadata
  const typeMeta = typeMetadataMap[type];
  const typeFieldRefs = new Set(typeMeta?.fields?.map((f) => f.referenceName) ?? []);

  for (const [field, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const strVal = String(value);
    if (strVal.trim() === "") continue;
    const textContent = stripHtml(strVal).trim();
    if (!textContent) continue;

    // Whitelist: show as meta field if in the curated set
    if (META_FIELDS_WHITELIST.has(field)) {
      metaConfigs.push({ field, label: getFieldLabel(field) });
      continue;
    }

    // Multiline rich text fields — show as expandable sections
    const fieldFormat = wi.multilineFieldsFormat?.[field];
    if (isHtmlContent(value) || fieldFormat) {
      sectionFields.push({ field, label: getFieldLabel(field), format: fieldFormat ?? "html" });
    }
  }

  // In edit mode, also include whitelisted fields that exist in the type schema
  // but have no current value (e.g., RemainingWork=null on a new Task)
  if (isEditing) {
    const existingFields = new Set(metaConfigs.map((c) => c.field));
    for (const field of META_FIELDS_WHITELIST) {
      if (!existingFields.has(field) && typeFieldRefs.has(field)) {
        metaConfigs.push({ field, label: getFieldLabel(field) });
      }
    }

    // Include empty multiline fields from the type schema for editing
    const existingSections = new Set(sectionFields.map((c) => c.field));
    if (wi.multilineFieldsFormat) {
      for (const [field, format] of Object.entries(wi.multilineFieldsFormat)) {
        if (!existingSections.has(field) && typeFieldRefs.has(field)) {
          sectionFields.push({ field, label: getFieldLabel(field), format });
        }
      }
    }
  }

  metaConfigs.sort((a, b) => {
    const aIdx = META_FIELD_ORDER.indexOf(a.field);
    const bIdx = META_FIELD_ORDER.indexOf(b.field);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.label.localeCompare(b.label);
  });

  sectionFields.sort((a, b) => {
    const aIdx = SECTION_FIELD_ORDER.indexOf(a.field);
    const bIdx = SECTION_FIELD_ORDER.indexOf(b.field);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.label.localeCompare(b.label);
  });

  const formatMetaValue = (cfg: { field: string }) => {
    const raw = fields[cfg.field];
    if (raw === undefined || raw === null || raw === "") return null;
    if (cfg.field === "System.AssignedTo") return formatAssignedTo(raw as string | { displayName?: string; uniqueName?: string });
    if (cfg.field === "Microsoft.VSTS.Common.Priority") return getPriorityLabel(raw as number);
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      return String(obj.displayName ?? obj.uniqueName ?? JSON.stringify(raw));
    }
    if (typeof raw === "number") return String(raw);
    return String(raw);
  };

  if (isEditing) {
    const ef = editState?.fields ?? {};
    const EDIT_SPECIAL = new Set(["System.Title", "System.State", "System.AssignedTo", "System.Tags"]);
    const editableMetaFields = metaConfigs.filter((cfg) => !EDIT_SPECIAL.has(cfg.field));

    return (
      <div className="expanded-content" onClick={(e) => e.stopPropagation()}>
        {editState?.statusMsg && <div className={`edit-status-msg ${editState?.statusType}`}>{editState?.statusMsg}</div>}
        <div className="expanded-actions">
          <button className="btn-save" onClick={() => onSave(wiId)} disabled={editState?.saving ?? false}>
            <svg viewBox="0 0 16 16">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
            </svg>
            {editState?.saving ? "Saving\u2026" : "Save"}
          </button>
          <button className="btn-cancel" onClick={onCancel} disabled={editState?.saving ?? false}>
            <svg viewBox="0 0 16 16">
              <path d="M8 8.707l3.646 3.647.708-.708L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z" />
            </svg>
            Cancel
          </button>
        </div>
        <div className="edit-field">
          <label className="edit-field-label">Title</label>
          <input className="edit-input" type="text" value={String(ef["System.Title"] ?? "")} onChange={(e) => onFieldChange("System.Title", e.target.value)} />
        </div>
        <div className="edit-grid">
          {"System.State" in ef && (
            <div className="edit-field">
              <label className="edit-field-label">State</label>
              <select className="edit-select" value={String(ef["System.State"] ?? "")} onChange={(e) => onFieldChange("System.State", e.target.value)}>
                {(() => {
                  const currentVal = String(ef["System.State"] ?? "");
                  let stateOptions = allowedStates.length > 0 ? allowedStates : [];
                  if (stateOptions.length === 0) {
                    const typeMeta = typeMetadataMap[type];
                    if (typeMeta?.states?.length) stateOptions = typeMeta.states.map((s) => s.name);
                  }
                  if (stateOptions.length === 0) stateOptions = currentVal ? [currentVal] : [];
                  if (currentVal && !stateOptions.includes(currentVal)) stateOptions = [currentVal, ...stateOptions];
                  return stateOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ));
                })()}
              </select>
            </div>
          )}
          {"System.AssignedTo" in ef && (
            <div className="edit-field edit-field-wide">
              <label className="edit-field-label">Assigned To</label>
              <PeoplePicker value={String(ef["System.AssignedTo"] ?? "")} onChange={(v: string) => onFieldChange("System.AssignedTo", v)} app={app} />
            </div>
          )}
          {editableMetaFields.map((cfg) => {
            const isNumeric = NUMERIC_FIELDS.has(cfg.field);

            // Enum fields — use allowedValues from server type metadata
            if (ENUM_FIELDS.has(cfg.field)) {
              const typeMeta = typeMetadataMap[type];
              const fieldDef = typeMeta?.fields?.find((f) => f.referenceName === cfg.field);
              const allowedValues = fieldDef?.allowedValues ?? [];
              const currentVal = String(ef[cfg.field] ?? "");
              const isPriority = cfg.field === "Microsoft.VSTS.Common.Priority";

              // Format display label: for Priority, append human-readable label (e.g. "1" → "1 - Critical")
              const formatOptionLabel = (v: string) => {
                if (isPriority) {
                  const label = getPriorityLabel(Number(v));
                  return label !== `P${v}` ? `${v} - ${label}` : v;
                }
                return v;
              };

              return (
                <div key={cfg.field} className="edit-field">
                  <label className="edit-field-label">{cfg.label}</label>
                  <select className="edit-select" value={currentVal} onChange={(e) => onFieldChange(cfg.field, isPriority ? Number(e.target.value) : e.target.value)}>
                    {!isPriority && <option value="">— None —</option>}
                    {allowedValues.map((o) => (
                      <option key={o} value={o}>
                        {formatOptionLabel(o)}
                      </option>
                    ))}
                    {currentVal && !allowedValues.includes(currentVal) && (
                      <option key={currentVal} value={currentVal}>
                        {formatOptionLabel(currentVal)}
                      </option>
                    )}
                  </select>
                </div>
              );
            }

            // Numeric fields (StoryPoints, RemainingWork, etc.)
            return (
              <div key={cfg.field} className="edit-field">
                <label className="edit-field-label">{cfg.label}</label>
                <input
                  className="edit-input"
                  type={isNumeric ? "number" : "text"}
                  step={isNumeric ? "any" : undefined}
                  min={isNumeric ? "0" : undefined}
                  value={String(ef[cfg.field] ?? "")}
                  onChange={(e) => onFieldChange(cfg.field, isNumeric ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                />
              </div>
            );
          })}
        </div>
        {"System.Tags" in ef && <TagEditor tags={String(ef["System.Tags"] ?? "")} onChange={(val) => onFieldChange("System.Tags", val)} />}
        {sectionFields.map((cfg) => (
          <RichEditorField key={cfg.field} label={cfg.label} value={String(ef[cfg.field] ?? "")} onChange={(v) => onFieldChange(cfg.field, v)} />
        ))}
      </div>
    );
  }

  // View mode
  const renderedMeta = metaConfigs
    .map((cfg) => {
      const val = formatMetaValue(cfg);
      if (!val) return null;
      return (
        <div key={cfg.field} className="meta-field">
          <div className="meta-label">
            <MetaIcon field={cfg.field} />
            {cfg.label}
          </div>
          <div className="meta-value">{val}</div>
        </div>
      );
    })
    .filter(Boolean);

  return (
    <div className="expanded-content" onClick={(e) => e.stopPropagation()}>
      <div className="expanded-actions">
        {webUrl && (
          <button
            className="btn-open-ado"
            onClick={(e) => {
              e.stopPropagation();
              if (app) {
                app.openLink({ url: webUrl }).catch(() => {
                  window.open(webUrl, "_blank", "noopener,noreferrer");
                });
              } else {
                window.open(webUrl, "_blank", "noopener,noreferrer");
              }
            }}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
              <path d="M14 1H8.5a.5.5 0 0 0 0 1h4.793L6.146 9.146a.5.5 0 0 0 .708.708L14 2.707V7.5a.5.5 0 0 0 1 0V2a1 1 0 0 0-1-1z" />
              <path d="M12 9.5a.5.5 0 0 1 1 0V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3.5a.5.5 0 0 1 0 1H3v9h9V9.5z" />
            </svg>
            Open in Azure DevOps
          </button>
        )}
        <button className="btn-edit" onClick={() => onEdit(wiId)}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M11.498 1.002a2.5 2.5 0 0 1 3.535 3.536l-9.5 9.5a1 1 0 0 1-.5.27l-3.5.877a.5.5 0 0 1-.608-.608l.877-3.5a1 1 0 0 1 .27-.5l9.426-9.575z" />
          </svg>
          Edit
        </button>
      </div>
      {renderedMeta.length > 0 && <div className="expanded-meta">{renderedMeta}</div>}
      {tags.length > 0 && (
        <div className="expanded-tags">
          <div className="tags-label">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ opacity: 0.7 }}>
              <path d="M2 3a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0L2.293 8.293A1 1 0 0 1 2 7.586V3zm2.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
            </svg>
            Tags
          </div>
          <div className="tag-list">
            {tags.map((tag) => (
              <span key={tag} className="tag-pill">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      {sectionFields.map((cfg) => {
        const raw = fields[cfg.field];
        if (!raw || String(raw).trim() === "") return null;
        const rawStr = String(raw);
        let bodyHtml: string;
        if (cfg.format === "markdown") bodyHtml = renderMarkdownToHtml(rawStr);
        else if (cfg.format === "html" || cfg.format === "bullets") bodyHtml = renderSafeHtml(rawStr);
        else bodyHtml = renderSafeHtml(rawStr);
        if (!bodyHtml.trim()) return null;
        return (
          <div key={cfg.field}>
            <hr className="expanded-separator" />
            <div className="expanded-section">
              <div className="section-title">{cfg.label}</div>
              <div className="section-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
