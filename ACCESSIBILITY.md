# TPJ V2 Accessibility

How the redesign approached accessibility, what shipped, and how to re-verify.

---

## Target

**WCAG 2.1 Level AA.** Realistic for an editorial site with strong type and
photography. AAA was not pursued because the 7:1 contrast minimum would
compromise the design's restraint, and AAA assumptions about animation,
abbreviation expansion, and reading level are not the right fit for
literary editorial content.

---

## Approach

### Baseline measurement

Before any remediation, ran pa11y against four representative routes:
homepage, essay, interview, feature. Initial result: **89 errors** across
the four pages. Most violations were concentrated in three categories:
text contrast (the muted token), interactive elements without accessible
names, and missing skip-link infrastructure.

Used pa11y as the primary checker because its rule coverage maps closely
to HTML_CodeSniffer's WCAG2AA suite. Cross-checked with @axe-core/cli on
the same routes for a second opinion on aria-specific issues. Both tools
are runnable via `npx`; neither is installed as a dependency.

### Decision principles

- **Fix root causes, not page-specific patches.** A contrast violation in
  one section meant the global muted token was wrong, not that the
  section needed override styles.
- **Keyboard parity, not keyboard duplication.** Every interaction
  reachable by mouse must be reachable by keyboard, but it doesn't need
  to look the same. Drag-to-close on a modal pairs with Escape-to-close;
  the keyboard user gets the simpler affordance.
- **Don't replace native semantics with ARIA when the native element
  works.** Buttons stayed `<button>`. Links stayed `<a>`. ARIA was added
  only where the design needed a composite widget (tablists, custom
  dialogs, decorative buttons over images).
- **Motion is design vocabulary, not chrome.** Animation respects
  `prefers-reduced-motion` where the motion is purely transitional
  (page transitions, carousel rotation), but isn't disabled outright
  for users with the preference. Motion that carries meaning stays.

---

## What shipped

After the pass: **0 errors** across the four baselined routes. Re-verify
with `npx pa11y --standard WCAG2AA http://localhost:3000/<route>`. Chrome
must be installed (pa11y drives it via Puppeteer).

### Site-wide infrastructure

**Skip-to-content link** — `components/SkipToContent.tsx`. First focusable
element on every page; visually hidden until tab-focused, then renders as
a high-contrast pill in the top-left. Targets
`<main id="main-content" tabIndex={-1}>` in `app/layout.tsx`. The
negative tabIndex makes the main region programmatically focusable
without injecting it into the natural tab order.

**Global focus ring** — `app/globals.css`. Site-wide
`:focus-visible { outline: 2px solid var(--chip-bg); outline-offset: 2px }`
delivers a consistent keyboard cue without ever rendering on click or
touch focus. Suppressed on `<main>` because the URL change plus scroll
position is the focus cue after a skip-link jump.

**Three `outline: none` carve-outs** (MobileDrawer content,
ThemeBrowser select, ExploreFilters select) rewritten as
`:focus:not(:focus-visible) { outline: none }`. Click and touch focus
stay clean, keyboard focus still draws the ring.

**Route announcer** — `components/RouteAnnouncer.tsx`. Next.js App Router
doesn't fire the same "page loaded" signal as a full page load, so
assistive tech can miss SPA navigations. The component watches
`usePathname()`, skips the initial mount (browsers already announce the
landing page), then reads `document.title` after a 100ms deferral and
writes "Navigated to {title}" into a visually-hidden
`role="status" aria-live="polite"` region. Mounted in `app/layout.tsx`.

### Contrast

The site uses a muted text token (`--muted`) across captions, bylines,
secondary copy, and date labels. Original value `#888` failed AA against
the light background in 52 places site-wide.

- Token bumped to `#6e6e6e` in `app/globals.css`. One change, 52
  violations cleared.
- The footer's `.est` color is hardcoded to `#555` because the lighter
  footer background (`#e5e5e5`) breaks `--muted` even at the new value.

### Photograph image-buttons (article body)

Every WP-archive `<img>` inside an article body gains
`role="button"` so the click target is keyboard- and screen-reader
discoverable. The image-viewer enhancement now also:

- Sets `aria-label` on each — uses the image's `alt` text when present,
  falls back to "Open photograph in viewer" otherwise. Cleared 36 H91
  empty-button violations site-wide.
- Binds an Enter/Space keyboard handler so the activation is
  keyboard-equivalent to a click.

### ImageViewer modal

Full focus management on the lightbox at `components/ImageViewer.tsx`:

- `role="dialog" aria-modal="true" aria-label="Image viewer"` on the
  overlay.
- `triggerRef` captures the activating image. On open, focus moves to
  the close button. On close, focus returns to the trigger so the
  keyboard user lands where they left off.
- Manual focus trap on `overlayRef`. Tab / Shift+Tab cycle inside the
  overlay. Escape closes. Arrow Left / Right paginate.
- Body scroll lock while open.
- Close, Previous, and Next buttons each have explicit `aria-label`
  values ("Close viewer", "Previous image", "Next image").
- The drag-to-close motion logic stayed imperative rather than being
  refactored to Radix Dialog; manual focus trap was the lower-risk
  path.

### ThemeBrowser tablist

The homepage theme picker is a full ARIA tablist following the APG
pattern at `components/ThemeBrowser.tsx`:

