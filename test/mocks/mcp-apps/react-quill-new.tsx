// Mock for react-quill-new
import React from "react";

function MockReactQuill(props: any) {
  return React.createElement("div", {
    "data-testid": "react-quill",
    "className": "mock-react-quill",
    "children": [
      React.createElement("textarea", {
        key: "editor",
        value: props.value ?? "",
        onChange: (e: any) => props.onChange?.(e.target.value),
        placeholder: props.placeholder,
      }),
    ],
  });
}

MockReactQuill.displayName = "ReactQuill";
export default MockReactQuill;
