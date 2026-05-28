import { Share } from 'react-native';

import type { ThreadDetailsView } from '../../features/threads/threadTypes';

const formatThreadCaptures = (thread: ThreadDetailsView): string =>
  thread.captures
    .map(capture => {
      const source = capture.sourceTranscript
        ? `\nSource transcript: ${capture.sourceTranscript}`
        : '';
      return `- ${capture.preview}${source}`;
    })
    .join('\n');

export const formatThreadContext = (thread: ThreadDetailsView): string =>
  [
    `# ${thread.title}`,
    '',
    '## Summary',
    thread.summary,
    '',
    '## Source captures',
    formatThreadCaptures(thread),
  ].join('\n');

export const shareThreadContext = async (thread: ThreadDetailsView): Promise<void> => {
  await Share.share({
    title: `ContextEngine: ${thread.title}`,
    message: formatThreadContext(thread),
  });
};

export const shareThreadWithAiPrompt = async (thread: ThreadDetailsView): Promise<void> => {
  await Share.share({
    title: `Analyze ${thread.title}`,
    message: [
      'Analyze this local ContextEngine thread. Identify decisions, risks, next actions, and useful follow-up questions.',
      '',
      formatThreadContext(thread),
    ].join('\n'),
  });
};
