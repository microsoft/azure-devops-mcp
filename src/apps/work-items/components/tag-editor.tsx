import { memo, useState, useCallback } from "react";

export const TagEditor = memo(function TagEditor({ tags, onChange }: { tags: string; onChange: (value: string) => void }) {
  const [inputValue, setInputValue] = useState("");
  const tagList = tags
    ? tags
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (!tag || tagList.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
      onChange([...tagList, tag].join("; "));
      setInputValue("");
    },
    [tagList, onChange]
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      onChange(tagList.filter((t) => t !== tagToRemove).join("; "));
    },
    [tagList, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(inputValue);
      }
    },
    [inputValue, addTag]
  );

  return (
    <div className="edit-field">
      <label className="edit-field-label">Tags</label>
      <div className="tag-editor">
        {tagList.length > 0 && (
          <div className="tag-list editable">
            {tagList.map((tag) => (
              <span key={tag} className="tag-pill editable">
                {tag}
                <button type="button" className="tag-remove-btn" onClick={() => removeTag(tag)} title={`Remove "${tag}"`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="tag-add-row">
          <input className="edit-input tag-input" type="text" placeholder="Type a tag and press Enter…" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} />
          <button type="button" className="btn-add-tag" onClick={() => addTag(inputValue)} disabled={!inputValue.trim()}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
});
