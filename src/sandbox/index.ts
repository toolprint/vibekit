// Dynamic sandbox imports to reduce bundle size
export const createE2BSandbox = async () => {
  const { default: CodeInterpreter } = await import('@e2b/code-interpreter');
  return CodeInterpreter;
};

export const createDaytonaSandbox = async () => {
  const { Daytona } = await import('@daytonaio/sdk');
  return Daytona;
};

export const createNorthflankSandbox = async () => {
  const northflank = await import('@northflank/js-client');
  return northflank.ApiClient;
};

export type SandboxType = 'e2b' | 'daytona' | 'northflank';

export interface SandboxFactory {
  createSandbox(type: SandboxType, config: any): Promise<any>;
}

export class DynamicSandboxFactory implements SandboxFactory {
  async createSandbox(type: SandboxType, _config: any): Promise<any> {
    switch (type) {
      case 'e2b':
        return createE2BSandbox();
      case 'daytona':
        return createDaytonaSandbox();
      case 'northflank':
        return createNorthflankSandbox();
      default:
        throw new Error(`Unsupported sandbox type: ${type}`);
    }
  }
}