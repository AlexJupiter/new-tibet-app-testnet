import { expect, it } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
it("keeps Expo Router query parsing compatible with the patched URI decoder", () => {
  const queryString = require("query-string");
  expect(queryString.parse("name=Tenzin%20Dolma&network=sepolia").name).toBe(
    "Tenzin Dolma",
  );
  expect(queryString.parse("value=%E0%A4%A").value).toBeTruthy();
});
