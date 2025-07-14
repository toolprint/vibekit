import { describe, it, expect, vi, beforeEach } from "vitest";
import { execa } from "execa";
import enquirer from "enquirer";
import { initCommand } from "../../../src/cli/commands/init";
import { checkAuth, authenticate, isCliInstalled } from "../../../src/cli/utils/auth";
import { installE2B } from "../../../src/cli/commands/providers/e2b";
import { installDaytona } from "../../../src/cli/commands/providers/daytona";
import { SANDBOX_PROVIDERS } from "../../../src/constants/enums";

vi.mock("../../../src/cli/utils/auth");
vi.mock("../../../src/cli/commands/providers/e2b");
vi.mock("../../../src/cli/commands/providers/daytona");
vi.mock("cfonts", () => ({
  say: vi.fn(),
}));

const mockedExeca = vi.mocked(execa);
const mockedPrompt = vi.mocked(enquirer.prompt);
const mockedCheckAuth = vi.mocked(checkAuth);
const mockedAuthenticate = vi.mocked(authenticate);
const mockedIsCliInstalled = vi.mocked(isCliInstalled);
const mockedInstallE2B = vi.mocked(installE2B);
const mockedInstallDaytona = vi.mocked(installDaytona);

describe("init command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.log mock
    vi.mocked(console.log).mockClear();
    vi.mocked(console.error).mockClear();
  });

  it("should complete successful setup with all providers", async () => {
    // Mock user selections
    mockedPrompt
      .mockResolvedValueOnce({ providers: [SANDBOX_PROVIDERS.E2B, SANDBOX_PROVIDERS.DAYTONA] })
      .mockResolvedValueOnce({ templates: ["claude", "codex"] })
      .mockResolvedValueOnce({ cpu: "2", memory: "1024", disk: "1" });

    // Mock Docker checks to pass
    mockedExeca.mockResolvedValue({ stdout: "Docker version", stderr: "" } as any);
    
    // Mock CLI installed by default
    mockedIsCliInstalled.mockResolvedValue(true);
    
    // Mock authentication as already authenticated
    mockedCheckAuth.mockResolvedValue({ isAuthenticated: true, provider: SANDBOX_PROVIDERS.E2B });
    
    // Mock successful installations
    mockedInstallE2B.mockResolvedValue(true);
    mockedInstallDaytona.mockResolvedValue(true);

    await initCommand();

    expect(mockedInstallE2B).toHaveBeenCalledWith(
      { cpu: 2, memory: 1024, disk: 1 },
      ["claude", "codex"]
    );
    expect(mockedInstallDaytona).toHaveBeenCalledWith(
      { cpu: 2, memory: 1, disk: 1 }, // Daytona transforms memory to GB
      ["claude", "codex"]
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Setup complete")
    );
  });

  it("should exit early if no providers selected", async () => {
    mockedPrompt.mockResolvedValueOnce({ providers: [] });

    await initCommand();

    expect(process.exit).toHaveBeenCalledWith(0);
    expect(mockedPrompt).toHaveBeenCalledTimes(1);
  });

  it("should exit early if no templates selected", async () => {
    mockedPrompt
      .mockResolvedValueOnce({ providers: [SANDBOX_PROVIDERS.E2B] })
      .mockResolvedValueOnce({ templates: [] });

    await initCommand();

    expect(mockedPrompt).toHaveBeenCalledTimes(2);
    // Should return early, not call installations
    expect(mockedInstallE2B).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("No templates selected")
    );
  });

  it("should handle Docker not installed", async () => {
    mockedPrompt
      .mockResolvedValueOnce({ providers: [SANDBOX_PROVIDERS.E2B] })
      .mockResolvedValueOnce({ templates: ["claude"] })
      .mockResolvedValueOnce({ cpu: "2", memory: "1024" });

    // Mock Docker not installed
    mockedExeca.mockRejectedValue(new Error("docker: command not found"));

    await initCommand();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Docker not found")
    );
  });

  it("should handle Docker not running", async () => {
    mockedPrompt
      .mockResolvedValueOnce({ providers: [SANDBOX_PROVIDERS.E2B] })
      .mockResolvedValueOnce({ templates: ["claude"] })
      .mockResolvedValueOnce({ cpu: "2", memory: "1024" });

    // Mock Docker installed but not running
    mockedExeca
      .mockResolvedValueOnce({ stdout: "Docker version", stderr: "" } as any) // docker --version
      .mockRejectedValueOnce(new Error("Cannot connect to Docker daemon")); // docker info

    await initCommand();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Docker is not running")
    );
  });

  it("should handle authentication required", async () => {
    mockedPrompt
      .mockResolvedValueOnce({ providers: [SANDBOX_PROVIDERS.E2B] })
      .mockResolvedValueOnce({ templates: ["claude"] })
      .mockResolvedValueOnce({ cpu: "2", memory: "1024" });

    // Mock Docker working
    mockedExeca.mockResolvedValue({ stdout: "Docker version", stderr: "" } as any);
    
    // Mock CLI installed
    mockedIsCliInstalled.mockResolvedValue(true);
    
    // Mock authentication required, then successful
    mockedCheckAuth
      .mockResolvedValueOnce({ isAuthenticated: false, provider: SANDBOX_PROVIDERS.E2B })
      .mockResolvedValueOnce({ isAuthenticated: true, provider: SANDBOX_PROVIDERS.E2B });
    mockedAuthenticate.mockResolvedValue(true);
    mockedInstallE2B.mockResolvedValue(true);

    await initCommand();

    expect(mockedAuthenticate).toHaveBeenCalledWith(SANDBOX_PROVIDERS.E2B);
    expect(mockedInstallE2B).toHaveBeenCalled();
  });

  it("should handle authentication failure", async () => {
    mockedPrompt
      .mockResolvedValueOnce({ providers: [SANDBOX_PROVIDERS.E2B] })
      .mockResolvedValueOnce({ templates: ["claude"] })
      .mockResolvedValueOnce({ cpu: "2", memory: "1024" });

    // Mock Docker working
    mockedExeca.mockResolvedValue({ stdout: "Docker version", stderr: "" } as any);
    
    // Mock CLI installed
    mockedIsCliInstalled.mockResolvedValue(true);
    
    // Mock authentication failure
    mockedCheckAuth.mockResolvedValue({ isAuthenticated: false, provider: SANDBOX_PROVIDERS.E2B });
    mockedAuthenticate.mockResolvedValue(false);

    await initCommand();

    expect(mockedAuthenticate).toHaveBeenCalledWith(SANDBOX_PROVIDERS.E2B);
    expect(mockedInstallE2B).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Setup failed")
    );
  });

  it("should handle mixed success and failure", async () => {
    mockedPrompt
      .mockResolvedValueOnce({ providers: [SANDBOX_PROVIDERS.E2B, SANDBOX_PROVIDERS.DAYTONA] })
      .mockResolvedValueOnce({ templates: ["claude"] })
      .mockResolvedValueOnce({ cpu: "2", memory: "1024", disk: "1" });

    // Mock Docker working
    mockedExeca.mockResolvedValue({ stdout: "Docker version", stderr: "" } as any);
    
    // Mock CLI installed
    mockedIsCliInstalled.mockResolvedValue(true);
    
    // Mock authentication working
    mockedCheckAuth.mockResolvedValue({ isAuthenticated: true, provider: SANDBOX_PROVIDERS.E2B });
    
    // Mock mixed installation results
    mockedInstallE2B.mockResolvedValue(true);
    mockedInstallDaytona.mockResolvedValue(false);

    await initCommand();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("partially complete")
    );
  });

  it("should handle setup failure", async () => {
    mockedPrompt
      .mockResolvedValueOnce({ providers: [SANDBOX_PROVIDERS.E2B] })
      .mockResolvedValueOnce({ templates: ["claude"] })
      .mockResolvedValueOnce({ cpu: "2", memory: "1024" });

    // Mock Docker working
    mockedExeca.mockResolvedValue({ stdout: "Docker version", stderr: "" } as any);
    
    // Mock CLI installed
    mockedIsCliInstalled.mockResolvedValue(true);
    
    // Mock authentication working
    mockedCheckAuth.mockResolvedValue({ isAuthenticated: true, provider: SANDBOX_PROVIDERS.E2B });
    
    // Mock installation failure
    mockedInstallE2B.mockResolvedValue(false);

    await initCommand();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Setup failed")
    );
  });
}); 