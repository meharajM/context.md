import fs from 'react-native-fs';

import { ContextManager } from '../index';

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  moveFile: jest.fn(),
  unlink: jest.fn(),
}));

describe('ContextManager', () => {
  const mockPath = '/mock/context.md';

  beforeEach(() => {
    jest.clearAllMocks();
    ContextManager.setPath(mockPath);
  });

  it('returns empty sections when the file is missing', async () => {
    (fs.exists as jest.Mock).mockResolvedValue(false);

    const result = await ContextManager.readContext();

    expect(result).toEqual([]);
  });

  it('returns empty sections when the path has not been configured', async () => {
    ContextManager.setPath('');

    const result = await ContextManager.readContext();

    expect(result).toEqual([]);
    expect(fs.exists).not.toHaveBeenCalled();
  });

  it('parses sections correctly', async () => {
    const markdown = `# Title\n\n## Ideas\n- Idea 1\n\n## Projects\n- Project 1\n`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(markdown);

    const result = await ContextManager.readContext();

    expect(result).toHaveLength(2);
    expect(result[0].header).toBe('Ideas');
    expect(result[1].header).toBe('Projects');
  });

  it('matches existing sections case-insensitively', async () => {
    const initialMarkdown = `# Title\n\n## ideas\n- Idea 1`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    await ContextManager.appendThought('  IDEAS  ', 'New Idea');

    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[0]).toBe(`${mockPath}.tmp`);
    expect(writeCall[1]).toContain('## ideas');
    expect(writeCall[1]).toContain('Idea 1');
    expect(writeCall[1]).toContain('New Idea');
    expect(fs.moveFile).toHaveBeenCalledWith(`${mockPath}.tmp`, mockPath);
  });

  it('normalizes blank topics to Inbox', async () => {
    (fs.exists as jest.Mock).mockResolvedValue(false);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    await ContextManager.appendThought('   ', 'Fallback note');

    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[1]).toContain('## Inbox');
    expect(writeCall[1]).toContain('Fallback note');
  });

  it('uses atomic write when moveFile is available', async () => {
    const initialMarkdown = `# Title\n\n## Ideas\n- Idea 1`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.moveFile as jest.Mock).mockResolvedValue(undefined);

    await ContextManager.appendThought('Ideas', 'Atomic save');

    expect(fs.writeFile).toHaveBeenCalledWith(`${mockPath}.tmp`, expect.any(String), 'utf8');
    expect(fs.moveFile).toHaveBeenCalledWith(`${mockPath}.tmp`, mockPath);
  });
});
