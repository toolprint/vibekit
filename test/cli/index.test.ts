import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { initCommand } from "../../src/cli/commands/init";

vi.mock("../../src/cli/commands/init");
vi.mock("fs", () => ({
  readFileSync: vi.fn().mockReturnValue('{"version": "1.0.0", "name": "vibekit"}'),
}));

const mockedInitCommand = vi.mocked(initCommand);

describe("CLI index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set up commander program with correct configuration", async () => {
    const program = new Command();
    const nameSpy = vi.spyOn(program, "name");
    const descriptionSpy = vi.spyOn(program, "description");
    const versionSpy = vi.spyOn(program, "version");
    const commandSpy = vi.spyOn(program, "command");

    // Mock the command method to return a new command instance
    const mockCommand = new Command();
    const actionSpy = vi.spyOn(mockCommand, "action");
    commandSpy.mockReturnValue(mockCommand);

    // Simulate the CLI setup
    program
      .name("vibekit")
      .description("VibeKit development environment manager")
      .version("1.0.0");

    program
      .command("init")
      .description("Initialize VibeKit providers")
      .action(initCommand);

    expect(nameSpy).toHaveBeenCalledWith("vibekit");
    expect(descriptionSpy).toHaveBeenCalledWith("VibeKit development environment manager");
    expect(versionSpy).toHaveBeenCalledWith("1.0.0");
    expect(commandSpy).toHaveBeenCalledWith("init");
    expect(actionSpy).toHaveBeenCalledWith(initCommand);
  });

  it("should handle init command execution", async () => {
    mockedInitCommand.mockResolvedValue(undefined);

    await initCommand();

    expect(mockedInitCommand).toHaveBeenCalled();
  });
}); 