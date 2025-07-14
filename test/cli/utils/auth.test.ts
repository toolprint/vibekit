import { describe, it, expect, vi, beforeEach } from "vitest";
import { execa } from "execa";
import enquirer from "enquirer";
import { SANDBOX_PROVIDERS } from "../../../src/constants/enums";
import { isCliInstalled, checkAuth, authenticate } from "../../../src/cli/utils/auth";

const mockedExeca = vi.mocked(execa);
const mockedPrompt = vi.mocked(enquirer.prompt);

describe("auth utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isCliInstalled", () => {
    it("should return true if CLI is installed", async () => {
      mockedExeca.mockResolvedValue({ stdout: "version 1.0", stderr: "" } as any);
      const result = await isCliInstalled("testcli");
      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith("testcli", ["--version"]);
    });

    it("should return false if CLI is not installed", async () => {
      mockedExeca.mockRejectedValue(new Error("command not found"));
      const result = await isCliInstalled("testcli");
      expect(result).toBe(false);
    });
  });

  describe("checkAuth", () => {
    it("should return not authenticated if CLI not installed", async () => {
      mockedExeca.mockRejectedValue(new Error("command not found"));
      const result = await checkAuth(SANDBOX_PROVIDERS.E2B);
      expect(result.isAuthenticated).toBe(false);
      expect(result.needsInstall).toBe(true);
    });

    it("should check E2B authentication when logged in", async () => {
      mockedExeca.mockResolvedValueOnce({ stdout: "version 1.0", stderr: "" } as any); // isInstalled
      mockedExeca.mockResolvedValueOnce({ stdout: "Logged in as user", stderr: "" } as any); // checkAuth
      const result = await checkAuth(SANDBOX_PROVIDERS.E2B);
      expect(result.isAuthenticated).toBe(true);
      expect(result.username).toBe("E2B User");
    });

    it("should check E2B authentication when not logged in", async () => {
      mockedExeca.mockResolvedValueOnce({ stdout: "version 1.0", stderr: "" } as any); // isInstalled
      mockedExeca.mockResolvedValueOnce({ stdout: "Not logged in", stderr: "" } as any); // checkAuth
      const result = await checkAuth(SANDBOX_PROVIDERS.E2B);
      expect(result.isAuthenticated).toBe(false);
    });

    it("should check Daytona authentication", async () => {
      mockedExeca.mockResolvedValueOnce({ stdout: "version 1.0", stderr: "" } as any); // isInstalled
      mockedExeca.mockResolvedValueOnce({ stdout: "user@example.com", stderr: "" } as any); // checkAuth
      const result = await checkAuth(SANDBOX_PROVIDERS.DAYTONA);
      expect(result.isAuthenticated).toBe(true);
      expect(result.username).toBe("user@example.com");
    });

    it("should handle Daytona auth errors", async () => {
      mockedExeca.mockResolvedValueOnce({ stdout: "version 1.0", stderr: "" } as any); // isInstalled
      mockedExeca.mockResolvedValueOnce({ stdout: "", stderr: "authentication required" } as any); // checkAuth
      const result = await checkAuth(SANDBOX_PROVIDERS.DAYTONA);
      expect(result.isAuthenticated).toBe(false);
    });
  });

  describe("authenticate", () => {
    it("should install CLI if not installed and user confirms", async () => {
      mockedExeca.mockRejectedValueOnce(new Error("not installed")); // isInstalled check
      mockedPrompt.mockResolvedValueOnce({ confirm: true });
      mockedExeca.mockResolvedValueOnce({ stdout: "installed", stderr: "" } as any); // install
      mockedExeca.mockResolvedValueOnce({ stdout: "login success", stderr: "" } as any); // login
      mockedExeca.mockResolvedValueOnce({ stdout: "version 1.0", stderr: "" } as any); // verify isInstalled
      mockedExeca.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" } as any); // verify auth
      
      const result = await authenticate(SANDBOX_PROVIDERS.E2B);
      expect(result).toBe(true);
    });

    it("should return false if user declines CLI installation", async () => {
      mockedExeca.mockRejectedValueOnce(new Error("not installed")); // isInstalled check
      mockedPrompt.mockResolvedValueOnce({ confirm: false });
      
      const result = await authenticate(SANDBOX_PROVIDERS.E2B);
      expect(result).toBe(false);
    });

    it("should handle authentication failure after retries", async () => {
      mockedExeca.mockResolvedValueOnce({ stdout: "version 1.0", stderr: "" } as any); // isInstalled
      mockedExeca.mockResolvedValueOnce({ stdout: "login attempt", stderr: "" } as any); // login
      // Mock repeated failed auth checks - limit to avoid infinite loop
      mockedExeca.mockResolvedValue({ stdout: "Not logged in", stderr: "" } as any);
      
      const result = await authenticate(SANDBOX_PROVIDERS.E2B);
      expect(result).toBe(false);
    }, 10000); // 10 second timeout
  });
}); 