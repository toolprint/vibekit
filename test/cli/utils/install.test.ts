import { describe, it, expect, vi, beforeEach } from "vitest";
import { execa } from "execa";
import { installTemplates, InstallConfig } from "../../../src/cli/utils/install";
import { AGENT_TEMPLATES } from "../../../src/constants/enums";

const mockedExeca = vi.mocked(execa);
const mockedFsPromises = await import("fs/promises");

describe("install utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("installTemplates", () => {
    const mockConfig: InstallConfig = {
      cpu: 2,
      memory: 1024,
      disk: 1
    };

    const mockOptions = {
      provider: "TestProvider",
      cliCommand: "testcli",
      isInstalled: vi.fn().mockResolvedValue(true),
      buildArgs: vi.fn().mockReturnValue(["build", "--template", "test"]),
      needsTempFile: false,
      dockerfilePathPrefix: "images/Dockerfile.",
      config: mockConfig,
      selectedTemplates: ["claude"]
    };

    it("should install templates successfully", async () => {
      vi.mocked(mockedFsPromises.access).mockResolvedValue(undefined);
      mockedExeca.mockResolvedValue({ stdout: "success", stderr: "" } as any);

      const result = await installTemplates(mockOptions);
      expect(result).toBe(true);
      expect(mockOptions.isInstalled).toHaveBeenCalled();
    });

    it("should handle provider CLI not installed", async () => {
      mockOptions.isInstalled.mockResolvedValue(false);

      const result = await installTemplates(mockOptions);
      expect(result).toBe(false);
    });

    it("should handle missing Dockerfile", async () => {
      mockOptions.isInstalled.mockResolvedValue(true);
      vi.mocked(mockedFsPromises.access).mockRejectedValue(new Error("ENOENT"));

      const result = await installTemplates(mockOptions);
      expect(result).toBe(false);
    });

    it("should handle template already exists", async () => {
      mockOptions.isInstalled.mockResolvedValue(true);
      vi.mocked(mockedFsPromises.access).mockResolvedValue(undefined);
      mockedExeca.mockRejectedValue(new Error("already exists"));

      const result = await installTemplates(mockOptions);
      expect(result).toBe(false);
    });

    it("should create and cleanup temp files when needed", async () => {
      const tempOptions = { ...mockOptions, needsTempFile: true };
      mockOptions.isInstalled.mockResolvedValue(true);
      vi.mocked(mockedFsPromises.access).mockResolvedValue(undefined);
      vi.mocked(mockedFsPromises.copyFile).mockResolvedValue(undefined);
      vi.mocked(mockedFsPromises.unlink).mockResolvedValue(undefined);
      mockedExeca.mockResolvedValue({ stdout: "success", stderr: "" } as any);

      const result = await installTemplates(tempOptions);
      expect(result).toBe(true);
      expect(mockedFsPromises.copyFile).toHaveBeenCalled();
      expect(mockedFsPromises.unlink).toHaveBeenCalled();
    });

    it("should install all templates when none selected", async () => {
      // undefined selectedTemplates should install all templates
      const allTemplatesOptions = { ...mockOptions, selectedTemplates: undefined };
      mockOptions.isInstalled.mockResolvedValue(true);
      vi.mocked(mockedFsPromises.access).mockResolvedValue(undefined);
      mockedExeca.mockResolvedValue({ stdout: "success", stderr: "" } as any);

      const result = await installTemplates(allTemplatesOptions);
      expect(result).toBe(true);
      expect(mockedExeca).toHaveBeenCalledTimes(AGENT_TEMPLATES.length);
    });

    it("should install all templates when empty array is provided", async () => {
      // Empty array should also install all templates
      const allTemplatesOptions = { ...mockOptions, selectedTemplates: [] };
      mockOptions.isInstalled.mockResolvedValue(true);
      vi.mocked(mockedFsPromises.access).mockResolvedValue(undefined);
      mockedExeca.mockResolvedValue({ stdout: "success", stderr: "" } as any);

      const result = await installTemplates(allTemplatesOptions);
      expect(result).toBe(true);
      expect(mockedExeca).toHaveBeenCalledTimes(AGENT_TEMPLATES.length);
    });
  });
}); 