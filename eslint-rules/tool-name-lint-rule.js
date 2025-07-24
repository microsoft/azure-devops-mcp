// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { validateName } from "../dist/shared/tool-validation.js";

/**
 * Custom ESLint rule to validate Azure DevOps MCP tool names and parameter names
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Validate tool names and parameter names conform to Claude API requirements",
      category: "Possible Errors",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      invalidToolName: "Tool name '{{name}}' is invalid: {{reason}}",
      invalidParameterName: "Parameter name '{{name}}' is invalid: {{reason}}",
      longParameterName: "Parameter name '{{name}}' is {{length}} characters long, consider shortening for better readability",
    },
  },

  create(context) {
    return {
      // Check tool constant definitions like: toolName: "actual_tool_name"
      Property(node) {
        if (node.value && node.value.type === "Literal" && typeof node.value.value === "string" && node.parent && node.parent.type === "ObjectExpression") {
          const parentObject = node.parent.parent;

          // Check if this is a tool constants object (contains "_TOOLS")
          if (parentObject && parentObject.type === "VariableDeclarator" && parentObject.id && parentObject.id.name && parentObject.id.name.includes("_TOOLS")) {
            const toolName = node.value.value;
            const validation = validateName(toolName);

            if (!validation.isValid) {
              context.report({
                node: node.value,
                messageId: "invalidToolName",
                data: {
                  name: toolName,
                  reason: validation.reason,
                },
              });
            }
          }
        }
      },

      // Check parameter names in function calls like: paramName: z.string()
      CallExpression(node) {
        if (
          node.callee &&
          node.callee.type === "MemberExpression" &&
          node.callee.object &&
          node.callee.object.name === "z" &&
          node.parent &&
          node.parent.type === "Property" &&
          node.parent.key &&
          node.parent.key.type === "Identifier"
        ) {
          const paramName = node.parent.key.name;
          const validation = validateName(paramName);

          if (!validation.isValid) {
            context.report({
              node: node.parent.key,
              messageId: "invalidParameterName",
              data: {
                name: paramName,
                reason: validation.reason,
              },
            });
          } else if (paramName.length > 32) {
            // Warning for long parameter names
            context.report({
              node: node.parent.key,
              messageId: "longParameterName",
              data: {
                name: paramName,
                length: paramName.length,
              },
            });
          }
        }
      },
    };
  },
};
