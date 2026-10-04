import type { AssistantReply } from '@/types';

import { buildAssistantMessages, isCloudAIConfigured, requestCloudAssistant } from './cloud';
import { offlineReply, type OfflineReplyInput } from './offline';

export { isCloudAIConfigured } from './cloud';

export type AskAssistantInput = Omit<OfflineReplyInput, 'now'>;

const CLOUD_FALLBACK_NOTE = '📴 Couldn’t reach the cloud study buddy, so here’s my offline answer.\n\n';

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * Answers a study-buddy request. Uses the cloud proxy when configured and
 * falls back to the on-device buddy (`source: 'offline'`) on any network,
 * timeout, HTTP or response-shape failure — so it never rejects for those.
 */
export async function askAssistant(input: AskAssistantInput): Promise<AssistantReply> {
  let cloudFailed = false;
  if (isCloudAIConfigured()) {
    try {
      const response = await requestCloudAssistant({
        mode: input.mode,
        messages: buildAssistantMessages(input.history, input.prompt),
        context: input.context,
      });
      return { ...response, source: 'cloud' };
    } catch (error) {
      cloudFailed = true;
      if (__DEV__) console.warn('[ai] Cloud assistant unavailable — answering offline.', describeError(error));
    }
  }

  try {
    const reply = offlineReply(input);
    return cloudFailed ? { ...reply, text: CLOUD_FALLBACK_NOTE + reply.text } : reply;
  } catch (error) {
    if (__DEV__) console.warn('[ai] Offline buddy failed.', describeError(error));
    return {
      text: 'Sorry — I tripped over that one. Try rephrasing, or ask me for a revision plan.',
      ...(input.mode === 'mcq' ? { mcqs: [] } : {}),
      source: 'offline',
    };
  }
}
