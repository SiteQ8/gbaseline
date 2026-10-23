# Gulf Cybersecurity Baseline | خط الأساس الخليجي للأمن السيبراني

**قياس أسبوعي مفتوح لمدى حماية النطاقات العامة في دول الخليج العربي الست للبريد الإلكتروني ونظام أسماء النطاقات والمواقع ينشر مجاميع يستطيع أي شخص الاستشهاد بها مع فحص مباشر لأي نطاق وبيانات مفتوحة وخادم MCP لمساعدي الذكاء الاصطناعي.**

**An open weekly measurement of how well the public domains of the six Arabian Gulf states protect email, DNS and the web, published as totals anyone can quote, with a live check for any domain, open data and an MCP server for AI assistants.**

الموقع | Site: **https://gbaseline.3li.info**

فيلم الإطلاق | Launch film: [العربية](https://gbaseline.3li.info/film/) · [English](https://gbaseline.3li.info/en/film/)

---

## بالعربية

### لماذا

يستشهد المتحدثون والصحفيون والباحثون والجهات التنظيمية بأرقام عن الأمن السيبراني في الخليج العربي لكن أغلب هذه الأرقام قديمة أو مغلقة أو تغطي بلداً واحداً ومعياراً واحداً لذا يقيس هذا المشروع كل أسبوع كل نطاق تحت امتدادات الجهات الحكومية والجامعات والمدارس والقطاع الصحي والشركات والمنظمات غير الربحية والشبكات في الكويت والسعودية والإمارات وقطر والبحرين وعُمان ثمّ ينشر النتائج مجاميعَ مرقّمة بعدد أسبوعي وتاريخ حتى يُستشهد بها بدقة.

### ماذا يقيس

| المجموعة | الفحص | متى يجتاز |
|---|---|---|
| البريد الإلكتروني | الحماية من الانتحال (DMARC) | سياسة عزل أو رفض مطبقة على كل الرسائل |
| البريد الإلكتروني | المرسلون المعتمدون (SPF) | سجل واحد بقاعدة رفض صارمة أو مخففة ضمن 10 استعلامات |
| البريد الإلكتروني | فرض تشفير البريد الوارد (MTA-STS) | سجل وملف سياسة بوضع الإلزام |
| البريد الإلكتروني | تقارير تشفير البريد (TLS-RPT) | سجل صالح بعنوان للتقارير |
| نظام أسماء النطاقات | التوقيع الرقمي (DNSSEC) | إجابات موثّقة لدى المحللات التي تتحقق من التوقيع |
| نظام أسماء النطاقات | جهات إصدار الشهادات (CAA) | سجل CAA خاص أو موروث |
| المواقع | HTTPS صالح | شهادة سارية مطابقة للاسم من جهة موثوقة |
| المواقع | التحويل إلى HTTPS | تحويل من HTTP أو عدم تقديم HTTP أصلاً |
| المواقع | إلزام المتصفح (HSTS) | مدة سنة أو أكثر |
| المواقع | TLS 1.3 | يتفاوض الخادم عليه |
| المواقع | إيقاف TLS 1.0 و1.1 | يرفضهما الخادم |
| المواقع | تبادل المفاتيح المقاوم للحوسبة الكمية | يقبل الخادم المجموعة الهجينة X25519MLKEM768 |
| الإبلاغ عن الثغرات | ملف security.txt | جهة تواصل وتاريخ انتهاء لم يحن |

### الامتدادات المشمولة

| القطاع | الكويت | السعودية | الإمارات | قطر | البحرين | عُمان |
|---|---|---|---|---|---|---|
| الجهات الحكومية | gov.kw | gov.sa | gov.ae | gov.qa | gov.bh | gov.om |
| الجامعات والمدارس | edu.kw | edu.sa · sch.sa | ac.ae · sch.ae | edu.qa · sch.qa | edu.bh | edu.om |
| القطاع الصحي | | med.sa | | | | med.om |
| الشركات | com.kw | com.sa | co.ae | com.qa | com.bh | com.om · co.om |
| المنظمات غير الربحية | org.kw | org.sa | org.ae | org.qa | org.bh | org.om |
| الشبكات | net.kw | net.sa | net.ae | net.qa | net.bh | net.om |

### ما يُنشر وما لا يُنشر

- تُنشر المجاميع حسب الدولة والقطاع والفحص مع البسط والمقام ومستويات النتائج والسلسلة الأسبوعية.
- تعرض الصفحة الرئيسية مجموع الخليج العربي وحده بينما لكل دولة صفحة تعرض أرقامها وحدها لأن المشروع لا يرتب الدول ولا يقارن بينها.
- لا يُذكر اسم أي نطاق ولا تُنشر أي قائمة أو ترتيب للجهات بينما يستطيع أي شخص فحص نطاق واحد مباشرة.

### الفحص المباشر

يجري المتصفح فحوص نظام أسماء النطاقات مباشرة عبر محللَي Cloudflare وGoogle دون أن يمر أي شيء عبر الموقع. أما الفحص الكامل بما فيه المواقع وTLS فتجريه أداة سطر الأوامر من جهازك.

```sh
npx -y github:SiteQ8/gbaseline check example.com --lang ar
```

### مؤشر الاستعدادية

كلما أدرجت CISA في كتالوج الثغرات المستغلة ثغرة في برمجية يراها الزائر من الخارج مثل PHP أو Apache أو nginx أو IIS أو WordPress تُقرأ الصفحة الأولى لكل نطاق حي خلال يوم فيُنشر كم من المواقع يعلن إصداراً مصاباً من بين المواقع التي تعلن إصدارها للخليج العربي ولكل دولة ومعه نسبة البرمجيات المعلنة التي انتهى دعم إصدارها وفق endoflife.date ثمّ يُعاد القياس بعد كل عدد أسبوعي لتظهر سرعة وصول الترقيعات في سلسلة واحدة. لا يُطلب من الموقع إلا صفحته الأولى كما يطلبها أي متصفح ولا يُقاس إلا ما يكتبه الموقع عن نفسه في ترويساته أو وسم المولّد فيه لذلك فالأرقام حد أدنى ولا يُذكر اسم أي نطاق. الصفحة على https://gbaseline.3li.info/readiness/ ولكل ثغرة صفحة ثابتة يُستشهد بها فيها نسبة التعرض وسلسلة القياسات والإصدارات المصابة والحل وصيغة الاقتباس بالعربية والإنجليزية مع خلاصة Atom على /readiness/feed.xml والملف على https://gbaseline.3li.info/data/readiness.json والمصادر كتالوج CISA وقاعدة NVD وendoflife.date.

### حدود القياس

- يجري الفحص الأسبوعي من خوادم GitHub خارج الخليج العربي لذلك يُعد الموقع الذي يحجب الزيارات الأجنبية غير قابل للوصول ويُستبعد من فحوص المواقع دون أن يُحسب راسباً.
- لا يُقاس DKIM لأن محدداته لا يمكن حصرها من الخارج.
- لا تُشمل بعد النطاقات المسجلة مباشرة تحت رمز الدولة أو تحت الامتدادات العالمية بينما تُستثنى عمداً امتدادات الجهات العسكرية والسفارات والأفراد.

### الاستشهاد بالأرقام

لكل عدد صفحة ثابتة لا تتغير بعد صدوره مثل https://gbaseline.3li.info/issues/1/ ولكل دولة صفحتها داخل العدد ولكل رقم صيغة اقتباس بالعربية والإنجليزية يفتح رابطها الرقم نفسه كما نُشر بينما تجد في صفحة كل عدد مرجعه الكامل ومدخل BibTeX وفي المستودع ملف CITATION.cff للاستشهاد بالمشروع كله.

---

## English

### Why

Talks, articles, papers and policy notes about cybersecurity in the Arabian Gulf need figures, and most of the figures on hand are old, closed, or cover one country and one control. This project measures every registrable domain under the government, education, health, business, non-profit and network suffixes of Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain and Oman every week, and publishes the results as numbered weekly issues so that any figure can be cited to its issue and date.

### What it measures

| Group | Check | Passes when |
|---|---|---|
| Email | Spoofing protection (DMARC, RFC 7489) | quarantine or reject applied to all mail |
| Email | Authorised senders (SPF, RFC 7208) | one record, strict or soft closing rule, within 10 DNS lookups |
| Email | Encrypted inbound mail (MTA-STS, RFC 8461) | record and policy file in enforce mode |
| Email | Mail encryption reports (TLS-RPT, RFC 8460) | valid record naming a reporting address |
| DNS | Signed DNS (DNSSEC, RFC 4033) | validating resolvers mark the answers authenticated |
| DNS | Allowed certificate issuers (CAA, RFC 8659) | own or inherited CAA record |
| Websites | Valid HTTPS | in date, matching name, trusted chain (a missing intermediate is noted, still passes) |
| Websites | Plain HTTP sends visitors to HTTPS | redirects to HTTPS, or plain HTTP is not served |
| Websites | HSTS (RFC 6797) | max-age of at least one year |
| Websites | TLS 1.3 (RFC 8446) | negotiated |
| Websites | Old TLS switched off (RFC 8996) | TLS 1.0 and 1.1 both refused |
| Websites | Post quantum key exchange | a handshake offering only X25519MLKEM768 completes |
| Vulnerability disclosure | security.txt (RFC 9116) | Contact present and one Expires date still ahead |

### Suffixes measured

| Sector | Kuwait | Saudi Arabia | UAE | Qatar | Bahrain | Oman |
|---|---|---|---|---|---|---|
| Government | gov.kw | gov.sa | gov.ae | gov.qa | gov.bh | gov.om |
| Universities and schools | edu.kw | edu.sa · sch.sa | ac.ae · sch.ae | edu.qa · sch.qa | edu.bh | edu.om |
| Healthcare | | med.sa | | | | med.om |
| Companies | com.kw | com.sa | co.ae | com.qa | com.bh | com.om · co.om |
| Non-profit | org.kw | org.sa | org.ae | org.qa | org.bh | org.om |
| Network | net.kw | net.sa | net.ae | net.qa | net.bh | net.om |

Left out on purpose: mil.ae, mil.qa, emb.kw, ind.kw, name.qa, pro.om, pub.sa and museum.om.

### How the numbers are made

1. **Inventory.** Names come from public Certificate Transparency logs (crt.sh, through its read only PostgreSQL guest login first and its JSON interface second) and from the Tranco list of popular sites. Each name is reduced to its registrable domain under the suffix. A name stays once seen; a source that fails never shrinks the inventory.
2. **DNS.** Every query goes over DNS over HTTPS to Cloudflare and Google. A DMARC answer counts only when both resolvers agree. DNSSEC counts as broken only when a validating resolver refuses an answer it returns with validation switched off, and only when the second look in the same run sees it again.
3. **Web and TLS.** One ordinary request per probe from a GitHub hosted runner, with a user agent that links to the method page. The post quantum check completes a TLS 1.3 handshake that offers only `X25519MLKEM768`, so it needs OpenSSL 3.5 or later (Node 22 bundles it).
4. **Second pass.** Everything inconclusive is observed again at the end of the run with a fresh cache.
5. **Totals.** A share is passing domains divided by the domains where the check applies and could be measured. Domains that no longer exist are dropped; domains that cannot be reached from the scanner are counted apart, never as failing.

### The CIS Controls

Six CIS Controls v8.1 safeguards can be partly seen from outside, and each is tied to what the baseline measures: 9.5 Implement DMARC (DMARC, SPF), 3.10 Encrypt Sensitive Data in Transit (HTTPS, HSTS, TLS 1.3, old TLS refused, post quantum key exchange, MTA-STS), 16.2 a process to accept and address software vulnerabilities (security.txt), 2.2 software still supported, 7.4 application patch management and 7.7 remediate detected vulnerabilities (from the readiness index, counted per site). The page https://gbaseline.3li.info/cis/ shows the Arabian Gulf, and every state's page has the same section with its own figures, never set beside another state. Each figure is the share meeting the visible evidence, never a statement that a safeguard is met. CIS Controls® by the Center for Internet Security, Inc., quoted unchanged under CC BY-NC-ND 4.0; the mapping is in `data/src/cis.json`.

### The readiness index

Whenever CISA adds to its [Known Exploited Vulnerabilities catalogue](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) an entry for software a website announces from outside (PHP, Apache HTTP Server, nginx, IIS, LiteSpeed, Tomcat, OpenSSL, WordPress, Drupal, Joomla, TYPO3, Next.js and the like), the first page of every live domain in the inventory is read within a day, and the share of sites announcing an affected version, among the sites that announce a version of that product, is published for the Gulf and for each state. The same census runs after every weekly issue, so the series shows how fast the patches arrive. Alongside it: the share of announced software whose version is past its support on [endoflife.date](https://endoflife.date/), and what the first pages announce at all (a server, a version, a content system, a front such as Cloudflare that hides the server).

Each site is asked for its first page once, as any browser would ask, and only what the site writes about itself is read: the `Server`, `X-Powered-By` and `X-AspNet-Version` headers and the `generator` tag in the first 64 kilobytes. The affected version ranges come from [NVD](https://nvd.nist.gov/) and the support cycles from endoflife.date, refreshed with every census; IIS is supported as long as the Windows Server it ships with, so its cycles are Microsoft's lifecycle dates, kept in the engine. The figures are a floor: a site that announces no version is never counted as affected, a site that announces only its major (Drupal 10, Apache/2.4) is counted only when every version under it is affected or none is, and a version can be older than the code behind it when a distribution backports the fixes. No domain is named and the states are never ranked. The page is at https://gbaseline.3li.info/readiness/, and every vulnerability the Gulf can be measured against has a page of its own that can be cited, such as `/readiness/cve-2024-38475/`, with its exposure, its series census by census, the affected versions, the fix and a citation in Arabic and English. A readiness report of four A4 sheets (the key figures, the exploited vulnerabilities, the software past its support and what sites announce, the method and the citation) is printed with every census at `/readiness/report/` and saved as PDF in both languages by `scripts/report-pdf.mjs`, ready to print or send. When a census first measures the Gulf against a vulnerability catalogued in the last sixty days, the workflow opens an issue labelled `readiness-alert` with the figure in Arabic and English and the link to its page, so anyone who watches the repository's issues is told the same day. An Atom feed at `/readiness/feed.xml` (and `/en/readiness/feed.xml`) carries one entry per vulnerability. The data is at `docs/data/readiness.json`, and `.github/workflows/readiness.yml` runs it: a daily watch of the catalogue, a census across three runners when there is something new or after each issue (`census --shard i/3`), then `readiness`, which counts the rows against the references and prints the pages.

### Published files

| File | What it holds |
|---|---|
| `docs/data/summary.json` | This issue: totals and levels by country, sector and check, inventory counts, DNSSEC availability per suffix, data quality |
| `docs/data/history.json` | The weekly series |
| `docs/data/open/cis.csv` | The CIS Controls evidence for the Gulf and each state: safeguard, group, evidence, meeting, of, share |
| `docs/data/open/readiness.csv` | The readiness index as CSV: exposure per exploited vulnerability, software past support, what sites announce, whole-site counts |
| `docs/data/readiness.json` | The readiness index: what the sites announce, the exploited vulnerabilities followed with the exposure of the Gulf and each state, the support cycles used, the sources and the series |
| `docs/data/open/latest.csv` | This issue as CSV |
| `docs/data/open/history.csv` | Every issue as CSV |
| `docs/feed.xml`, `docs/en/feed.xml` | An Atom feed of the issues with the six figures of each, in Arabic and in English |
| `docs/llms.txt` | What the site is, where its data and tools are and how to cite it, for language models and agents |

No published file names a domain. The inventory of names is rebuilt every week from the public certificate logs and the Tranco list, and passes from one run to the next as the run's working data: it is never committed or published.

### Check any domain

```sh
npx -y github:SiteQ8/gbaseline check example.com
npx -y github:SiteQ8/gbaseline check example.com --lang ar --json
npx -y github:SiteQ8/gbaseline check example.com --dns-only
```

### MCP server

```json
{
  "mcpServers": {
    "gbaseline": { "command": "npx", "args": ["-y", "github:SiteQ8/gbaseline", "mcp"] }
  }
}
```

| Tool | What it answers |
|---|---|
| `gbaseline_overview` | The latest issue, its date and the six headline figures for the Gulf, with their counts and ready to quote sentences |
| `gbaseline_figures` | Every check for the Gulf as a whole or for one state on its own, all sectors or one |
| `gbaseline_check_info` | What a check means, when it passes, how to fix it, the standards and the Gulf figure |
| `gbaseline_history` | The weekly series of one check |
| `gbaseline_readiness` | The readiness index for the Gulf or one state: exploited vulnerabilities with the share of sites announcing an affected version, software past its support, what the sites announce, and the series |
| `gbaseline_cis` | The CIS Controls v8.1 safeguards that can be partly seen from outside, for the Gulf or one state, with the share meeting each piece of visible evidence |
| `gbaseline_methodology` | Method, limits, data quality and how to cite |
| `gbaseline_check_domain` | A live full check of any domain from your machine |

Every tool is read only, works offline from the published data except the live check, and answers in Arabic or English. No tool lists organisations, and no tool ranks or compares the states: each answer covers the Gulf as a whole or one state at a time, as the site does.

### Run it yourself

```sh
node bin/cli.mjs inventory          # build the inventory of names in data/inventory/ (never committed)
node bin/cli.mjs scan --limit 50    # scan, rows to a temporary file
node bin/cli.mjs publish            # write the totals, the weekly series and the open data
node bin/cli.mjs weekly             # all three
node bin/cli.mjs census --limit 50  # what the first page of each live domain announces, rows to a temporary file
node bin/cli.mjs readiness          # count the census against the exploited vulnerabilities and the support cycles
node bin/cli.mjs watch              # whether the catalogue holds a new exploited vulnerability the index should measure
```

The weekly workflow in `.github/workflows/weekly.yml` runs by itself every Monday, and again whenever the scope or the workflow changes on `main`: it refreshes the inventory, scans it across six runners at once (`scan --shard i/6`), publishes and tests the totals, commits them, archives the issue as a release named `issue-N` with its CSV and JSON attached, and asks Pages to publish it. No step is done by hand.

### Develop

```sh
npm run build       # validate data/src and write docs/data/bundle.json
npm test            # engine, probes against local servers, pipeline, data, MCP, site
npm run test:ui     # browser checks of the site in both languages (Playwright)
npm run preflight   # everything above plus the publication gates
```

### Limits

- The scan runs outside the Arabian Gulf, so a site that blocks foreign traffic is counted as unreachable and left out of the web checks.
- DKIM is not measured, because selectors cannot be listed from outside.
- Domains registered directly under a country code, or under global extensions such as .com, are not included yet. The military, embassy and personal suffixes are left out on purpose.

### The site

Each issue is printed like an annual report. Across the top, a mosaic of the six states at night, one NASA photograph from the International Space Station for each; the title hangs on one axis at 42% of the page; the issue is written into a single sentence with its figures; six figures to quote follow, each with its citation in Arabic and English; then a mosaic of what is measured, how an issue is made in four lines that step across the page, and the live check in a field of LED white. One navy field and sodium-lamp amber, the colours of the photographs, and one typeface, Alexandria, for both scripts. The home page shows the Arabian Gulf as a whole; each state, each standard and each issue has a page of its own.

Every page is printed to HTML from the bundle and the published data when an issue comes out (`scripts/prerender.mjs`), in Arabic at the root and in English under `/en/`, with its canonical address, both languages linked and a sitemap of all of them, so every page can be read, linked, indexed and cited without script. The browser adds only the sector tabs, the copy buttons, the live check and the motion.

The launch film, about a minute long in Arabic and in English, is recorded from the site itself and has a page of its own on the site, with captions and the files to download. Its narration and its music are generated, and its closing card says so.

### Citing

Every issue keeps a page that does not change after it comes out, such as `https://gbaseline.3li.info/en/issues/1/`, with a page per state inside it. Every figure has a citation in Arabic and English whose link opens that figure as it was published, and every issue page gives its full reference and a BibTeX entry. To cite the project as a whole, use `CITATION.cff`, which GitHub shows as "Cite this repository".

### Licence

MIT, for the code and the published data. Fonts under the SIL Open Font License; the photographs are NASA's and in the public domain. See `NOTICE.md`.

By [Ali AlEnezi](https://3li.info).
