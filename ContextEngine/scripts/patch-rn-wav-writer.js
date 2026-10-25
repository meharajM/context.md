#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const modulePath = path.join(
  path.resolve(__dirname, '..'),
  'node_modules',
  'whisper.rn',
  'lib',
  'module',
  'utils',
  'WavFileWriter.js',
);
const marker = 'Context Engine patches WAV headers in place';

if (!fs.existsSync(modulePath)) {
  throw new Error('whisper.rn WAV writer is missing; verify the installed dependency.');
}

let source = fs.readFileSync(modulePath, 'utf8');
function finishPatch() {
  const sizeMarker = 'Context Engine derives WAV size from flushed bytes';
  if (!source.includes(sizeMarker)) {
    const oldHeader = '      const correctHeader = this.createWavHeader(this.dataSize);';
    const newHeader = `      // ${sizeMarker}; rejected appends can still have written data.
      const fileSize = Number((await this.fs.stat(this.filePath)).size);
      const blockAlign = this.config.channels * this.config.bitsPerSample / 8;
      if (!Number.isSafeInteger(fileSize) || fileSize < 44 || fileSize - 8 > 0xffffffff || (fileSize - 44) % blockAlign !== 0) {
        throw new Error('Invalid flushed WAV length');
      }
      this.dataSize = fileSize - 44;
      const correctHeader = this.createWavHeader(this.dataSize);`;
    if (source.split(oldHeader).length !== 2) throw new Error('WAV finalize source changed');
    source = source.replace(oldHeader, newHeader);
    // A rejected append can have reached disk. Retrying the same memory queue duplicates speech.
    source = source.replace('      const base64Data = uint8ArrayToBase64(combinedData);',
      '      this.writeQueue = [];\n      const base64Data = uint8ArrayToBase64(combinedData);');
  }
  fs.writeFileSync(modulePath, source, 'utf8');
}

if (source.includes(marker)) {
  if (
    source.includes('base64ToUint8Array') ||
    source.includes('console.warn(`Failed to append') ||
    source.includes('console.warn(`Failed to process') ||
    source.includes('console.warn(`Failed to finalize')
  ) {
    throw new Error('whisper.rn WAV writer patch is incomplete; audit the installed module.');
  }
  finishPatch();
  process.exit(0);
}

function replaceExactly(original, replacement) {
  if (source.split(original).length !== 2) {
    throw new Error('whisper.rn WAV writer changed; audit the audio patch.');
  }
  source = source.replace(original, replacement);
}

replaceExactly(
  "import { base64ToUint8Array, uint8ArrayToBase64 } from './common';",
  "import { uint8ArrayToBase64 } from './common';",
);
replaceExactly(
  [
    '    } catch (error) {',
    '      console.warn(`Failed to append audio data to WAV file: ${error}`);',
    '    }',
    '  }',
    '',
    '  /**',
    '   * Process the write queue to avoid blocking',
  ].join('\n'),
  [
    '    } catch (error) {',
    '      throw new Error(`Failed to append audio data to WAV file: ${error}`);',
    '    }',
    '  }',
    '',
    '  /**',
    '   * Process the write queue to avoid blocking',
  ].join('\n'),
);
replaceExactly(
  [
    '    } catch (error) {',
    '      console.warn(`Failed to process WAV write queue: ${error}`);',
    "      // Don't throw here to avoid breaking the recording",
    '    }',
    '  }',
    '',
    '  /**',
    '   * Finalize the WAV file by updating the header with correct sizes',
  ].join('\n'),
  [
    '    } catch (error) {',
    '      throw new Error(`Failed to process WAV write queue: ${error}`);',
    '    }',
    '  }',
    '',
    '  /**',
    '   * Finalize the WAV file by updating the header with correct sizes',
  ].join('\n'),
);
replaceExactly(
  [
    '      // Read the current file',
    "      const currentData = await this.fs.readFile(this.filePath, 'base64');",
    '      const currentBytes = base64ToUint8Array(currentData);',
    '',
    '      // Create the correct header with final data size',
    '      const correctHeader = this.createWavHeader(this.dataSize);',
    '',
    '      // Replace the header (first 44 bytes)',
    '      const finalData = new Uint8Array(correctHeader.length + this.dataSize);',
    '      finalData.set(correctHeader, 0);',
    '      finalData.set(currentBytes.slice(44), 44); // Skip old header',
    '',
    '      // Write the final file',
    '      const finalBase64 = uint8ArrayToBase64(finalData);',
    "      await this.fs.writeFile(this.filePath, finalBase64, 'base64');",
    '      this.isWriting = false;',
    '    } catch (error) {',
    '      console.warn(`Failed to finalize WAV file: ${error}`);',
    '    }',
  ].join('\n'),
  [
    `      // ${marker}; whole-file reads multiply peak memory use by recording length.`,
    '      const correctHeader = this.createWavHeader(this.dataSize);',
    "      await this.fs.write(this.filePath, uint8ArrayToBase64(correctHeader), 0, 'base64');",
    '      this.isWriting = false;',
    '    } catch (error) {',
    '      throw new Error(`Failed to finalize WAV file: ${error}`);',
    '    }',
  ].join('\n'),
);

finishPatch();

if (
  !source.includes(marker) ||
  source.includes('base64ToUint8Array') ||
  source.includes('console.warn(`Failed to append') ||
  source.includes('console.warn(`Failed to process') ||
  source.includes('console.warn(`Failed to finalize') ||
  !source.includes("this.fs.write(this.filePath, uint8ArrayToBase64(correctHeader), 0, 'base64')")
) {
  throw new Error('whisper.rn WAV writer patch did not pass its self-check.');
}
console.log('WAV writes now fail loudly and finalize by updating only the 44-byte header.');
