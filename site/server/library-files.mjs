// Operator-selected private library, independent of usage accounting.
import { createLibraryStore } from './library-store.mjs';
import { privateDatabaseFile } from './private-files.mjs';

export function openPrivateLibrary(filename, staticRoot) {
  return createLibraryStore(privateDatabaseFile(filename, staticRoot));
}
