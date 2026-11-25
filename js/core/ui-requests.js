// How modules below the UI ask for something to be shown: the UI layer listens for these events.
import { AppEvents } from '../events.js';

const send = (type, detail) => {
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent(type, { detail }));
};

export const notifyError = (message) => send(AppEvents.NOTIFY_REQUESTED, { message, type: 'error' });
export const notifyWarn  = (message) => send(AppEvents.NOTIFY_REQUESTED, { message, type: 'warn' });
export const notifyInfo  = (message) => send(AppEvents.NOTIFY_REQUESTED, { message, type: 'info' });

/** @param {string} title @param {'import'|'export'|'validate'} mode @param {object} [options] see validate-modal show() */
export const requestValidationReport = (title, mode, options = {}) => send(AppEvents.VALIDATION_REPORT_REQUESTED, { title, mode, ...options });

export const showProgress = (label) => send(AppEvents.PROGRESS_SHOW, { label });
export const hideProgress = () => send(AppEvents.PROGRESS_HIDE, {});

/** @returns {Promise<'proceed'|'cancel'>} 'proceed' when nothing in the page answers (the listener marks the request handled) */
export const confirmLoadReplace = () => new Promise((resolve) => {
  const request = { resolve, handled: false };
  send(AppEvents.LOAD_REPLACE_CONFIRM_REQUESTED, request);
  if (!request.handled) resolve('proceed');
});
