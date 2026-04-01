// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useState, useCallback, useEffect, useRef } from "react";
import { useApp, useHostStyles, useDocumentTheme } from "@modelcontextprotocol/ext-apps/react";
import { applyDocumentTheme } from "@modelcontextprotocol/ext-apps";
import type { App } from "@modelcontextprotocol/ext-apps";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import type { ContentItem, CommentReviewPayload, ReviewAction } from "./types.ts";
import { colorForType, normalizeAdoHtml } from "../shared/utils.ts";

const quillModules = {
  toolbar: [[{ header: [1, 2, 3, false] }], ["bold", "italic", "underline", "strike"], [{ list: "ordered" }, { list: "bullet" }], ["link", "code-block"], ["clean"]],
};

function isHtmlEmpty(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length === 0
  );
}

function ensureHtml(text: string): string {
  if (!text) return text;
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function buildWorkItemUrl(orgUrl: string, project: string, workItemId: number): string {
  return `${orgUrl.replace(/\/$/, "")}/${encodeURIComponent(project)}/_workitems/edit/${workItemId}`;
}

function openWorkItemLink(app: App | null, orgUrl: string, project: string, workItemId: number): void {
  const url = buildWorkItemUrl(orgUrl, project, workItemId);
  if (app) {
    app.openLink({ url }).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function CommentReviewApp() {
  const [payload, setPayload] = useState<CommentReviewPayload | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"loading" | "error" | "posted" | "editing" | "done">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [doneAction, setDoneAction] = useState<ReviewAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const appRef = useRef<App | null>(null);

  const isCommentEmpty = isHtmlEmpty(comment);

  const handleToolResult = useCallback((result: { content?: ContentItem[]; isError?: boolean }) => {
    if (result.isError) {
      const textItem = result.content?.find((c) => c.type === "text");
      setErrorMsg(textItem?.text ?? "Tool execution failed");
      setStatus("error");
      return;
    }
    const textItem = result.content?.find((c) => c.type === "text");
    if (!textItem?.text) {
      setStatus("error");
      setErrorMsg("No data received from the server.");
      return;
    }
    try {
      const data = JSON.parse(textItem.text) as CommentReviewPayload;
      setPayload(data);
      setComment(ensureHtml(data.comment ?? ""));
      setStatus("posted");
    } catch {
      setErrorMsg("Failed to parse server response.");
      setStatus("error");
    }
  }, []);

  const handleToolResultRef = useRef(handleToolResult);
  handleToolResultRef.current = handleToolResult;

  const onAppCreated = useCallback((createdApp: App) => {
    appRef.current = createdApp;

    createdApp.onhostcontextchanged = (ctx) => {
      if (ctx.theme) {
        applyDocumentTheme(ctx.theme);
      }
      if (ctx.safeAreaInsets) {
        const { top, right, bottom, left } = ctx.safeAreaInsets;
        document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      }
    };

    createdApp.ontoolinput = () => {};

    createdApp.ontoolresult = (result) => {
      handleToolResultRef.current(result as { content?: ContentItem[]; isError?: boolean });
    };

    createdApp.ontoolcancelled = () => {
      setErrorMsg("The operation was cancelled.");
      setStatus("error");
    };

    createdApp.onerror = (error) => {
      setErrorMsg(error?.message ?? "Connection error");
      setStatus("error");
    };

    createdApp.onteardown = async () => {
      return {};
    };
  }, []);

  const { app, error: connectionError } = useApp({
    appInfo: { name: "Comment Review App", version: "1.0.0" },
    capabilities: {},
    onAppCreated,
  });

  useHostStyles(app);
  useDocumentTheme();

  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    if (ctx?.theme) {
      applyDocumentTheme(ctx.theme);
    }
    if (ctx?.safeAreaInsets) {
      const { top, right, bottom, left } = ctx.safeAreaInsets;
      document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
    }
  }, [app]);

  useEffect(() => {
    if (status !== "editing" || activeTab !== "edit") return;
    const tooltips: Record<string, string> = {
      "button.ql-bold": "Bold",
      "button.ql-italic": "Italic",
      "button.ql-underline": "Underline",
      "button.ql-strike": "Strikethrough",
      "button.ql-link": "Insert Link",
      "button.ql-code-block": "Code Block",
      "button.ql-clean": "Clear Formatting",
      "button.ql-list[value='ordered']": "Numbered List",
      "button.ql-list[value='bullet']": "Bullet List",
      ".ql-header .ql-picker-label": "Heading Style",
    };
    const applyTooltips = () => {
      const toolbar = document.querySelector(".ql-toolbar.ql-snow");
      if (!toolbar) return false;
      for (const [selector, title] of Object.entries(tooltips)) {
        const el = toolbar.querySelector(selector);
        if (el) {
          el.setAttribute("title", title);
          el.setAttribute("aria-label", title);
        }
      }
      return true;
    };
    // Quill renders async — retry until toolbar appears
    if (!applyTooltips()) {
      const id = setInterval(() => {
        if (applyTooltips()) clearInterval(id);
      }, 50);
      return () => clearInterval(id);
    }
  }, [status, activeTab]);

  const handleAction = useCallback(
    async (action: ReviewAction) => {
      const currentApp = appRef.current;
      if (!currentApp || !payload) return;

      setIsSubmitting(true);

      try {
        if (action === "updated") {
          const result = await currentApp.callServerTool({
            name: "wit_update_work_item_comment",
            arguments: {
              project: payload.project,
              workItemId: payload.workItemId,
              commentId: payload.commentId,
              text: normalizeAdoHtml(comment),
            },
          });

          if (result?.isError) {
            const textItem = (result.content as ContentItem[] | undefined)?.find((c) => c.type === "text");
            const errText = textItem?.text ?? "Failed to update comment";
            setErrorMsg(errText);
            setStatus("error");
            return;
          }

          // Show success screen (user can edit again or delete from there)
          setDoneAction(action);
          setStatus("done");
        } else if (action === "deleted") {
          const result = await currentApp.callServerTool({
            name: "wit_delete_work_item_comment",
            arguments: {
              project: payload.project,
              workItemId: payload.workItemId,
              commentId: payload.commentId,
            },
          });

          if (result?.isError) {
            const textItem = (result.content as ContentItem[] | undefined)?.find((c) => c.type === "text");
            const errText = textItem?.text ?? "Failed to delete comment";
            setErrorMsg(errText);
            setStatus("error");
            return;
          }

          setDoneAction(action);
          setStatus("done");

          currentApp.requestTeardown?.().catch(() => {});
        }
      } catch (err) {
        const errText = err instanceof Error ? err.message : "Failed to send result";
        setErrorMsg(errText);
        setStatus("error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [payload, comment]
  );

  // Close delete confirm dialog on Escape
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDeleteConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDeleteConfirm]);

  const deleteConfirmDialog = showDeleteConfirm && (
    <div className="cr-dialog-overlay" onClick={() => setShowDeleteConfirm(false)}>
      <div className="cr-dialog" role="alertdialog" aria-labelledby="cr-dialog-title" aria-describedby="cr-dialog-desc" onClick={(e) => e.stopPropagation()}>
        <div className="cr-dialog__icon-ring">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>
        <h3 className="cr-dialog__title" id="cr-dialog-title">
          Delete comment
        </h3>
        <p className="cr-dialog__desc" id="cr-dialog-desc">
          This will permanently remove your comment from work item <strong>#{payload?.workItemId}</strong>. This action cannot be undone.
        </p>
        <div className="cr-dialog__actions">
          <button
            className="cr-dialog__btn cr-dialog__btn--danger"
            onClick={() => {
              setShowDeleteConfirm(false);
              handleAction("deleted");
            }}>
            Delete comment
          </button>
          <button className="cr-dialog__btn cr-dialog__btn--cancel" onClick={() => setShowDeleteConfirm(false)} autoFocus>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  if (connectionError) {
    return (
      <div className="cr-container">
        <div className="status-screen">
          <div className="status-icon status-icon--error">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="status-title">Connection Error</div>
          <div className="status-detail">{connectionError.message}</div>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="cr-container">
        <div className="status-screen">
          <div className="spinner" />
          <div className="status-title">Preparing comment editor</div>
          <div className="status-detail">Fetching work item details…</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="cr-container">
        <div className="status-screen">
          <div className="status-icon status-icon--error">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="status-title">Something went wrong</div>
          <div className="status-detail">{errorMsg}</div>
        </div>
      </div>
    );
  }

  if (status === "done") {
    const isUpdated = doneAction === "updated";
    const isDeleted = doneAction === "deleted";
    return (
      <div className="cr-container">
        {deleteConfirmDialog}
        <div className="status-screen">
          <div className={`status-icon ${isDeleted ? "status-icon--neutral" : "status-icon--success"}`}>
            {isDeleted ? (
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>
          <div className="status-title">{isDeleted ? "Comment deleted" : isUpdated ? "Comment updated" : "Done"}</div>
          <div className="status-detail">
            {isDeleted ? (
              <>
                The comment on work item <strong>#{payload?.workItemId}</strong> has been removed.
              </>
            ) : (
              <>
                Your comment on work item{" "}
                {payload?.orgUrl ? (
                  <button className="cr-wi-link" onClick={() => openWorkItemLink(appRef.current, payload.orgUrl!, payload.project, payload.workItemId)}>
                    #{payload.workItemId}
                  </button>
                ) : (
                  <strong>#{payload?.workItemId}</strong>
                )}{" "}
                has been updated.
              </>
            )}
          </div>
          {!isDeleted && (
            <div className="cr-done-actions">
              <button className="cr-btn cr-btn--secondary" onClick={() => setStatus("editing")}>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5z" />
                </svg>
                Edit Again
              </button>
              <button className="cr-btn cr-btn--ghost" onClick={() => setShowDeleteConfirm(true)}>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                  <path
                    fillRule="evenodd"
                    d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                  />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "posted") {
    return (
      <div className="cr-container">
        {deleteConfirmDialog}
        <div className="cr-card">
          <div className="cr-header">
            <div className="cr-header__content">
              <div className="cr-header__meta">
                {(() => {
                  const c = colorForType(payload?.workItemType ?? "", payload?.workItemTypeColor);
                  return (
                    <span className="cr-type-badge" style={{ background: c.bg, color: c.fg }}>
                      {payload?.workItemType}
                    </span>
                  );
                })()}
                {payload?.orgUrl ? (
                  <button
                    aria-label={`Open work item #${payload.workItemId} in Azure DevOps`}
                    className="cr-wi-id cr-wi-id--link"
                    onClick={() => openWorkItemLink(appRef.current, payload.orgUrl!, payload.project, payload.workItemId)}>
                    #{payload.workItemId}
                  </button>
                ) : (
                  <span className="cr-wi-id">#{payload?.workItemId}</span>
                )}
                <span className="cr-posted-badge">✓ Posted</span>
              </div>
              <h2 className="cr-header__title">{payload?.title}</h2>
            </div>
          </div>

          <div className="cr-divider" />

          <div className="cr-editor">
            <label className="cr-editor__label">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="cr-editor__label-icon" aria-hidden="true">
                <path d="M14 1H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3l3 2 3-2h3a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM4 5h8v1H4V5zm0 3h6v1H4V8z" />
              </svg>
              Comment
            </label>
            <div className="cr-preview ql-snow">
              {isCommentEmpty ? <div className="cr-preview__empty">Empty comment.</div> : <div className="cr-preview__content ql-editor" dangerouslySetInnerHTML={{ __html: comment }} />}
            </div>
          </div>

          <div className="cr-divider" />

          <div className="cr-actions">
            <button className="cr-btn cr-btn--ghost" disabled={isSubmitting} onClick={() => setShowDeleteConfirm(true)} title="Delete the posted comment">
              {isSubmitting ? (
                <>
                  <span className="cr-btn__spinner" /> Deleting…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                    <path
                      fillRule="evenodd"
                      d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                    />
                  </svg>
                  Delete
                </>
              )}
            </button>
            <button className="cr-btn cr-btn--secondary" disabled={isSubmitting} onClick={() => setStatus("editing")} title="Edit the posted comment">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5z" />
              </svg>
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cr-container">
      <div className="cr-card">
        <div className="cr-header">
          <div className="cr-header__content">
            <div className="cr-header__meta">
              {(() => {
                const c = colorForType(payload?.workItemType ?? "", payload?.workItemTypeColor);
                return (
                  <span className="cr-type-badge" style={{ background: c.bg, color: c.fg }}>
                    {payload?.workItemType}
                  </span>
                );
              })()}
              {payload?.orgUrl ? (
                <button
                  aria-label={`Open work item #${payload.workItemId} in Azure DevOps`}
                  className="cr-wi-id cr-wi-id--link"
                  onClick={() => openWorkItemLink(appRef.current, payload.orgUrl!, payload.project, payload.workItemId)}>
                  #{payload.workItemId}
                </button>
              ) : (
                <span className="cr-wi-id">#{payload?.workItemId}</span>
              )}
            </div>
            <h2 className="cr-header__title">{payload?.title}</h2>
          </div>
        </div>

        <div className="cr-divider" />

        <div className="cr-editor">
          <div className="cr-editor__label-row">
            <label className="cr-editor__label">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="cr-editor__label-icon" aria-hidden="true">
                <path d="M14 1H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3l3 2 3-2h3a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM4 5h8v1H4V5zm0 3h6v1H4V8z" />
              </svg>
              Your Comment
            </label>
            <div className="cr-tab-bar" role="tablist">
              <button
                role="tab"
                id="cr-tab-edit"
                aria-selected={activeTab === "edit"}
                aria-controls="cr-tabpanel-edit"
                className={`cr-tab-bar__tab${activeTab === "edit" ? " cr-tab-bar__tab--active" : ""}`}
                onClick={() => setActiveTab("edit")}>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5z" />
                </svg>
                Edit
              </button>
              <button
                role="tab"
                id="cr-tab-preview"
                aria-selected={activeTab === "preview"}
                aria-controls="cr-tabpanel-preview"
                className={`cr-tab-bar__tab${activeTab === "preview" ? " cr-tab-bar__tab--active" : ""}`}
                onClick={() => setActiveTab("preview")}>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                  <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                  <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                </svg>
                Preview
              </button>
            </div>
          </div>

          {activeTab === "edit" ? (
            <div role="tabpanel" id="cr-tabpanel-edit" aria-labelledby="cr-tab-edit">
              <div className="cr-editor__quill-wrapper">
                <ReactQuill theme="snow" value={comment} onChange={setComment} modules={quillModules} placeholder="Write your comment here…" />
              </div>
              <div className="cr-editor__hint">Format your comment using the toolbar. Supports bold, italic, lists, links, and code blocks.</div>
            </div>
          ) : (
            <div role="tabpanel" id="cr-tabpanel-preview" aria-labelledby="cr-tab-preview" className="cr-preview ql-snow">
              {isCommentEmpty ? (
                <div className="cr-preview__empty">Nothing to preview — start typing in the editor.</div>
              ) : (
                <div className="cr-preview__content ql-editor" dangerouslySetInnerHTML={{ __html: comment }} />
              )}
            </div>
          )}
        </div>

        <div className="cr-divider" />

        <div className="cr-actions">
          <button className="cr-btn cr-btn--ghost" disabled={isSubmitting} onClick={() => setStatus("posted")} title="Cancel editing">
            Cancel
          </button>
          <button
            className="cr-btn cr-btn--primary"
            disabled={isSubmitting || isCommentEmpty}
            onClick={() => handleAction("updated")}
            title={isCommentEmpty ? "Write a comment first" : "Save updated comment"}>
            {isSubmitting ? (
              <>
                <span className="cr-btn__spinner" /> Updating…
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                  <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.036a.5.5 0 0 1 .54.11z" />
                </svg>
                Save Update
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
