// What every public page says about itself: which product it belongs to and who made it (meta and JSON-LD).
import { AUTHORS } from './copyright.js';

export const BRAND_NAME = 'FHIR Questionnaire Builder';
export const AUTHOR_NAMES = AUTHORS.map((a) => a.name).join(', ');
export const AUTHORS_LD = AUTHORS.map((a) => ({ '@type': 'Person', name: a.name, url: a.url }));

const logo = (root, size) => `<img class="page-brand-logo" src="${root}favicon.svg" alt="" width="${size}" height="${size}" data-testid="page-brand-logo">`;

/** Header mark: the logo and the name in two lines ("FHIR Questionnaire" over "Builder"), so it fits a phone. `root` is the relative path back to the site root. */
export const brandLinkHtml = (root = '') => `<a class="page-brand" href="${root}index.html" aria-label="${BRAND_NAME}" data-testid="page-brand">${logo(root, 24)}<span class="page-brand-name" data-testid="page-brand-name"><span>FHIR Questionnaire</span> <span>Builder</span></span></a>`;
