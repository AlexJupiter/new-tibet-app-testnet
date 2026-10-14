import { describe, it, expect, vi, afterEach } from "vitest";
import { showDialog } from "../apps/mobile/src/dialogs.web";
import { validateMedia } from "../apps/mobile/src/evidence";
afterEach(() => vi.unstubAllGlobals());
describe("Browser confirmation parity", () => {
  it("cancellation never sends a transfer or deletes a profile", () => {
    const action = vi.fn();
    vi.stubGlobal("window", { confirm: () => false });
    showDialog("Confirm transfer", "Send test ETH?", [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: action },
    ]);
    expect(action).not.toHaveBeenCalled();
  });
  it("confirmation runs the requested action exactly once", () => {
    const action = vi.fn();
    vi.stubGlobal("window", { confirm: () => true });
    showDialog("Delete profile", "Delete private evidence?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", onPress: action },
    ]);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
describe("Shared native/browser evidence policy", () => {
  it("accepts the same book image and challenge video formats", () => {
    expect(() => validateMedia("front", 1000, "image/jpeg")).not.toThrow();
    expect(() => validateMedia("video", 1000, "video/mp4", 30)).not.toThrow();
  });
  it("rejects excessive video duration and unsafe or oversized files", () => {
    expect(() => validateMedia("video", 1000, "video/mp4", 31)).toThrow();
    expect(() => validateMedia("front", 1000, "image/svg+xml")).toThrow();
    expect(() => validateMedia("front", 2000001, "image/jpeg")).toThrow();
    expect(() => validateMedia("video", 10000001, "video/mp4")).toThrow();
  });
});
