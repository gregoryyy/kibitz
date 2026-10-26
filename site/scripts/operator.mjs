// One-time explicit setup. The generated secret stays in its private file, never stdout.
import { initializeOperator } from '../server/operator.mjs';
import { serverErrorEvent } from '../server/logging.mjs';
if (process.argv.length !== 3 || !process.argv[2] || process.argv[2].startsWith('-')) {
  console.error('Usage: node scripts/operator.mjs PRIVATE_OPERATOR_JSON'); process.exitCode = 1;
} else {
  try { initializeOperator(process.argv[2]); console.log('Local operator initialized. Keep the private identity file and its secret outside public directories and Git.'); }
  catch (error) { console.error(serverErrorEvent(error)); process.exitCode = 1; }
}
