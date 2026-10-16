# Notice

## Fonts

Self hosted in `docs/fonts/` under the SIL Open Font License 1.1, whose full text is in `docs/fonts/OFL.txt`.

- **El Messiri**, Copyright 2015 The El Messiri Project Authors (https://github.com/Gue3bara/El-Messiri). Weights 400 and 500, the Arabic and Latin files as subset by Fontsource 5.3.0, unchanged.
- **Alexandria**, Copyright 2022 The Alexandria Project Authors (https://github.com/Gue3bara/Alexandria). Weights 300, 400 and 500, the Arabic and Latin files as subset by Fontsource 5.3.0, unchanged.

## Photographs

The photographs are four night views of the Arabian Gulf's cities taken from the International Space Station by NASA crews, all in the public domain (https://creativecommons.org/publicdomain/mark/1.0/). Each was chosen only after reading its source page, whose title, description and categories never use any other name for the Arabian Gulf.

- **Dammam and the Eastern Province coast**, Expedition 62, 25 March 2020. Wikimedia Commons page 88992012 (https://commons.wikimedia.org/w/index.php?curid=88992012). `docs/img/dammam-night-2400.jpg` and `dammam-night-1600.jpg` are the whole frame resized with a light denoise.
- **Kuwait City**, Expedition 64, 9 January 2021, NASA photograph iss064e021961. Wikimedia Commons page 140667044 (https://commons.wikimedia.org/w/index.php?curid=140667044). `docs/img/kuwait-night.jpg` is a crop of the city and its coast.
- **Qatar**, Expedition 33, 13 October 2012. Wikimedia Commons page 22699352 (https://commons.wikimedia.org/w/index.php?curid=22699352). `docs/img/qatar-night.jpg` is a crop of its lit towns and roads.
- **Riyadh**, Expedition 72, 28 December 2024, NASA photograph iss072e445326. Wikimedia Commons page 161790758 (https://commons.wikimedia.org/w/index.php?curid=161790758). `docs/img/riyadh-night-stamp.jpg` is a crop of the city centre.

Each was downloaded at 3840 pixels on 16 October 2026, and each file on the site carries its origin in a JPEG comment. The share card `docs/og.png` is rendered from the site's fonts and the photograph of Dammam, and says so in a PNG text chunk. Nothing on the site is generated imagery.


## Launch film

The films attached to the v0.1.0 release, `gbaseline-film-ar.mp4` and `gbaseline-film-en.mp4`, are recorded from this site with the figures of issue 1, published on 16 October 2026. Their opening shot holds still on one of the photographs above. The narration in each language is generated with ElevenLabs (Eleven v4) and the music with ElevenLabs Music. The closing card of each film says so. None of this generated material is used on the site.

## Data sources

- **Certificate Transparency logs**, read through crt.sh (https://crt.sh), to find the names under each suffix.
- **The Tranco list** of popular sites (https://tranco-list.eu), as a second source of names. Le Pochat, V., Van Goethem, T., Tajalizadehkhoob, S., Korczyński, M., and Joosen, W. (2019). Tranco: A Research-Oriented Top Sites Ranking Hardened Against Manipulation. Network and Distributed System Security Symposium.
- **Public DNS over HTTPS resolvers** run by Cloudflare (https://cloudflare-dns.com) and Google (https://dns.google), for every DNS answer.

## Standards

The checks follow RFC 7489 (DMARC), RFC 7208 (SPF), RFC 8461 (MTA-STS), RFC 8460 (TLS-RPT), RFC 4033 and RFC 9364 (DNSSEC), RFC 8659 (CAA), RFC 6797 (HSTS), RFC 8446 (TLS 1.3), RFC 8996 (deprecating TLS 1.0 and 1.1), RFC 9525 (service identity), RFC 9116 (security.txt), FIPS 203 (ML-KEM) and the IETF draft on hybrid ECDHE and ML-KEM key agreement for TLS 1.3.

## Independence

This is an independent open project. It is not affiliated with, endorsed by or run on behalf of any government, regulator, registry or organisation whose domains it measures. The figures describe public configuration only and are not an audit of any organisation.
