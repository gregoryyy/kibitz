// Mutate only a generated fixture policy through its descriptor, never a checked path.
import fs from 'node:fs';
export function updatePermissions(identity, allow, operator = identity.operatorId) {
  const fd = fs.openSync(identity.policy, fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW);
  try { fs.ftruncateSync(fd, 0); fs.writeFileSync(fd, JSON.stringify({ version: 1, operator, allow })); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
