import { ContextManager } from '../index';
import fs from 'react-native-fs';

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

describe('ContextManager', () => {
  const mockPath = '/mock/context.md';

  beforeEach(() => {
    jest.clearAllMocks();
    ContextManager.setPath(mockPath);
  });

  it('should parse an empty file or missing file as empty array', async () => {
    (fs.exists as jest.Mock).mockResolvedValue(false);
    const result = await ContextManager.readContext();
    expect(result).toEqual([]);
  });

  it('should parse sections correctly', async () => {
    const markdown = `# Title\n\n## Ideas\n- Idea 1\n\n## Projects\n- Project 1\n`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(markdown);

    const result = await ContextManager.readContext();
    expect(result).toHaveLength(2);
    expect(result[0].header).toBe('Ideas');
    expect(result[1].header).toBe('Projects');
  });

  it('should append a thought to an existing section', async () => {
    const initialMarkdown = `# Title\n\n## Ideas\n- Idea 1`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    await ContextManager.appendThought('Ideas', 'New Idea');

    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[1]).toContain('## Ideas');
    expect(writeCall[1]).toContain('Idea 1');
    expect(writeCall[1]).toContain('New Idea');
  });

  it('should create a new section if it does not exist', async () => {
    const initialMarkdown = `# Title\n\n## Ideas\n- Idea 1`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);

    await ContextManager.appendThought('Tasks', 'New Task');

    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[1]).toContain('## Ideas');
    expect(writeCall[1]).toContain('## Tasks');
    expect(writeCall[1]).toContain('New Task');
  });
});
