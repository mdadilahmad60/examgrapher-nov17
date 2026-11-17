# Content plan: fix thin, duplicated tool pages

Check progress with `python3 scripts/seo_check.py` (after `python3 scripts/build.py`). Enforced per phase: unique text >= 45%, title <= 60 chars, description 120-155 chars.

1. **Done: shared SEO groundwork**
   - Default share image `assets/img/og-default.png` (1200x630); `head()` in build.py emits og:image (+ width/height/alt), `twitter:card=summary_large_image` and twitter:image on every page.
   - `scripts/seo_check.py` (per-page title/desc length, og:image, unique-text % from 6-word shingles; `--phase N`, `--all`).
   - `scripts/test-parser.js` now also compiles every page's `examples[].e`.
2. **Next: Phase 1 content (functions + trigonometry, 30 pages)**: still at 4.5-7.4% unique. For each page in pages.json add `intro` (2 paragraphs, 120-180 words), 3 `examples` {e,l}, 4-5 `faq`, 3-4 `points`; fix `title` (<= 60 incl. " | ExamGrapher"; currently too long: quadratic, inverse-function, standard-form, conic-sections) and `desc` (120-155; all 30 are currently too short).
3. Phase 2: calculus, exam-prep, data, compare, statistics pages, same method (`seo_check.py --phase 2`).
4. Phase 3: 301 consolidation (trigonometric-function-grapher -> trig-graphing-calculator, logarithm-grapher -> logarithmic-graphing-calculator); distinct sine/cosine pages; conic-sections-grapher as hub.
5. Phase 4: 3-5 contextual related-tool links inside each page's text.
