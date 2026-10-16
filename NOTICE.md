# Notice

## Fonts

Self hosted in `docs/fonts/` under the SIL Open Font License 1.1, whose full text is in `docs/fonts/OFL.txt`.

- **Alexandria**, Copyright 2022 The Alexandria Project Authors (https://github.com/Gue3bara/Alexandria). Weights 400, 500 and 600, the Arabic and Latin files as subset by Fontsource 5.3.0, unchanged. It sets the whole site in both scripts.

## Photographs

The photographs are six night views of the Arabian Gulf's cities taken from the International Space Station by NASA crews, one for each state and all in the public domain (https://creativecommons.org/publicdomain/mark/1.0/). Each was chosen only after reading its source page, whose title, description and categories never use any other name for the Arabian Gulf.

- **Kuwait City**, Expedition 64, 9 January 2021, NASA photograph iss064e021961. Wikimedia Commons page 140667044 (https://commons.wikimedia.org/w/index.php?curid=140667044). Cropped and resized into `kw-wide.jpg`, `kw-tile.jpg`, `kw-portrait.jpg`.
- **Riyadh**, Expedition 72, 28 December 2024, NASA photograph iss072e445326. Wikimedia Commons page 161790758 (https://commons.wikimedia.org/w/index.php?curid=161790758). Cropped and resized into `sa-wide.jpg`, `sa-tile.jpg`, `sa-portrait.jpg`.
- **Dubai**, Expedition 47, 11 March 2016. Wikimedia Commons page 48000179 (https://commons.wikimedia.org/w/index.php?curid=48000179). Cropped and resized into `ae-wide.jpg`, `ae-tile.jpg`, `ae-portrait.jpg`.
- **Doha**, Expedition 26, 9 December 2010, NASA photograph ISS026-E-9183. Wikimedia Commons page 111470015 (https://commons.wikimedia.org/w/index.php?curid=111470015). Cropped and resized into `qa-wide.jpg`, `qa-tile.jpg`, `qa-portrait.jpg`.
- **Bahrain**, Expedition 26, 9 December 2010, NASA photograph ISS026-E-9186. Wikimedia Commons page 111470044 (https://commons.wikimedia.org/w/index.php?curid=111470044). Cropped and resized into `bh-wide.jpg`, `bh-tile.jpg`, `bh-portrait.jpg`.
- **Muscat and Al Seeb**, Expedition 69, 18 July 2023, NASA photograph iss069e032988. Wikimedia Commons page 135376374 (https://commons.wikimedia.org/w/index.php?curid=135376374). Cropped and resized into `om-wide.jpg`, `om-tile.jpg`, `om-portrait.jpg`.

Each was downloaded at 3840 pixels on 16 October 2026, and each file on the site carries its origin in a JPEG comment. The register of the photographs, with their wording in both languages, is `data/src/pictures.json`. The share card `docs/og.png` is rendered from the site's typeface and the six photographs, and says so in a PNG text chunk. Nothing on the site is generated imagery.

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
