// Trusted request-local authority installed by the production session resolver.
// Check again after asynchronous work and immediately before output or mutation.
export const SESSION_GUARD = Symbol('kibitz.backend-session');
export function checkSession(req) { req[SESSION_GUARD]?.check(); }

// Serialize synchronous emission/commit boundaries with durable revocation.
export function sessionAction(target, action) { return target[SESSION_GUARD] ? target[SESSION_GUARD].run(action) : action(); }
