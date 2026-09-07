// Shared terminology-expansion network mock for e2e specs.
//
// A fixture whose answerValueSet/unitValueSet points at a real or fake external
// host races the app's fire-and-forget expandAll() call: if the failure
// resolves before the test's own interactions, it opens a page-covering
// "ValueSet Expansion Errors" modal (CI-only flakiness, since resolve timing
// differs by environment). Mock the proxy call so import never hits the network.

/** Intercept all requests through the app's CORS proxy with an empty-but-valid ValueSet. */
export async function mockTerminologyExpand(page) {
  await page.route(url => url.hostname === 'fhir-cors-proxy.sergeymosyakov.workers.dev', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/fhir+json',
      body: JSON.stringify({ resourceType: 'ValueSet', expansion: { contains: [] } }),
    });
  });
}