- Roving `tabIndex`: only the active tab is `tabIndex={0}`; the rest
  are `tabIndex={-1}`.
- Arrow Left / Right move focus between tabs. Home / End jump to first
  / last. Selection follows focus (the panel content updates as you
  move).
- Each tab declares `aria-controls` pointing at the panel.
- The panel is `role="tabpanel"` with `aria-labelledby` back at the
  active tab.
- The container has `aria-label="Themes"`.
- `tabRefs` is a `Map` keyed by slug so the keyboard handler can move
  focus precisely.

### InterviewQuoteRotator contrast structure

The dark veil over the rotating quote was originally a sibling
`.overlay` div above the photograph and below the text. Visually it
worked, but pa11y's contrast walker stops at the first non-transparent
ancestor and reported white-on-grey (the placeholder bg) instead of
walking up to the dark layer. Restructured: the veil now lives on
`.copy` itself as `background: rgba(0, 0, 0, 0.7)`. Visually identical;
pa11y now computes ~9:1 contrast on the white text. Sibling overlays
defeat the contrast walker — pattern to remember.

### Mobile drawer & filter sheet

Both built on Radix Dialog (`@radix-ui/react-dialog`), which provides
focus management, Escape-to-close, and `role="dialog"` semantics out
of the box. The mobile filter sheet (`ExploreFiltersSheet.tsx`)
overlays a bottom sheet with safe-area-bottom honored.

### Tap target sizing

WCAG 2.5.5 Target Size is AAA, not AA, so this wasn't required —
but it's a usability win we picked up:

- `PhotographerProfile.social` icons: `min-height: 44px`, `padding: 8px`.
- `PhotographersFilters.letterChip`: 44×44.

### Body text sizing

Hard-coded 22px lede / bio sizes on PhotographerProfile and
PhotographersIndex replaced with `var(--text-intro)` so user font-size
preferences are honored. Letter-spacing project-wide refactored from
px to em so spacing scales with font size.

---

## Known limitations

These are flagged honestly rather than papered over:

- **WCAG AAA not pursued.** As stated up top.
- **`prefers-reduced-motion` is respected, not enforced.** Some
  motion uses `useReducedMotion` to soften, but doesn't disable
  outright. The carousel falls back to a static slide. The route
  curtain is skipped. Hover scale and stagger reveals reduce in
  intensity but still play.
- **Route curtain and Hero transitions on top-level navigations are
  not announced.** The route announcer fires after navigation, but
  the curtain animates over the transition itself. Screen-reader
  users hear the destination title announcement, which is the
  outcome that matters.
- **Some letter-spacing em conversions are within ~0.06px of the
  original px values.** Acceptable but technically a tiny shift.
- **Decorative SVGs in `RouteCurtain` are marked `alt=""` and
  `aria-hidden="true"`.** Correct for decorative imagery, but worth
  knowing they're not announced.

---

## How to re-verify

```bash
# In one terminal:
cd frontend && npm run dev

# In another:
npx pa11y --standard WCAG2AA http://localhost:3000/
npx pa11y --standard WCAG2AA http://localhost:3000/essay/<some-slug>
npx pa11y --standard WCAG2AA http://localhost:3000/interview/<some-slug>
npx pa11y --standard WCAG2AA http://localhost:3000/feature/<some-slug>

# Or run @axe-core/cli for a second opinion:
npx @axe-core/cli http://localhost:3000/
```

Chrome must be installed at `/Applications/Google Chrome.app` (or
adjust the PUPPETEER_EXECUTABLE_PATH env var). Both tools run
headless.

Add new routes to the verify list as the site grows:

- `/explore`
- `/themes`
- `/theme/<slug>`
- `/photographers`
- `/photographer/<slug>`
- `/search`
- `/about`, `/submit`, `/contact`, `/shop`
- `/404` (force a bad URL)

---

## What to do when a future change breaks accessibility

The likely failure modes, based on what was found during the pass:

1. **A new muted-text token value drifts below `#6e6e6e`.** Run pa11y
   on any page using the new token.
2. **A new modal or overlay skips focus management.** Pattern to
   follow: `ImageViewer.tsx` for manual traps, or Radix Dialog for
   anything that doesn't have imperative state.
3. **A new interactive element (e.g., a custom button-over-image)
   ships without `aria-label` or keyboard handlers.** Pattern to
   follow: the `ImageViewer` archive-image enhancement.
4. **A new background-on-sibling pattern defeats contrast checks.**
   Pattern to remember: put the dark layer on the text's own
   container as `background: rgba(...)`, not a sibling.
5. **Animation that signals state change has no AT equivalent.**
   The route announcer covers navigation; new state changes need
   their own `aria-live` cue.

---

## File reference

| Concern              | File                                          |
| -------------------- | --------------------------------------------- |
| Skip link            | `components/SkipToContent.tsx` + module CSS   |
| Focus ring           | `app/globals.css`                             |
| Route announcer      | `components/RouteAnnouncer.tsx`               |
| Image-viewer modal   | `components/ImageViewer.tsx`                  |
| Theme tablist        | `components/ThemeBrowser.tsx`                 |
| Mobile drawer        | `components/MobileDrawer.tsx`                 |
| Filter sheet         | `components/ExploreFiltersSheet.tsx`          |
| Muted text token     | `app/globals.css` (`--muted: #6e6e6e`)        |
| `<main>` mounting    | `app/layout.tsx`                              |
