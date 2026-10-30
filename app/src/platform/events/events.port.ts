export type UnlistenFn = () => void;

export interface PlatformEvent<T> {
  event: string;
  id: number;
  payload: T;
}

export interface EventsPort {
  listen<T>(event: string, handler: (event: PlatformEvent<T>) => void): Promise<UnlistenFn>;
}
