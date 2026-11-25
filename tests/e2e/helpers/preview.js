// Preview-panel helpers shared by the e2e specs.

// Commits a value typed in a preview input: blur → RESPONSE_CHANGED. Clicks the search input, a real <input>, so focus always moves.
export async function commitInput(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
