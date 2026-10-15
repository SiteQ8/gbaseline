# Security

## Reporting a vulnerability in this project

Please report vulnerabilities in the scanner, the site, the command line tool or the MCP server privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for a security problem.

You can expect an acknowledgement within five working days.

## What the scanner does to the domains it measures

- DNS questions go to public resolvers, never to the measured organisations' name servers directly.
- Each website receives a handful of ordinary requests a week: the home page over HTTPS and over plain HTTP, `/.well-known/security.txt`, the MTA-STS policy file when one is announced, and a few TLS handshakes to learn which versions and key exchange groups the server accepts.
- The user agent links to the method page, so an administrator can see what the requests are.
- Nothing is attempted beyond reading public configuration: no logins, no forms, no scanning of ports other than 80 and 443, no payloads.

To ask for a domain to be removed from the inventory or added to it, open an issue. A removed domain goes on the `exclude` list in `data/src/scope.json`, after which it is neither scanned nor counted.

## Reporting a vulnerability in a measured domain

This project does not handle vulnerability reports for the organisations it measures. Use the organisation's own security.txt where it publishes one, or the national CERT of its country.
