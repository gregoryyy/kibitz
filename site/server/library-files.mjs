// Operator-selected private library, independent of usage accounting.
import { createLibraryStore } from './library-store.mjs';
import { privateDatabaseFile } from './private-files.mjs';

/**
 * @param {string} filename
 * @param {string|string[]} servedRoots
 */
export function openPrivateLibrary(filename, servedRoots) {
  return createLibraryStore(privateDatabaseFile(filename, servedRoots));
}
