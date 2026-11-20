#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const marker = '// Context Engine streams iOS SHA-256 reads to bound memory for multi-gigabyte models.';
const oldBlock = `  NSData *content = [[NSFileManager defaultManager] contentsAtPath:filepath];

  NSArray *keys = [NSArray arrayWithObjects:@"md5", @"sha1", @"sha224", @"sha256", @"sha384", @"sha512", nil];

  NSArray *digestLengths = [NSArray arrayWithObjects:
    @CC_MD5_DIGEST_LENGTH,
    @CC_SHA1_DIGEST_LENGTH,
    @CC_SHA224_DIGEST_LENGTH,
    @CC_SHA256_DIGEST_LENGTH,
    @CC_SHA384_DIGEST_LENGTH,
    @CC_SHA512_DIGEST_LENGTH,
    nil];

  NSDictionary *keysToDigestLengths = [NSDictionary dictionaryWithObjects:digestLengths forKeys:keys];

  int digestLength = [[keysToDigestLengths objectForKey:algorithm] intValue];

  if (!digestLength) {
    return reject(@"Error", [NSString stringWithFormat:@"Invalid hash algorithm '%@'", algorithm], nil);
  }

  unsigned char buffer[digestLength];`;
const streamingBlock = `  NSArray *keys = [NSArray arrayWithObjects:@"md5", @"sha1", @"sha224", @"sha256", @"sha384", @"sha512", nil];

  NSArray *digestLengths = [NSArray arrayWithObjects:
    @CC_MD5_DIGEST_LENGTH,
    @CC_SHA1_DIGEST_LENGTH,
    @CC_SHA224_DIGEST_LENGTH,
    @CC_SHA256_DIGEST_LENGTH,
    @CC_SHA384_DIGEST_LENGTH,
    @CC_SHA512_DIGEST_LENGTH,
    nil];

  NSDictionary *keysToDigestLengths = [NSDictionary dictionaryWithObjects:digestLengths forKeys:keys];

  int digestLength = [[keysToDigestLengths objectForKey:algorithm] intValue];

  if (!digestLength) {
    return reject(@"Error", [NSString stringWithFormat:@"Invalid hash algorithm '%@'", algorithm], nil);
  }

  ${marker}
  if ([algorithm isEqualToString:@"sha256"]) {
    NSInputStream *stream = [NSInputStream inputStreamWithFileAtPath:filepath];
    [stream open];
    CC_SHA256_CTX context;
    CC_SHA256_Init(&context);
    uint8_t chunk[64 * 1024];
    NSInteger bytesRead = 0;
    while ((bytesRead = [stream read:chunk maxLength:sizeof(chunk)]) > 0) {
      CC_SHA256_Update(&context, chunk, (CC_LONG)bytesRead);
    }
    NSError *streamError = stream.streamError;
    [stream close];
    if (bytesRead < 0 || streamError != nil) {
      if (streamError == nil) {
        streamError = [NSError errorWithDomain:@"RNFSHash" code:1 userInfo:nil];
      }
      return [self reject:reject withError:streamError];
    }

    unsigned char digest[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256_Final(digest, &context);
    NSMutableString *output = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
    for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
      [output appendFormat:@"%02x", digest[i]];
    }
    resolve(output);
    return;
  }

  NSData *content = [[NSFileManager defaultManager] contentsAtPath:filepath];
  unsigned char buffer[digestLength];`;

function replaceOnce(source, before, after) {
  assert.strictEqual(source.split(before).length - 1, 1, 'RNFS hash source changed; audit before patching');
  return source.replace(before, after);
}

function patch(source) {
  if (source.includes(marker)) {
    assert(source.includes('CC_SHA256_Update(&context, chunk, (CC_LONG)bytesRead)'), 'RNFS streaming hash patch is incomplete');
    if (source.includes('uint8_t chunk[1024 * 1024];')) {
      return replaceOnce(source, 'uint8_t chunk[1024 * 1024];', 'uint8_t chunk[64 * 1024];');
    }
    assert(source.includes('uint8_t chunk[64 * 1024];'), 'RNFS streaming hash buffer is not bounded for the iOS worker stack');
    return source;
  }
  return replaceOnce(source, oldBlock, streamingBlock);
}

const sourcePath = path.resolve(__dirname, '../node_modules/react-native-fs/RNFSManager.m');
const source = fs.readFileSync(sourcePath, 'utf8');
const patched = patch(source);
if (process.argv.includes('--selfcheck')) {
  assert(patched.includes(marker), 'RNFS iOS SHA-256 is not streaming');
  assert(patched.includes('uint8_t chunk[64 * 1024];'), 'RNFS iOS SHA-256 buffer exceeds the worker stack budget');
  assert(!patched.includes('uint8_t chunk[1024 * 1024];'), 'RNFS iOS SHA-256 uses an unsafe stack buffer');
  const migrated = patch(patched.replace('uint8_t chunk[64 * 1024];', 'uint8_t chunk[1024 * 1024];'));
  assert(migrated.includes('uint8_t chunk[64 * 1024];'), 'RNFS iOS SHA-256 does not upgrade the previous stack buffer');
  assert.strictEqual(patch(migrated), migrated, 'RNFS iOS SHA-256 patch is not idempotent');
  process.stdout.write('RNFS iOS SHA-256 streaming patch is ready.\n');
} else if (patched !== source) {
  fs.writeFileSync(sourcePath, patched);
}
