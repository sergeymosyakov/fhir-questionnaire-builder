// Links to the site's other pages, shown on the empty builder next to the Quick tour pointer.
export const EXPLORE_LINKS = [
  { id: 'docs', label: 'Documentation', href: 'docs.html' },
  { id: 'help', label: 'Field reference', href: 'help.html' },
  { id: 'templates', label: 'Templates', href: 'templates.html' },
  { id: 'gallery', label: 'Calculation gallery', href: 'gallery.html' },
  { id: 'widget', label: 'Widget demo', href: 'widget-demo.html' },
];

// Static constants only, so the result is safe to assign to innerHTML.
export const exploreLinksHtml = () =>
  EXPLORE_LINKS.map(l => `<a href="${l.href}" data-testid="preview-placeholder-link-${l.id}">${l.label}</a>`).join(' &middot; ');
