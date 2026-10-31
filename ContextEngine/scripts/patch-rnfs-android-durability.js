#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const marker = '// Context Engine opt-in durable app-private topic storage.';
const helper = `  ${marker}
  private File durableLocalFile(String filepath) throws java.io.IOException {
    File file = new File(filepath).getCanonicalFile();
    String root = reactContext.getFilesDir().getCanonicalPath() + File.separator;
    if (!new File(filepath).isAbsolute() || !file.getPath().startsWith(root)) {
      throw new java.io.IOException("Durable storage requires an app-private local file path (provider URIs unsupported)");
    }
    return file;
  }

  private void syncDurableDirectory(File directory) throws Exception {
    java.io.FileDescriptor descriptor = android.system.Os.open(directory.getPath(),
        android.system.OsConstants.O_RDONLY, 0);
    try {
      android.system.Os.fsync(descriptor);
    } finally {
      android.system.Os.close(descriptor);
    }
  }

  private void syncDurableDirectoryTree(File directory) throws Exception {
    File root = reactContext.getFilesDir().getCanonicalFile();
    for (File current = directory.getCanonicalFile(); current != null; current = current.getParentFile()) {
      syncDurableDirectory(current);
      if (current.equals(root)) return;
    }
    throw new java.io.IOException("Durable storage directory is outside app-private files");
  }

  private void syncDurableFile(File file) throws java.io.IOException {
    try (java.io.RandomAccessFile stream = new java.io.RandomAccessFile(file, "rw")) {
      stream.getFD().sync();
    }
  }

  private void writeDurableFile(String filepath, byte[] bytes) throws Exception {
    File file = durableLocalFile(filepath);
    try (java.io.FileOutputStream stream = new java.io.FileOutputStream(file)) {
      stream.write(bytes);
      stream.flush();
      stream.getFD().sync();
    }
    syncDurableDirectoryTree(file.getParentFile());
  }

  private void moveDurableFile(String filepath, String destPath) throws Exception {
    File source = durableLocalFile(filepath);
    File destination = durableLocalFile(destPath);
    if (!source.isFile()) throw new java.io.IOException("Durable move source missing");
    syncDurableFile(source);
    if (source.renameTo(destination)) {
      syncDurableFile(destination);
      syncDurableDirectoryTree(destination.getParentFile());
      if (!source.getParentFile().equals(destination.getParentFile())) syncDurableDirectoryTree(source.getParentFile());
      return;
    }
    // Retain source until copied bytes and destination directory are durable.
    try (java.io.FileInputStream input = new java.io.FileInputStream(source);
         java.io.FileOutputStream output = new java.io.FileOutputStream(destination)) {
      byte[] buffer = new byte[8192];
      int length;
      while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
      output.flush();
      output.getFD().sync();
    }
    syncDurableDirectoryTree(destination.getParentFile());
    if (!source.delete()) throw new java.io.IOException("Durable move could not remove source");
    syncDurableDirectoryTree(source.getParentFile());
  }

`;
const writeAnchor = '      OutputStream outputStream = getOutputStream(filepath, false);';
const writeInsertion = `      if (options != null && options.hasKey("durable") && options.getBoolean("durable")) {
        writeDurableFile(filepath, bytes);
        promise.resolve(null);
        return;
      }

`;
const moveAnchor = '      final File inFile = new File(filepath);';
const moveInsertion = `      if (options != null && options.hasKey("durable") && options.getBoolean("durable")) {
        moveDurableFile(filepath, destPath);
        promise.resolve(true);
        return;
      }

`;
const methodAnchor = '  @ReactMethod\n  public void writeFile(String filepath, String base64Content, ReadableMap options, Promise promise) {';
function replaceOnce(source, before, after) {
  assert.strictEqual(source.split(before).length - 1, 1, `RNFS durability patch source changed: ${before}`);
  return source.replace(before, after);
}
function patchJava(source) {
  if (source.includes(marker)) {
    for (const expected of [helper, writeInsertion + writeAnchor, moveInsertion + moveAnchor]) {
      assert(source.includes(expected), 'RNFS durability patch incomplete or modified; audit installed source');
    }
    return source;
  }
  source = replaceOnce(source, methodAnchor, helper + methodAnchor);
  source = replaceOnce(source, writeAnchor, writeInsertion + writeAnchor);
  return replaceOnce(source, moveAnchor, moveInsertion + moveAnchor);
}
function patchTypes(source) {
  const anchor = 'type FileOptions = {\n';
  const replacement = anchor + '\tdurable?: boolean // Context Engine: Android app-private local files only\n';
  return source.includes(replacement) ? source : replaceOnce(source, anchor, replacement);
}
const root = path.resolve(__dirname, '..');
const javaPath = path.join(root, 'node_modules/react-native-fs/android/src/main/java/com/rnfs/RNFSManager.java');
const typesPath = path.join(root, 'node_modules/react-native-fs/index.d.ts');
if (process.argv.includes('--selfcheck')) {
  const installed = fs.readFileSync(javaPath, 'utf8');
  const stock = installed.replace(helper, '').replace(writeInsertion, '').replace(moveInsertion, '');
  const patched = patchJava(stock);
  assert.strictEqual(patchJava(patched), patched);
  assert.throws(() => patchJava(stock.replace(writeAnchor, '// changed source')), /source changed/);
  assert.throws(() => patchJava(patched.replace('stream.flush();', '// changed partial patch')), /incomplete or modified/);
  const types = patchTypes('type FileOptions = {\n}\n');
  assert.strictEqual(patchTypes(types), types);
  assert(patched.indexOf('output.getFD().sync();') < patched.indexOf('if (!source.delete())'));
  console.log('RNFS durability patch selfcheck passed');
} else if (fs.existsSync(javaPath)) {
  // Validate every target before writing either file.
  const java = fs.readFileSync(javaPath, 'utf8');
  const types = fs.readFileSync(typesPath, 'utf8');
  const nextJava = patchJava(java);
  const nextTypes = patchTypes(types);
  if (nextJava !== java) fs.writeFileSync(javaPath, nextJava);
  if (nextTypes !== types) fs.writeFileSync(typesPath, nextTypes);
}
