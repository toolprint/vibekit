import { vi } from "vitest";

// Mock @daytonaio/sdk to prevent ES module compatibility issues
vi.mock("@daytonaio/sdk", () => {
  const MockDaytona = vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  }));

  return {
    Daytona: MockDaytona,
    DaytonaConfig: {},
  };
});

// Mock untildify in case it's used elsewhere
vi.mock("untildify", () => ({
  default: vi.fn((path: string) => path),
}));
