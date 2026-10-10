/**
 * Smoke test for the dev shell on a phone-sized viewport, for every song:
 *  - Demo mode steps the big id through F01..F08 in order
 *  - the accent bar grows within each line
 *  - a seek leaves the correct line on screen
 *  - no console errors
 * Fixture timeline: src/core/__fixtures__/lines.ts (synthetic ids, no lyrics).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

const SONGS = ['101', 'kaha-tak'] as const;
const EXPECTED = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08'];
const GAP = '···';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Set a React-controlled range input the way a user would (native setter + input event). */
async function setRange(scrub: Locator, value: number): Promise<void> {
  await scrub.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

const barWidth = (bar: Locator) => bar.evaluate((el) => parseFloat((el as HTMLElement).style.width));

/** Read id and bar width in ONE round-trip so both come from the same frame. */
const sample = (page: Page) =>
  page.evaluate(() => {
    const id = document.querySelector('[data-testid="active-id"]')?.textContent ?? '';
    const bar = document.querySelector<HTMLElement>('[data-testid="progress-bar"]');
    return { id: id.trim(), w: parseFloat(bar?.style.width ?? '0') };
  });

for (const song of SONGS) {
  test(`demo mode on ${song}: ids in order, bar grows, seek lands, no console errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/?song=${song}`);

    const id = page.getByTestId('active-id');
    const bar = page.getByTestId('progress-bar');
    const demo = page.getByTestId('demo');
    const scrub = page.getByTestId('scrub');
    const status = page.getByTestId('status');

    await expect(page.getByTestId('song-select')).toHaveValue(song);
    await expect(id).toHaveText(GAP);
    await expect(status).toContainText('fixture timeline');

    await demo.click();
    await expect(status).toContainText('playing');

    // Sample the UI at ~25 Hz for one full fixture run (12 s) and record what we saw.
    const seen: string[] = [];
    const widths = new Map<string, number[]>();
    const deadline = Date.now() + 14_000;
    while (Date.now() < deadline) {
      const { id: cur, w } = await sample(page);
      if (cur !== seen[seen.length - 1]) seen.push(cur);
      if (cur !== GAP && cur !== '') {
        const arr = widths.get(cur) ?? [];
        arr.push(w);
        widths.set(cur, arr);
      }
      if (seen.includes('F08') && cur === GAP) break; // gap after F08 ends at 11.5 s
      await page.waitForTimeout(40);
    }

    const ids = seen.filter((s) => s !== GAP && s !== '');
    expect(ids.slice(0, EXPECTED.length), `sequence seen: ${seen.join(' ')}`).toEqual(EXPECTED);

    for (const lineId of EXPECTED) {
      const ws = widths.get(lineId) ?? [];
      expect(ws.length, `${lineId} samples`).toBeGreaterThan(2);
      expect(ws[ws.length - 1] ?? 0, `${lineId} bar end > start`).toBeGreaterThan(ws[0] ?? 0);
      for (let i = 1; i < ws.length; i++) {
        expect(ws[i] ?? 0, `${lineId} bar non-decreasing at sample ${i}`).toBeGreaterThanOrEqual((ws[i - 1] ?? 0) - 0.01);
      }
    }

    // Demo off pauses the clock; seeks must land on the right line immediately.
    await demo.click();
    await expect(status).toContainText('paused');

    await setRange(scrub, 6000); // F05 is [5500, 6500) -> progress 0.5
    await expect(id).toHaveText('F05');
    expect(await barWidth(bar)).toBeCloseTo(50, 0);

    await setRange(scrub, 5000); // gap between F04 and F05
    await expect(id).toHaveText(GAP);

    await setRange(scrub, 9000); // F08 is [8500, 11500) -> progress 1/6
    await expect(id).toHaveText('F08');
    expect(await barWidth(bar)).toBeCloseTo(100 / 6, 0);

    await setRange(scrub, 1000); // backwards: F01 [500, 1500)
    await expect(id).toHaveText('F01');

    expect(errors, `console errors: ${errors.join('\n')}`).toEqual([]);
  });
}
