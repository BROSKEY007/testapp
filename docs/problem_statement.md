# Problem Statement

## Challenge
**NASA Space Apps Challenge 2026: Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars**

Source: https://www.spaceappschallenge.org/2026/challenges/identify-earth-locations-that-analog-the-permanent-moon-base-locations-and-mars/

> STATUS: the challenge title was confirmed through search. The official page blocks automated access, so the official objectives, constraints, suggested resources and judging criteria below are marked VERIFY. Open the page yourself and fill every VERIFY line before Round 1.

## Background (verified, general)
- NASA uses planetary analogs: places on Earth with natural or engineered similarity to the Moon or Mars. They are used to test hardware, procedures and crew operations before missions.
- No single Earth site matches the Moon or Mars on every factor. Match quality has to be measured per factor (terrain, temperature swing, aridity, vegetation, geology).

## Our framing
Build a prediction and scoring model that takes Earth-side signals (climate, thermal, terrain and surface data) and estimates how well each Earth location matches a chosen Moon or Mars base-site profile.

- Input: gridded Earth data layers for every candidate location
- Target: a Moon or Mars site profile (for example a lunar south pole site or a Mars landing region)
- Output: a ranked list of Earth locations with a match score and a per-factor explanation
- Extra: flag which top locations are new versus already used as analogs

## Official requirements (VERIFY each)
- [ ] Objective as written by NASA:
- [ ] Required deliverables:
- [ ] Suggested data resources listed by NASA:
- [ ] Judging criteria:
- [ ] Submission format and limits:
- [ ] Round structure for our competition (5 rounds): what each round asks for

## Scope decisions
- Start with 1 Moon target and 1 Mars target. Add more only after validation works.
- Global grid screening first. Site-scale detail only for the top results.
- Explainable scoring beats a black-box model. Judges must see why a site ranks high.

## Out of scope for now
- Matching lunar vacuum or permanently shadowed region temperatures (impossible on Earth)
- Field survey claims. This is a screening tool.

## Open questions
- Which exact Moon and Mars sites do we use as targets?
- Which factors can we justify with published numbers?
- Do we train a model or score by similarity? See metric.md.
