export interface OpenerPort {
  openUrl(url: string): Promise<void>;
  openPath(path: string): Promise<void>;
  revealItemInDir(path: string): Promise<void>;
}
