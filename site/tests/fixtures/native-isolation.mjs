// Synthetic test preload: inspect only descriptor readability, never file contents.
// Intercept the actual listener so an unrestricted bootstrap cannot supply proof.
import fs from 'node:fs';
import { Server } from 'node:net';
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  const files = JSON.parse(process.env.KIBITZ_NATIVE_PROBE_PATHS || '[]');
  let readable = 0;
  for (const file of files) {
    let fd;
    try { fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK || 0)); readable++; }
    catch (error) { if (!['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR'].includes(error.code)) throw Error('Unexpected metadata probe failure', { cause: error }); }
    finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  console.log('Native source metadata: ' + (readable ? 'readable' : 'unavailable'));
  return listen.apply(this, args);
};
