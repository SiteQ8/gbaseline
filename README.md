# __NAME_EN__ | __NAME_AR__

**قياس أسبوعي مفتوح لمدى حماية النطاقات العامة في دول الخليج الست للبريد الإلكتروني ونظام أسماء النطاقات والمواقع ينشر مجاميع يستطيع أي شخص الاستشهاد بها مع فحص مباشر لأي نطاق وبيانات مفتوحة وخادم MCP لمساعدي الذكاء الاصطناعي.**

**An open weekly measurement of how well the public domains of the six Gulf states protect email, DNS and the web, published as totals anyone can quote, with a live check for any domain, open data and an MCP server for AI assistants.**

الموقع | Site: **https://__DOMAIN__**

---

## بالعربية

### لماذا

يستشهد المتحدثون والصحفيون والباحثون والجهات التنظيمية بأرقام عن الأمن السيبراني في الخليج لكن أغلب هذه الأرقام قديمة أو مغلقة أو تغطي بلداً واحداً وفحصاً واحداً. لذا يقيس هذا المشروع كل أسبوع كل نطاق تحت لواحق الجهات الحكومية والتعليم في الكويت والسعودية والإمارات وقطر والبحرين وعُمان ثمّ ينشر النتائج مجاميعَ مرقّمة بعدد أسبوعي وتاريخ حتى يُستشهد بها بدقة.

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

### ما يُنشر وما لا يُنشر

- تُنشر المجاميع حسب الدولة والقطاع والفحص مع البسط والمقام ومستويات النتائج والسلسلة الأسبوعية.
- وتُذكر في لوحة الشرف أسماء النطاقات التي تجتاز كل فحص أساسي ينطبق عليها.
- ولا تُنشر أي قائمة أو ترتيب للجهات التي لا تجتاز بينما يستطيع أي شخص فحص نطاق واحد مباشرة.

### الفحص المباشر

يجري المتصفح فحوص نظام أسماء النطاقات مباشرة عبر محللَي Cloudflare وGoogle دون أن يمر أي شيء عبر الموقع. أما الفحص الكامل بما فيه المواقع وTLS فتجريه أداة سطر الأوامر من جهازك.

```sh
npx -y github:__REPO__ check example.com --lang ar
```

### حدود القياس

- يجري الفحص الأسبوعي من خوادم GitHub خارج الخليج لذلك يُعد الموقع الذي يحجب الزيارات الأجنبية غير قابل للوصول ويُستبعد من فحوص المواقع دون أن يُحسب راسباً.
- ولا يُقاس DKIM لأن محدداته لا يمكن حصرها من الخارج.
- وتقع بعض نطاقات الجهات الحكومية خارج هذه اللواحق ولم تُضمّن بعد.

---

## English

### Why

Talks, articles, papers and policy notes about cybersecurity in the Gulf need figures, and most of the figures on hand are old, closed, or cover one country and one control. This project measures every registrable domain under the government and education suffixes of Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain and Oman every week, and publishes the results as numbered weekly issues so that any figure can be cited to its issue and date.

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

Core checks (DMARC, SPF, DNSSEC where the suffix allows it, valid HTTPS, the redirect, HSTS, old TLS off, security.txt) decide the hall of fame. MTA-STS, TLS-RPT, CAA, TLS 1.3 and the post quantum check are measured and published but not required.

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
| `docs/data/hall.json` | Domains that pass every core check that applies to them |
| `docs/data/open/latest.csv` | This issue as CSV |
| `docs/data/open/history.csv` | Every issue as CSV |
| `data/inventory/domains.json` | The measured names, where each came from and when it was first seen |

No file carries a per domain failure.

### Check any domain

```sh
npx -y github:__REPO__ check example.com
npx -y github:__REPO__ check example.com --lang ar --json
npx -y github:__REPO__ check example.com --dns-only
```

### MCP server

```json
{
  "mcpServers": {
    "__SLUG__": { "command": "npx", "args": ["-y", "github:__REPO__", "mcp"] }
  }
}
```

| Tool | What it answers |
|---|---|
| `observatory_overview` | The latest issue, its date and the headline figures with their counts |
| `observatory_figures` | Every check for the Gulf or one country, all sectors or one |
| `observatory_compare` | One check across the six states |
| `observatory_check_info` | What a check means, when it passes, how to fix it, the standards |
| `observatory_history` | The weekly series of one check |
| `observatory_hall_of_fame` | Domains that pass every core check |
| `observatory_methodology` | Method, limits, data quality and how to cite |
| `observatory_check_domain` | A live full check of any domain from your machine |

Every tool is read only, works offline from the published data except the live check, and answers in Arabic or English.

### Run it yourself

```sh
node bin/cli.mjs inventory          # refresh data/inventory/domains.json
node bin/cli.mjs scan --limit 50    # scan, rows to a temporary file
node bin/cli.mjs publish            # write the totals, series, hall of fame and open data
node bin/cli.mjs weekly             # all three
```

The weekly workflow in `.github/workflows/weekly.yml` runs the same three steps every Monday and commits the published files.

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
- Some government namespaces sit outside these suffixes (for example names directly under a country code) and are not included yet.

### Citing

Give the issue number and its date. Every figure on the site has a citation slip that copies the exact reference in Arabic or English.

### Licence

MIT, for the code and the published data. Fonts under the SIL Open Font License, see `NOTICE.md`.

By [Ali AlEnezi](https://3li.info).
