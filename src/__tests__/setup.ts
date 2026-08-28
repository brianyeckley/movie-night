import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount anything rendered by a component test so the next one starts clean.
afterEach(() => {
  cleanup();
});
