export interface DialogFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogOptions {
  title?: string;
  filters?: DialogFilter[];
  defaultPath?: string;
  multiple?: boolean;
  directory?: boolean;
}

export interface SaveDialogOptions {
  title?: string;
  filters?: DialogFilter[];
  defaultPath?: string;
  canCreateDirectories?: boolean;
}

export interface DialogPort {
  open(options?: OpenDialogOptions): Promise<string | string[] | null>;
  save(options?: SaveDialogOptions): Promise<string | null>;
}
