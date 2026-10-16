# Changelog

## 0.1.0

First release.

- Thirteen checks in four groups (email, DNS, websites, vulnerability disclosure), one engine shared by the site, the command line tool, the weekly scan and the MCP server.
- Inventory of every registrable domain under the government, education, health, business, non-profit and network suffixes of the six Arabian Gulf states (36 suffixes), from Certificate Transparency logs and the Tranco list. Military, embassy and personal suffixes are left out on purpose.
- Weekly scan with resolver cross checks, a second pass for anything inconclusive, totals by country, sector and check, a weekly series and open CSV and JSON. No domain is named next to a result.
- Bilingual site, Arabic first, printed as stationery over NASA night photographs of the Arabian Gulf's cities: the week's card with its measuring scale, the Gulf's figures as a ledger aligned on the decimal point, citation slips in both languages whose links reopen the issue they quote, the weekly run printed as an itinerary, a reply card for the live DNS check that runs in the browser, and a page per check with why it matters and how to fix it.
- The home page shows the Gulf as a whole and each state has a page of its own figures. Nothing on the site, in the MCP server or in the run summary sets the states side by side or ranks them.
- Shares carry one decimal everywhere, like the open data.
- Command line tool for the full check of any domain, and an MCP server with six read only tools.
- Weekly workflow that runs by itself every Monday and whenever the scope changes: it refreshes the inventory, scans it across six runners, tests what it is about to publish, commits the new issue, archives it as a release with its open data and asks Pages to publish it, with a totals only summary on the job page, and a test workflow for every change.
- Domains can be left out at their administrators' request through the exclude list in `data/src/scope.json`.
- The Arabian Gulf is called by its name in every language the project speaks. A test reads every file, every credit and the metadata inside every picture, and each photograph is chosen only after reading its source page.
