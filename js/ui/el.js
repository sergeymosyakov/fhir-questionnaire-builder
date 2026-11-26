// Tiny DOM builder shared by the standalone check page's modules: tag, class, text content, data-testid.
export const el = (tag, className, text, testid) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  if (testid) n.dataset.testid = testid;
  return n;
};
