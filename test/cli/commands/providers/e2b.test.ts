import { describe, it, expect, vi, beforeEach } from "vitest";
import { installE2B } from "../../../../src/cli/commands/providers/e2b";
import { installTemplates } from "../../../../src/cli/utils/install";
import { isCliInstalled } from "../../../../src/cli/utils/auth";

vi.mock("../../../../src/cli/utils/install");
vi.mock("../../../../src/cli/utils/auth");

const mockedInstallTemplates = vi.mocked(installTemplates);
const mockedIsCliInstalled = vi.mocked(isCliInstalled);

describe("E2B provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("installE2B", () => {
    const mockConfig = {
      cpu: 2,
      memory: 1024,
      disk: 1
    };

    it("should call installTemplates with correct E2B configuration", async () => {
      mockedInstallTemplates.mockResolvedValue(true);
      
      const result = await installE2B(mockConfig, ["claude"]);
      
      expect(result).toBe(true);
      expect(mockedInstallTemplates).toHaveBeenCalledWith({
        provider: "E2B",
        cliCommand: "e2b",
        isInstalled: expect.any(Function),
        buildArgs: expect.any(Function),
        needsTempFile: false,
        dockerfilePathPrefix: "images/Dockerfile.",
        config: mockConfig,
        selectedTemplates: ["claude"]
      });
    });

    it("should generate correct build arguments", async () => {
      mockedInstallTemplates.mockResolvedValue(true);
      
      await installE2B(mockConfig, ["claude"]);
      
      const callArgs = mockedInstallTemplates.mock.calls[0][0];
      const buildArgs = callArgs.buildArgs("test-template", mockConfig, "Dockerfile.test");
      
      expect(buildArgs).toEqual([
        "template", "build",
        "--cpu-count", "2",
        "--memory-mb", "1024",
        "--name", "test-template",
        "--dockerfile", "Dockerfile.test"
      ]);
    });

    it("should use isCliInstalled function correctly", async () => {
      mockedIsCliInstalled.mockResolvedValue(true);
      mockedInstallTemplates.mockResolvedValue(true);
      
      await installE2B(mockConfig, ["claude"]);
      
      const callArgs = mockedInstallTemplates.mock.calls[0][0];
      await callArgs.isInstalled();
      
      expect(mockedIsCliInstalled).toHaveBeenCalledWith("e2b");
    });

    it("should handle installation failure", async () => {
      mockedInstallTemplates.mockResolvedValue(false);
      
      const result = await installE2B(mockConfig, ["claude"]);
      
      expect(result).toBe(false);
    });
  });
}); 