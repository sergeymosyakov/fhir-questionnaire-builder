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
- **Cloudflare Worker** (`fhir-cors-proxy`) — proxies requests to public FHIR terminology servers (e.g. tx.fhir.org). It forwards requests only to allowlisted FHIR server URLs and does not store any data.
