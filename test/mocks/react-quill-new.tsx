// Mock for react-quill-new
// Provides a minimal stub for Jest/jsdom testing.

import React from "react";

function ReactQuill(props: { value: string; onChange?: (value: string) => void; placeholder?: string; theme?: string; modules?: any }) {
  return React.createElement("div", {
    "data-testid": "react-quill",
    "className": "mock-react-quill",
    "children": [
      React.createElement("textarea", {
        "key": "textarea",
        "data-testid": "quill-editor",
        "value": props.value || "",
        "placeholder": props.placeholder,
        "onChange": (e: any) => props.onChange?.(e.target.value),
      }),
    ],
  });
}

export default ReactQuill;
