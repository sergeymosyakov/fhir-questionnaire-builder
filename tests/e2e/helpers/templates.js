// Serves tests/fixtures/templates/* as the app's /templates/* (library + template files).
import fs from 'fs';
import path from 'path';
import { FIXTURES } from './builder.js';

const TPL_DIR = path.join(FIXTURES, 'templates');

export async function serveTemplates(page, { failLibrary = false } = {}) {
  await page.route(url => url.pathname.startsWith('/templates/'), route => {
    const file = path.join(TPL_DIR, path.basename(new URL(route.request().url()).pathname));
    if (failLibrary || !fs.existsSync(file)) return route.fulfill({ status: 500, body: 'boom' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(file, 'utf8') });
  });
}
