export interface OperationBus { fire: (name: string, ...args: unknown[]) => void }

const OPERATION_EVENT = 'operation';

export function runAsOneOperation(bus: OperationBus, work: () => boolean, event: Record<string, unknown>): void {
  const fire = bus.fire;
  let isMuted = true;
  bus.fire = (name, ...args) => {
    if (isMuted && name === OPERATION_EVENT) return;
    fire.call(bus, name, ...args);
  };
  try {
    if (!work()) return;
    isMuted = false;
    fire.call(bus, OPERATION_EVENT, event);
  } finally {
    bus.fire = fire;
  }
}

export async function runAsOneOperationAsync(bus: OperationBus, work: () => Promise<boolean>, event: Record<string, unknown>): Promise<void> {
  const fire = bus.fire;
  bus.fire = (name, ...args) => { if (name !== OPERATION_EVENT) fire.call(bus, name, ...args); };
  try {
    if (!(await work())) return;
  } finally {
    bus.fire = fire;
  }
  fire.call(bus, OPERATION_EVENT, event);
}
