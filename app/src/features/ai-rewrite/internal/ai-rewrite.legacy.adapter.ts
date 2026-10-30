// Wave 2 shim over today's AI code. Deleted in Wave 4 (LLD E10).
import { isAiWorking } from '../../../lib/ai-activity.ts';
import { aiRewriteExtension } from '../../../lib/cm-ai-rewrite.ts';
import type { AiRewritePort } from '../contracts/ai-rewrite.port.ts';

export const legacyAiRewriteAdapter: AiRewritePort = {
  extension: (cmKey) => aiRewriteExtension(cmKey),
  isLocked: (filePath) => isAiWorking(filePath),
};
