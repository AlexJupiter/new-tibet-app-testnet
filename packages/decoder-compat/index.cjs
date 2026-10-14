// query-string 7 expects a CommonJS function. The patched decoder is ESM.
// Keep the upstream implementation intact and adapt only its export shape.
module.exports = require('decode-uri-component-impl').default;
