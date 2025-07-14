import { describe, it, expect, vi, beforeEach } from "vitest";
import { installDaytona } from "../../../../src/cli/commands/providers/daytona";
import { installTemplates } from "../../../../src/cli/utils/install";
import { isCliInstalled } from "../../../../src/cli/utils/auth";

vi.mock("../../../../src/cli/utils/install");
vi.mock("../../../../src/cli/utils/auth");

const mockedInstallTemplates = vi.mocked(installTemplates);
const mockedIsCliInstalled = vi.mocked(isCliInstalled);

describe("Daytona provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("installDaytona", () => {
    const mockConfig = {
      cpu: 2,
      memory: 1024,
      disk: 1
    };

    it("should call installTemplates with correct Daytona configuration", async () => {
      mockedInstallTemplates.mockResolvedValue(true);
      
      const result = await installDaytona(mockConfig, ["claude"]);
      
      expect(result).toBe(true);
      expect(mockedInstallTemplates).toHaveBeenCalledWith({
        provider: "Daytona",
        cliCommand: "daytona",
        isInstalled: expect.any(Function),
        buildArgs: expect.any(Function),
        needsTempFile: true,
        dockerfilePathPrefix: "images/Dockerfile.",
        config: mockConfig,
        selectedTemplates: ["claude"]
      });
    });

    it("should generate correct build arguments", async () => {
      mockedInstallTemplates.mockResolvedValue(true);
      
      await installDaytona(mockConfig, ["claude"]);
      
      const callArgs = mockedInstallTemplates.mock.calls[0][0];
      const buildArgs = callArgs.buildArgs("test-template", mockConfig, "Dockerfile.test.tmp");
      
      expect(buildArgs).toEqual([
        "snapshots", "create",
        "test-template",
        "--cpu", "2",
        "--memory", "1024",
        "--disk", "1",
        "--dockerfile", "Dockerfile.test.tmp"
      ]);
    });

    it("should use isCliInstalled function correctly", async () => {
      mockedIsCliInstalled.mockResolvedValue(true);
      mockedInstallTemplates.mockResolvedValue(true);
      
      await installDaytona(mockConfig, ["claude"]);
      
      const callArgs = mockedInstallTemplates.mock.calls[0][0];
      await callArgs.isInstalled();
      
      expect(mockedIsCliInstalled).toHaveBeenCalledWith("daytona");
    });

    it("should handle installation failure", async () => {
      mockedInstallTemplates.mockResolvedValue(false);
      
      const result = await installDaytona(mockConfig, ["claude"]);
      
      expect(result).toBe(false);
    });

    it("should require temp file creation", async () => {
      mockedInstallTemplates.mockResolvedValue(true);
      
      await installDaytona(mockConfig, ["claude"]);
      
      const callArgs = mockedInstallTemplates.mock.calls[0][0];
      expect(callArgs.needsTempFile).toBe(true);
    });
  });
}); 