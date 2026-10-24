/**
 * Server-only. ethers stays in the contracts workspace so the free-mode
 * Next build does not depend on it. Returns null when that workspace has
 * not been installed.
 */

import { createRequire } from "module";
import path from "path";

export function loadEthers(): any | null {
  try {
    const require = createRequire(path.join(process.cwd(), "contracts", "package.json"));
    return require("ethers");
  } catch {
    return null;
  }
}
