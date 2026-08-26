# Security Policy

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, email [sergeymosyakov@gmail.com](mailto:sergeymosyakov@gmail.com) with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 48 hours. If the issue is confirmed, a fix will be released as soon as possible.

## Scope

This is primarily a client-side browser tool. Backend components:

- **Supabase** — stores questionnaires per user; protected by Row Level Security (RLS). The publishable Supabase key in the source is intentionally public and safe to expose — users can only access their own data.
- **Cloudflare Worker** (`fhir-cors-proxy`, source: `scripts/cors-proxy.worker.js`) — CORS proxy for FHIR terminology, `$populate`, and Patient-search requests. Restricts by request **path** (substring allowlist), not by target host. Forwards an incoming `Authorization` header upstream as-is when present (issue #63); does not store any data.
