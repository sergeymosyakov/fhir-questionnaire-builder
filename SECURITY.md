# Security Policy

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, email [sergeymosyakov@gmail.com](mailto:sergeymosyakov@gmail.com) with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 48 hours. If the issue is confirmed, a fix will be released as soon as possible.

## Scope

This is a client-side browser tool with no server-side component. All data is stored in the user's own browser (localStorage) or their own Supabase account. The publishable Supabase key in the source is intentionally public and safe to expose — Row Level Security (RLS) is enabled.
