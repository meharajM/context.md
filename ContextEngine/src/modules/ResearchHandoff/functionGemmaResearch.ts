import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import { NativeModules, Platform } from 'react-native';

import { FUNCTION_GEMMA_MODEL_ID, SYNTHESIS_MODEL_CATALOG, toLiteRtModelConfig } from '../SynthesisEngine/models';

const TOOL_NAME = 'prepare_chatgpt_research';
const MAX_TASK_BYTES = 2048;

interface FunctionGemmaNativeModule {
  prepareResearchCall?(config: ReturnType<typeof toLiteRtModelConfig>, task: string): Promise<string>;
}

export interface ResearchPlan {
  query: string;
  focus: string;
}

const nativeModule = NativeModules.LiteRtModule as FunctionGemmaNativeModule | undefined;
const functionGemma = SYNTHESIS_MODEL_CATALOG.find(model => model.id === FUNCTION_GEMMA_MODEL_ID);

export async function prepareResearchPlan(task: string): Promise<ResearchPlan> {
  const cleanTask = task.trim();
  if (!cleanTask || Buffer.byteLength(cleanTask, 'utf8') > MAX_TASK_BYTES) {
    throw new Error('Enter a research task under 2 KB.');
  }
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new Error('The on-device research planner is available on iOS and Android only.');
  }
  if (!nativeModule || !functionGemma) {
    throw new Error('The on-device research planner is unavailable.');
  }
  if (typeof nativeModule.prepareResearchCall !== 'function') {
    throw new Error('Update Thought Notes to enable the on-device research planner.');
  }

  const config = toLiteRtModelConfig(functionGemma);
  if (!(await RNFS.exists(config.modelPath))) {
    throw new Error('Download FunctionGemma in Settings before starting research.');
  }

  const raw = await nativeModule.prepareResearchCall(config, cleanTask);
  let result: unknown;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error('FunctionGemma returned an unreadable research plan.');
  }
  if (!result || typeof result !== 'object') {
    throw new Error('FunctionGemma returned an invalid research plan.');
  }

  const response = result as { name?: unknown; arguments?: unknown };
  const args = response.arguments as { query?: unknown; focus?: unknown } | undefined;
  const query = typeof args?.query === 'string' ? args.query.trim() : '';
  const focus = typeof args?.focus === 'string' ? args.focus.trim() : '';
  if (response.name !== TOOL_NAME || !query || !focus || query.length > 500 || focus.length > 500) {
    throw new Error('FunctionGemma did not return the expected research handoff. Try a shorter task.');
  }

  return { query, focus };
}
