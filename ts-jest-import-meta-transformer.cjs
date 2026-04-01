// Custom ts-jest AST transformer that replaces `import.meta.dirname`
// with `__dirname` for CommonJS test compatibility.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require("typescript");

const name = "import-meta-dirname-transformer";
const version = 1;

function factory() {
  return function importMetaTransformer(context) {
    return function visitor(sourceFile) {
      function visit(node) {
        // Match: import.meta.dirname → __dirname
        if (ts.isPropertyAccessExpression(node) && ts.isMetaProperty(node.expression) && node.expression.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === "dirname") {
          return ts.factory.createIdentifier("__dirname");
        }
        return ts.visitEachChild(node, visit, context);
      }
      return ts.visitNode(sourceFile, visit);
    };
  };
}

module.exports = { name, version, factory };
