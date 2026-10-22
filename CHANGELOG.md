# Changelog

## 0.1.0

First release.

- Thirteen checks in four groups (email, DNS, websites, vulnerability disclosure), one engine shared by the site, the command line tool, the weekly scan and the MCP server.
- Inventory of every registrable domain under the government, education, health, business, non-profit and network suffixes of the six Arabian Gulf states (36 suffixes), from Certificate Transparency logs and the Tranco list. Military, embassy and personal suffixes are left out on purpose.
- Weekly scan with resolver cross checks, a second pass for anything inconclusive, totals by country, sector and check, a weekly series and open CSV and JSON. No domain is named next to a result.
- Bilingual site, Arabic first, printed like an annual report over NASA night photographs of the six states: every page printed to HTML when an issue comes out, Arabic at the root and English under `/en/`, a page for each state, each of the thirteen standards and each issue, six figures to quote with citations in both languages whose links open the issue page they come from, a reference and a BibTeX entry for every issue, a dataset description and a sitemap of every page for search engines, and a live DNS check that runs in the browser. Every section hangs from the same two edges: its heading, its note and its sector tabs on the margin the page reads from, its body from the axis, and on a phone the two edges become one. Every figure on the site sits in the same row, the figure first on that edge, what it measures beside it, and its count or its citation under the words, so a reader never crosses the screen inside one row. The sector tabs are a grid of equal cells, every list of tabs on a page follows one choice, and the line under the figures counts the domains of the sector shown. The page of each standard sets its numbers (the share, each sector and what the measurement found) beside its explanation.
- The home page shows the Gulf as a whole and each state has a page of its own figures. Nothing on the site, in the MCP server or in the run summary sets the states side by side or ranks them.
- Shares carry one decimal everywhere, like the open data, and counts are grouped by thousands in both languages.
- Issue 1, published on 16 October 2026, measures 11,919 live domains under the 36 suffixes.
- Command line tool for the full check of any domain, and an MCP server with six read only tools.
- Weekly workflow that runs by itself every Monday and whenever the scope changes: it refreshes the inventory, scans it across six runners, tests what it is about to publish, commits the new issue, archives it as a release with its open data and asks Pages to publish it, with a totals only summary on the job page, and a test workflow for every change.
- Domains can be left out at their administrators' request through the exclude list in `data/src/scope.json`.
- The inventory of names is the weekly run's working data: it passes from one run to the next as an artifact and is never committed, so the repository and the site hold totals only.
- The Arabian Gulf is called by its name in every language the project speaks. A test reads every file, every credit and the metadata inside every picture, and each photograph is chosen only after reading its source page.
