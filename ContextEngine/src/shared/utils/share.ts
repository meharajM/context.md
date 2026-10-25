import { Share } from 'react-native';

import type { ThreadDetailsView } from '../../features/threads/threadTypes';

const formatThreadCaptures = (thread: ThreadDetailsView): string =>
  thread.captures
    .map(capture => {
      const source = capture.typeLabel === 'VOICE NOTE' && capture.sourceTranscript
        ? `\nWords from recording: ${capture.sourceTranscript}`
        : '';
      return `- ${capture.preview}${source}`;
    })
    .join('\n');

export const formatThreadContext = (thread: ThreadDetailsView): string =>
  [
    `# ${thread.title}`,
    '',
    '## Recent notes',
    thread.summary,
    '',
    '## Original notes',
    formatThreadCaptures(thread),
  ].join('\n');

export const shareThreadContext = async (thread: ThreadDetailsView): Promise<void> => {
  await Share.share({
    title: `Thought Notes: ${thread.title}`,
    message: formatThreadContext(thread),
  });
};

export const shareThreadWithAiPrompt = async (thread: ThreadDetailsView): Promise<void> => {
  await Share.share({
    title: `Review ${thread.title}`,
    message: [
      'Please review these notes and list decisions, risks, next steps, and useful questions.',
      '',
      formatThreadContext(thread),
    ].join('\n'),
  });
};
