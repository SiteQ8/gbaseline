# Notice

## Fonts

Self hosted in `docs/fonts/` under the SIL Open Font License 1.1, whose full text is in `docs/fonts/OFL.txt`.

- **El Messiri**, Copyright 2015 The El Messiri Project Authors (https://github.com/Gue3bara/El-Messiri). Weights 400 and 500, the Arabic and Latin files as subset by Fontsource 5.3.0, unchanged.
- **Alexandria**, Copyright 2022 The Alexandria Project Authors (https://github.com/Gue3bara/Alexandria). Weights 300, 400 and 500, the Arabic and Latin files as subset by Fontsource 5.3.0, unchanged.

## Photographs

Every picture on the site comes from one photograph: the Gulf at night, taken from the International Space Station by the NASA Expedition 63 crew on 31 August 2020 at 21:04:55 UTC. NASA, public domain (https://creativecommons.org/publicdomain/mark/1.0/). Source: Wikimedia Commons, page 99981618 (https://commons.wikimedia.org/w/index.php?curid=99981618), downloaded at 3840 pixels on 16 October 2026.

`docs/img/gulf-night-2400.jpg` and `gulf-night-1600.jpg` are the whole frame resized with a light denoise; `gulf-night-north.jpg`, `gulf-night-coast.jpg` and `gulf-night-stamp.jpg` are crops of it. Each file carries this origin in a JPEG comment. Nothing on the site is generated imagery.

## Data sources

- **Certificate Transparency logs**, read through crt.sh (https://crt.sh), to find the names under each suffix.
- **The Tranco list** of popular sites (https://tranco-list.eu), as a second source of names. Le Pochat, V., Van Goethem, T., Tajalizadehkhoob, S., Korczyński, M., and Joosen, W. (2019). Tranco: A Research-Oriented Top Sites Ranking Hardened Against Manipulation. Network and Distributed System Security Symposium.
- **Public DNS over HTTPS resolvers** run by Cloudflare (https://cloudflare-dns.com) and Google (https://dns.google), for every DNS answer.

## Standards

The checks follow RFC 7489 (DMARC), RFC 7208 (SPF), RFC 8461 (MTA-STS), RFC 8460 (TLS-RPT), RFC 4033 and RFC 9364 (DNSSEC), RFC 8659 (CAA), RFC 6797 (HSTS), RFC 8446 (TLS 1.3), RFC 8996 (deprecating TLS 1.0 and 1.1), RFC 9525 (service identity), RFC 9116 (security.txt), FIPS 203 (ML-KEM) and the IETF draft on hybrid ECDHE and ML-KEM key agreement for TLS 1.3.

## Independence

This is an independent open project. It is not affiliated with, endorsed by or run on behalf of any government, regulator, registry or organisation whose domains it measures. The figures describe public configuration only and are not an audit of any organisation.
