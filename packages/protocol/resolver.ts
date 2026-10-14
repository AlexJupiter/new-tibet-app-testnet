import artifact from "./generated/resolver.json";
import { ADMIN_ADDRESS, EAS_ADDRESS } from "./index";
import type { Hex } from "viem";
export function expectedResolverRuntime(): Hex {
  let code = artifact.runtime.slice(2);
  for (const [name, value] of Object.entries({
    admin: ADMIN_ADDRESS,
    eas: EAS_ADDRESS,
  })) {
    for (const ref of artifact.immutableReferences[name as "admin" | "eas"]) {
      const replacement = value
        .slice(2)
        .toLowerCase()
        .padStart(ref.length * 2, "0");
      code =
        code.slice(0, ref.start * 2) +
        replacement +
        code.slice((ref.start + ref.length) * 2);
    }
  }
  return `0x${code}` as Hex;
}
