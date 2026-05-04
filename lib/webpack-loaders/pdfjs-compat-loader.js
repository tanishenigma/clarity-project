/**
 * Webpack loader that patches pdfjs-dist/build/pdf.mjs.
 *
 * The file ships its own internal webpack runtime that declares
 *   var __webpack_exports__ = {};
 * at module scope.  In webpack 5, the outer module wrapper also uses
 * __webpack_exports__ as a parameter name, and because `var` is hoisted
 * the local declaration shadows the parameter before it is assigned —
 * making it `undefined` when webpack 5 calls Object.defineProperty on it,
 * which throws "Object.defineProperty called on non-object".
 *
 * This loader renames the conflicting local variable to __pdfjs_exports__
 * so it no longer shadows webpack 5's own parameter.
 */
module.exports = function pdfjsCompatLoader(source) {
  // Only one occurrence expected; replace it so the name no longer conflicts.
  return source.replace(
    /var __webpack_exports__ = \{\};/,
    "var __pdfjs_exports__ = {};",
  );
};
