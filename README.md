# Gulf Cybersecurity Baseline | خط الأساس الخليجي للأمن السيبراني

**قياس أسبوعي مفتوح لمدى حماية النطاقات العامة في دول الخليج العربي الست للبريد الإلكتروني ونظام أسماء النطاقات والمواقع ينشر مجاميع يستطيع أي شخص الاستشهاد بها مع فحص مباشر لأي نطاق وبيانات مفتوحة وخادم MCP لمساعدي الذكاء الاصطناعي.**

**An open weekly measurement of how well the public domains of the six Arabian Gulf states protect email, DNS and the web, published as totals anyone can quote, with a live check for any domain, open data and an MCP server for AI assistants.**

الموقع | Site: **https://gbaseline.3li.info**

فيلم الإطلاق | Launch film: [العربية](https://github.com/SiteQ8/gbaseline/releases/download/v0.1.0/gbaseline-film-ar.mp4) · [English](https://github.com/SiteQ8/gbaseline/releases/download/v0.1.0/gbaseline-film-en.mp4)

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
- تعرض الصفحة الرئيسية مجموع الخليج وحده بينما لكل دولة صفحة تعرض أرقامها وحدها لأن المشروع لا يرتب الدول ولا يقارن بينها.
- لا يُذكر اسم أي نطاق ولا تُنشر أي قائمة أو ترتيب للجهات بينما يستطيع أي شخص فحص نطاق واحد مباشرة.

### الفحص المباشر

يجري المتصفح فحوص نظام أسماء النطاقات مباشرة عبر محللَي Cloudflare وGoogle دون أن يمر أي شيء عبر الموقع. أما الفحص الكامل بما فيه المواقع وTLS فتجريه أداة سطر الأوامر من جهازك.

```sh
npx -y github:SiteQ8/gbaseline check example.com --lang ar
```

### حدود القياس

- يجري الفحص الأسبوعي من خوادم GitHub خارج الخليج لذلك يُعد الموقع الذي يحجب الزيارات الأجنبية غير قابل للوصول ويُستبعد من فحوص المواقع دون أن يُحسب راسباً.
- ولا يُقاس DKIM لأن محدداته لا يمكن حصرها من الخارج.
- ولا تُشمل بعد النطاقات المسجلة مباشرة تحت رمز الدولة أو تحت الامتدادات العالمية وتُستثنى عمداً امتدادات الجهات العسكرية والسفارات والأفراد.

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

### Published files

| File | What it holds |
|---|---|
| `docs/data/summary.json` | This issue: totals and levels by country, sector and check, inventory counts, DNSSEC availability per suffix, data quality |
| `docs/data/history.json` | The weekly series |
| `docs/data/open/latest.csv` | This issue as CSV |
| `docs/data/open/history.csv` | Every issue as CSV |
| `data/inventory/domains.json` | The measured names, where each came from and when it was first seen |

No published file names a domain next to a result. The inventory lists the names that are measured, as found in public certificate logs, and nothing about how any of them did.

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
| `gbaseline_methodology` | Method, limits, data quality and how to cite |
| `gbaseline_check_domain` | A live full check of any domain from your machine |

Every tool is read only, works offline from the published data except the live check, and answers in Arabic or English. No tool lists organisations, and no tool ranks or compares the states: each answer covers the Gulf as a whole or one state at a time, as the site does.

### Run it yourself

```sh
node bin/cli.mjs inventory          # refresh data/inventory/domains.json
node bin/cli.mjs scan --limit 50    # scan, rows to a temporary file
node bin/cli.mjs publish            # write the totals, the weekly series and the open data
node bin/cli.mjs weekly             # all three
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

- The scan runs outside the Gulf, so a site that blocks foreign traffic is counted as unreachable and left out of the web checks.
- DKIM is not measured, because selectors cannot be listed from outside.
- Domains registered directly under a country code, or under global extensions such as .com, are not included yet. The military, embassy and personal suffixes are left out on purpose.

### The site

Each issue is printed as stationery: a card with a measuring scale along its top, set beside NASA night photographs of the Arabian Gulf's cities taken from the International Space Station, then the Gulf's figures as a ledger aligned on the decimal point, the citation slips, the run printed as an itinerary, a reply card for the live check and the back of a postcard as the footer. The home page shows the Gulf as a whole; each state has a page of its own. Display type is El Messiri and text is Alexandria, both drawing Arabic and Latin.

The launch film, about a minute long in Arabic and in English, is recorded from the site itself with the figures of issue 1 and attached to the v0.1.0 release. Its narration, its music and the motion of its opening shot are generated, and its closing card says so.

### Citing

Give the issue number and its date. Every figure on the site has a citation slip that copies the exact reference in Arabic or English, and the link in that reference reopens the figure as it was published in that issue, even after later issues come out.

### Licence

MIT, for the code and the published data. Fonts under the SIL Open Font License; the photographs are NASA's and in the public domain. See `NOTICE.md`.

By [Ali AlEnezi](https://3li.info).
