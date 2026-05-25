import { ProcessingQueueManager } from '../ProcessingQueueManager';
import { SynthesisService } from '../SynthesisService';
import { ContextManager } from '../../ContextManager';

jest.mock('../SynthesisService');
jest.mock('../../ContextManager');

describe('ProcessingQueueManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ProcessingQueueManager.resetForTests();
    (ContextManager.readContext as jest.Mock).mockResolvedValue([]);
    (ContextManager.appendThought as jest.Mock).mockResolvedValue(undefined);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Test',
      refinedText: 'Refined',
      tags: [],
    });
  });

  it('should add items to queue and update size', () => {
    ProcessingQueueManager.addToQueue('Test transcript');
    expect(ProcessingQueueManager.getQueueSize()).toBe(1);
  });

  it('should process items and update context', async () => {
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Test',
      refinedText: 'Refined',
      tags: []
    });
    ProcessingQueueManager.addToQueue('Final test');
    
    // Wait for the async processNext (which has a timeout)
    await new Promise<void>(resolve => setTimeout(resolve, 100));
    
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Test', 'Refined');
    expect(ProcessingQueueManager.getQueueSize()).toBe(0);
  });
});
