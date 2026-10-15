# Changelog

## 0.1.0

First release.

- Thirteen checks in four groups (email, DNS, websites, vulnerability disclosure), one engine shared by the site, the command line tool, the weekly scan and the MCP server.
- Inventory of every registrable domain under the government and education suffixes of the six Gulf states, from Certificate Transparency logs and the Tranco list.
- Weekly scan with resolver cross checks, a second pass for anything inconclusive, totals by country, sector and check, a weekly series, open CSV and JSON, and a hall of fame. No per domain failure is published.
- Bilingual site, Arabic first, with numbered weekly issues, citation slips in both languages, a register of every check by country, a page per check with why it matters and how to fix it, and a live DNS check that runs in the browser.
- Command line tool for the full check of any domain, and an MCP server with eight read only tools.
- Weekly workflow that refreshes the inventory, scans, tests what it is about to publish and commits the new issue every Monday, with a totals only summary on the job page, and a test workflow for every change.
- Domains can be left out at their administrators' request through the exclude list in `data/src/scope.json`.
