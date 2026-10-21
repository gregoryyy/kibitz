// Driving the coach in the running page with Playwright: asking, waiting for the whole answer, and
// reading it back with the app's own check of the moves it names. Shared by scripts/flipbook.mjs
// and scripts/eval.mjs.

export const count = (page, sel) => page.locator(sel).count();

// An element's text as Markdown lines: paragraphs, list items as "- ", wrong moves struck through
// (~~Qh5~~), the check note and the usage note left out. Runs in the page. Also counts the moves the answer names:
// backed by the engine or the game, legal but not in its lines, wrong.
export function quoteOf(el) {
  const c = /** @type {HTMLElement} */ (el.cloneNode(true));
  c.querySelectorAll('.who, .check-note, .usage-note').forEach(n => n.remove());
  c.querySelectorAll('.san.invalid').forEach(n => { n.textContent = `~~${n.textContent}~~`; });
  const lines = [];
  const walk = n => {
    for (const k of n.children) {
      if (k.matches('ul, ol')) k.querySelectorAll(':scope > li').forEach(li => lines.push('- ' + li.textContent.trim()));
      else if (k.matches('p, h3, h4, li, blockquote')) lines.push(k.textContent.trim());
      else if (k.children.length) walk(k);
      else if (k.textContent.trim()) lines.push(k.textContent.trim());
    }
  };
  walk(c);
  if (!lines.length && c.textContent.trim()) lines.push(c.textContent.trim());
  const sans = el.querySelectorAll('.san');
  return {
    text: lines.filter(Boolean).join('\n\n'),
    checks: { all: sans.length, invalid: el.querySelectorAll('.san.invalid').length, unchecked: el.querySelectorAll('.san.unchecked').length },
  };
}

// Waits until the coach has a new message (more than `before`) and has finished writing it,
// scrolls it into view in the dialogue and returns it as a quote. `error` is the gateway's error
// code when the coach answered with an error message instead (rate_limited, auth_failed, ...).
export async function answer(page, before) {
  await page.waitForFunction(n => document.querySelectorAll('#chat .msg.coach').length > n, before, { timeout: 180_000 });
  await page.waitForFunction(() => !document.querySelector('#chat .msg.coach.thinking'), null, { timeout: 180_000 });
  await page.locator('#coachStop').waitFor({ state: 'hidden', timeout: 180_000 });
  const last = page.locator('#chat .msg.coach').last();
  // Comments stream without the Stop button, so also wait until the text has stopped changing.
  for (let prev = '', same = 0; same < 4; await page.waitForTimeout(500)) {
    const now = await last.textContent();
    same = now === prev ? same + 1 : 0; prev = now;
  }
  await last.evaluate(el => el.scrollIntoView({ block: 'start' }));
  const who = await last.locator('.who').textContent().catch(() => 'Coach');
  return { who, error: await last.getAttribute('data-error'), ...(await last.evaluate(quoteOf)) };
}

export const coachCount = page => count(page, '#chat .msg.coach');

// Asks the coach, by a quick-question chip with this label or as a typed question, and waits for the whole answer.
export async function ask(page, text) {
  const before = await coachCount(page);
  const chip = page.locator('#coachChips .chip', { hasText: text });
  if (await chip.count()) await chip.first().click();
  else { await page.fill('#coachInput', text); await page.click('#coachSend'); }
  const a = await answer(page, before);
  return { question: (await page.locator('#chat .msg.user').last().textContent()).trim(), ...a };
}

