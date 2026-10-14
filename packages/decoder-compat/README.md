# Decoder compatibility

Expo Router uses query-string 7, which requires a CommonJS decoder function. The upstream security fix is decode-uri-component 0.5.0, whose default export is ESM. This wrapper adapts that export without changing the upstream decoding implementation. The dependency is installed under an explicit alias to avoid recursively applying the override. Node 22.13+ and Metro support this use. Routing compatibility is tested in `tests/routing.test.ts` and both native exports.
