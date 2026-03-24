import { ProcessingQueueManager } from '../ProcessingQueueManager';
import { SynthesisService } from '../SynthesisService';
import { ContextManager } from '../../ContextManager';

jest.mock('../SynthesisService');
jest.mock('../../ContextManager');

describe('ProcessingQueueManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Access private queue for testing if needed or just use public API
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
    (ContextManager.readContext as jest.Mock).mockResolvedValue([]);

    ProcessingQueueManager.addToQueue('Final test');
    
    // Wait for the async processNext (which has a timeout)
    await new Promise(r => setTimeout(r, 5000));
    
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Test', 'Refined');
    expect(ProcessingQueueManager.getQueueSize()).toBe(0);
  });
});
