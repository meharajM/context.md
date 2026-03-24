import { ContextManager } from './src/modules/ContextManager';
import fs from 'fs';
import path from 'path';

// Mocking react-native-fs behavior for node
jest.mock('react-native-fs', () => ({
  exists: async (p: string) => fs.existsSync(p),
  readFile: async (p: string) => fs.readFileSync(p, 'utf8'),
  writeFile: async (p: string, c: string) => fs.writeFileSync(p, c, 'utf8'),
}));

async function testContextManager() {
  const testFile = path.join(__dirname, 'test_context.md');
  ContextManager.setPath(testFile);

  console.log('--- Test 1: Append Thought ---');
  await ContextManager.appendThought('Ideas', 'Test idea 1');
  await ContextManager.appendThought('Projects', 'Test project 1');
  
  const content = fs.readFileSync(testFile, 'utf8');
  console.log('File Content:\n', content);

  console.log('--- Test 2: Read Context ---');
  const sections = await ContextManager.readContext();
  console.log('Parsed Sections:', JSON.stringify(sections, null, 2));

  if (sections.length === 2 && sections[0].header === 'Ideas' && sections[1].header === 'Projects') {
    console.log('✅ ContextManager tests passed!');
  } else {
    console.error('❌ ContextManager tests failed!');
    process.exit(1);
  }

  fs.unlinkSync(testFile);
}

testContextManager();
