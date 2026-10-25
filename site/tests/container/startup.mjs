// In container CI, Chromium can abort its first module graph with a network-change
// notification. Recover that exact infrastructure event once; preserve all other failures.
export async function openContainerApp(page, url, openApp) {
  const origin = new URL(url).origin;
  let changed = false, otherFailure = false;
  const localScript = request => request.resourceType() === 'script' && new URL(request.url()).origin === origin;
  const failed = request => {
    if (!localScript(request)) return;
    if (request.failure()?.errorText === 'net::ERR_NETWORK_CHANGED') changed = true;
    else otherFailure = true;
  };
  const response = result => { if (localScript(result.request()) && result.status() >= 400) otherFailure = true; };
  const pageError = () => { otherFailure = true; };
  page.on('requestfailed', failed);
  page.on('response', response);
  page.on('pageerror', pageError);
  try {
    try { await openApp(page, url); return false; }
    catch (error) {
      // The shared fixture records CSP in the page. Inspect it before a navigation could
      // replace that record, so recovering a network event cannot erase a policy failure.
      if (!changed || otherFailure) throw error;
      const csp = await page.evaluate('window.__csp').catch(() => null);
      if (!Array.isArray(csp) || csp.length) throw error;
      await openApp(page, url);
      return true;
    }
  } finally {
    page.off('requestfailed', failed);
    page.off('response', response);
    page.off('pageerror', pageError);
  }
}
