// Explicit offline policy creation; no keys, paths or operator IDs are printed.
import { readOperator } from '../server/operator.mjs';
import { PERMISSIONS, initializePermissions } from '../server/permissions.mjs';
import { serverErrorEvent } from '../server/logging.mjs';
const [operatorFile, policyFile, ...grants] = process.argv.slice(2);
if (!operatorFile || !policyFile || !grants.length || grants.includes('--all') && grants.length !== 1 || grants.includes('--none') && grants.length !== 1) {
  console.error('Usage: node scripts/permissions.mjs OPERATOR_JSON POLICY_JSON (--all | --none | GRANT...)'); process.exitCode = 1;
} else {
  try {
    const operator = readOperator(operatorFile, []);
    initializePermissions(policyFile, operator, grants[0] === '--all' ? [...PERMISSIONS] : grants[0] === '--none' ? [] : grants);
    console.log('Operator permission policy created. Review its explicit grants before use.');
  } catch (error) { console.error(serverErrorEvent(error)); process.exitCode = 1; }
}
