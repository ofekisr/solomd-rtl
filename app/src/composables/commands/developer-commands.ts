import { openInspector, reloadWithInspector } from '../../lib/devtools';
import type { Command, CommandCtx } from './command-types.ts';

export function developerCommands(ctx: CommandCtx): Command[] {
  const { toasts } = ctx;
  return [
    {
      id: 'dev.reloadWithInspector',
      title: 'Developer: Reload with Web Inspector',
      hint: 'Reload the window and open the Web Inspector (debug console, elements, network)',
      run: () => reloadWithInspector(),
    },
    {
      id: 'dev.openInspector',
      title: 'Developer: Open Web Inspector',
      run: async () => {
        try {
          await openInspector();
        } catch (e) {
          toasts.warning(`Web Inspector unavailable: ${e}`);
        }
      },
    },
  ];
}
