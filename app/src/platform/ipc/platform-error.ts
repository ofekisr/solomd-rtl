export class PlatformUnsupportedError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    super(`[platform] ${operation} is not supported on this platform`);
    this.name = 'PlatformUnsupportedError';
    this.operation = operation;
  }
}
