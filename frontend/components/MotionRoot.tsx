"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoStage } from "./LogoStage";

/**
 * The site's motion system (docs/MOTION-PLAN.md), in one place:
 *
 *  1. Page to page: internal link clicks run an exit (on-screen blocks
 *     leave in reading order), show the animated logo on the page if the
 *     new page takes over 250ms, push the route, wait for it, then hand off
 *     to the reveals. Back/forward skip the logo.
 *  (No root loading.tsx: it would stream pages in a Suspense boundary
 *  and let this engine touch DOM before hydration. The logo overlay
 *  already covers navigation waits.)
 *  2. Content blocks: anything marked data-reveal / data-reveal-children
 *     / inside data-reveal-scope rises (or wipes) in the first time it
 *     enters the viewport. Items entering together stagger in reading
 *     order (top+left), so grids ripple and titles set line by line.
 *  3. Hover: [data-pz] frames get a pointer-driven zoom and drift
 *     (fine pointers only); CSS does the motion, this sets the vars.
 *
 * All motion is transform / opacity / clip-path. Reduced motion: no
 * exit, no logo hold, reveals become quick fades, no pointer drift.
 */

const WAVE_MS = 650;
const WAVE_CAP_MS = 1100;
const IMG_WAIT_MS = 250;
const EXIT_STEP_MS = 30;
const EXIT_CAP = 6;
const EXIT_MS = 320;
const LOGO_MIN_MS = 480;
/** The logo only appears when the next page takes longer than this.
 *  Prefetched pages arrive first, so most clicks skip it. */
const LOGO_DELAY_MS = 250;
/** Last resort: if the route never changes (a link that redirects back
 *  to the page it's on), put the current page back. */
const STUCK_MS = 12000;

const trimSlash = (p: string) => p.replace(/\/+$/, "") || "/";

type Phase = "idle" | "leaving" | "loading";

const REVEAL_SELECTOR =
  "[data-reveal], [data-reveal-children] > *, [data-reveal-scope] figure";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Wrap a text-only element's words into masked lines. */
function splitLines(el: HTMLElement) {
  if (el.dataset.rvSplit) return;
  if ([...el.childNodes].some((n) => n.nodeType !== Node.TEXT_NODE)) return;
  const text = el.textContent ?? "";
  const words = text.trim().split(/\s+/);
  if (!words.length) return;
  el.setAttribute("aria-label", text.trim());
  el.textContent = "";
  const spans = words.map((w, i) => {
    const s = document.createElement("span");
    s.textContent = w + (i < words.length - 1 ? " " : "");
    s.setAttribute("aria-hidden", "true");
    el.appendChild(s);
    return s;
  });
  const lines: HTMLSpanElement[][] = [];
  let top = -1;
  for (const s of spans) {
    if (s.offsetTop !== top) {
      lines.push([]);
      top = s.offsetTop;
    }
    lines[lines.length - 1].push(s);
  }
  el.textContent = "";
  lines.forEach((ws, li) => {
    const line = document.createElement("span");
    line.className = "rv-line";
    line.setAttribute("aria-hidden", "true");
    const inner = document.createElement("span");
    inner.className = "rv-line-inner";
    inner.style.setProperty("--rv-li", String(li));
    inner.textContent = ws.map((w) => w.textContent).join("");
    line.appendChild(inner);
    el.appendChild(line);
  });
  el.dataset.rvSplit = "1";
}

export function MotionRoot() {
  const router = useRouter();
  const pathname = usePathname();
  const [logoVisible, setLogoVisible] = useState(false);

  const phase = useRef<Phase>("idle");
  const queue = useRef<HTMLElement[]>([]);
  const watching = useRef<Set<HTMLElement>>(new Set());
  const active = useRef(false);
  const seen = useRef<WeakSet<Element>>(new WeakSet());
  const pending = useRef<{ href: string; startedAt: number; logoAt: number | null } | null>(null);
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  /* ---------------- reveals ---------------- */

  // Wave: each item's delay grows with its distance from the batch's
  // top-left corner (across + down the viewport), so a grid ripples
  // diagonally however many items it has.
  const play = (all: HTMLElement[]) => {
    const rects = new Map(all.map((el) => [el, el.getBoundingClientRect()]));
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Anything already above the viewport (a jump link, a fast fling)
    // shows at once with no wave. The wave is measured from what's on
    // screen only; measuring from blocks far above pushed every visible
    // item to the delay cap, so they all rose together.
    const batch: HTMLElement[] = [];
    for (const el of all) {
      if (rects.get(el)!.bottom <= 0) {
        if (el.dataset.reveal === "lines") splitLines(el);
        el.classList.add("rv-in", "rv-instant");
      } else {
        batch.push(el);
      }
    }
    if (!batch.length) return;
    // Tops are clamped to the viewport edge, so a block hanging off the
    // top doesn't push the first visible row's start later.
    const top = (el: HTMLElement) => Math.max(0, rects.get(el)!.top);
    const minTop = Math.min(...batch.map(top));
    const minLeft = Math.min(...batch.map((el) => rects.get(el)!.left));
    batch.forEach((el) => {
      const r = rects.get(el)!;
      const wave = ((r.left - minLeft) / vw + (top(el) - minTop) / vh) * WAVE_MS;
      if (el.dataset.reveal === "lines") splitLines(el);
      el.style.setProperty("--rv-d", `${Math.round(Math.min(wave, WAVE_CAP_MS))}ms`);
      // next frame so the hidden state paints first
      requestAnimationFrame(() => el.classList.add("rv-in"));
    });
  };

  // Give the batch's images a brief head start (250ms) so cached or
  // fast photos rise already in place. Slower ones don't hold the page
  // back: the block rises as its grey frame, so the structure is there,
  // and the photo fades in when it lands.
  const flush = () => {
    if (phase.current !== "idle" || !queue.current.length) return;
    const batch = queue.current.splice(0);
    const imgs = batch.flatMap((el) =>
      el instanceof HTMLImageElement
        ? [el]
        : [...el.querySelectorAll<HTMLImageElement>("img")],
    );
    const pending = imgs.filter((img) => !img.complete);
    if (!pending.length) {
      play(batch);
      return;
    }
    let left = pending.length;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      play(batch);
    };
    const timer = window.setTimeout(go, IMG_WAIT_MS);
    pending.forEach((img) => {
      img.loading = "eager";
      const one = () => {
        left -= 1;
        if (left <= 0) go();
      };
      img.addEventListener("load", one, { once: true });
      img.addEventListener("error", one, { once: true });
    });
  };

  // Position check rather than IntersectionObserver: wipes start fully
  // clipped, and IO treats clipped elements (and their children) as
  // invisible, so they would never reveal.
  const check = () => {
    if (!active.current) return;
    const vh = window.innerHeight;
    for (const el of watching.current) {
      if (!el.isConnected) {
        watching.current.delete(el);
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // Includes anything already scrolled past, so fast flings never
      // leave a block hidden above the viewport.
      // Reveal once well inside the viewport, or fully inside it (so a
      // byline near the bottom of a tall screen never stays hidden).
      if (r.top < vh * 0.92 || (r.bottom <= vh && r.top < vh)) {
        watching.current.delete(el);
        queue.current.push(el);
      }
    }
    flush();
  };

  const register = () => {
    if (!active.current) return;
    document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
      if (seen.current.has(el)) return;
      seen.current.add(el);
      watching.current.add(el);
    });
    check();
  };

  useEffect(() => {
    const root = document.documentElement;
    const vh = window.innerHeight;
    const onFirstScreen = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && (r.width > 0 || r.height > 0);
    };
    // The server HTML is fully visible: nothing waits for JavaScript, so
    // the first screen paints at once (LCP). From here on, what's already
    // on screen stays shown without animating; only content below the fold
    // is hidden, to rise in as it's scrolled to. Page-to-page navigation
    // still runs the full logo + staggered entrance.
    document.querySelectorAll<HTMLImageElement>("img[data-fade], [data-img-body] img").forEach((img) => {
      // Already painted: done. Still loading: show it as it streams in
      // (no fade), but keep the skeleton behind it until it lands.
      if (!onFirstScreen(img)) return;
      if (img.complete) img.dataset.ld = "1";
      else img.dataset.instant = "1";
    });
    root.classList.add("img-fade", "motion-ready");
    if (reducedMotion()) return;
    document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
      if (!onFirstScreen(el)) return;
      seen.current.add(el);
      el.classList.add("rv-in", "rv-instant");
    });
    root.classList.add("motion-on");
    active.current = true;
    register();

    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(register);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    let sraf = 0;
    const onScroll = () => {
      if (!sraf) sraf = requestAnimationFrame(() => { sraf = 0; check(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- image loading ---------------- */

  // Marks images as loaded so CSS swaps the placeholder for a fade-in
  // (globals.css "Image loading"). Runs for reduced motion too.
  useEffect(() => {
    const SEL = "img[data-fade], [data-img-body] img";
    const mark = (img: HTMLImageElement) => {
      if (img.dataset.ld) return;
      // Blur-up images swap only once decoded, so the focus-in never
      // runs on a photo that hasn't painted yet.
      if (img.dataset.lqip !== undefined && typeof img.decode === "function") {
        if (img.dataset.decoding) return;
        img.dataset.decoding = "1";
        img
          .decode()
          .catch(() => {})
          .then(() => {
            img.dataset.ld = "1";
          });
        return;
      }
      img.dataset.ld = "1";
    };
    // Article body photos carry their blur-up source as data-lqip-src
    // (lib/media.ts); apply it as each nears the viewport.
    const lqipIo =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (!e.isIntersecting) continue;
                const img = e.target as HTMLImageElement;
                lqipIo?.unobserve(img);
                const u = img.dataset.lqipSrc;
                if (img.complete || !u || !u.startsWith("https://")) continue;
                img.style.setProperty("--lqip", `url("${u}")`);
                img.dataset.fade = img.dataset.fade ?? "";
                img.dataset.lqip = "";
              }
            },
            { rootMargin: "600px 0px" }
          );
    const scan = () => {
      document.querySelectorAll<HTMLImageElement>(SEL).forEach((img) => {
        if (img.complete) mark(img);
      });
      if (!lqipIo) return;
      document.querySelectorAll<HTMLImageElement>("img[data-lqip-src]:not([data-lqip-seen])").forEach((img) => {
        img.dataset.lqipSeen = "1";
        if (!img.complete) lqipIo.observe(img);
      });
    };
    const onDone = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLImageElement && t.matches(SEL)) mark(t);
    };
    document.addEventListener("load", onDone, true);
    document.addEventListener("error", onDone, true);
    scan();
    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("load", onDone, true);
      document.removeEventListener("error", onDone, true);
      mo.disconnect();
      lqipIo?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  /* ---------------- page to page ---------------- */

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || /^(mailto|tel):/.test(href)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/")) return;
      // Same page, trailing slash or not (query/hash changes stay native).
      if (trimSlash(url.pathname) === trimSlash(window.location.pathname)) return;
      if (reducedMotion() || phase.current !== "idle") return;

      e.preventDefault();
      const target = url.pathname + url.search + url.hash;
      router.prefetch(target);
      phase.current = "leaving";

      // Exit: on-screen revealed blocks leave in reading order.
      const vh = window.innerHeight;
      const onScreen = [...document.querySelectorAll<HTMLElement>("main .rv-in")]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.bottom > 0 && r.top < vh && r.height > 0)
        .sort((a, b) => a.r.top + a.r.left * 0.5 - (b.r.top + b.r.left * 0.5))
        .slice(0, EXIT_CAP);
      onScreen.forEach(({ el }, i) => {
        el.style.setProperty("--rv-xd", `${i * EXIT_STEP_MS}ms`);
        el.classList.add("rv-out");
      });
      document.body.classList.add("is-leaving");

      const startedAt = performance.now();
      window.setTimeout(() => {
        phase.current = "loading";
        pending.current = { href: target, startedAt, logoAt: null };
        router.push(target, { scroll: false });
        clearTimers();
        timers.current.push(
          window.setTimeout(() => {
            if (phase.current !== "loading" || !pending.current) return;
            pending.current.logoAt = performance.now();
            setLogoVisible(true);
          }, LOGO_DELAY_MS),
          window.setTimeout(() => {
            if (phase.current !== "loading") return;
            document.querySelectorAll(".rv-out").forEach((el) => el.classList.remove("rv-out"));
            document.body.classList.remove("is-leaving");
            setLogoVisible(false);
            pending.current = null;
            phase.current = "idle";
          }, STUCK_MS),
        );
      }, EXIT_MS);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  // When the new route has rendered (not its loading state), hand off.
  useEffect(() => {
    const p = pending.current;
    if (!p || phase.current !== "loading") return;
    let cancelled = false;
    const ready = () => {
      const main = document.querySelector("main");
      return main && !main.querySelector('[data-logo-stage="inline"]') && main.children.length > 0;
    };
    const finish = () => {
      if (cancelled) return;
      if (!ready()) {
        requestAnimationFrame(finish);
        return;
      }
      clearTimers();
      // Logo never appeared (the page was ready within LOGO_DELAY_MS):
      // arrive straight away. Otherwise give it its minimum time on screen.
      const shown = p.logoAt !== null;
      const wait = shown ? Math.max(0, LOGO_MIN_MS - (performance.now() - p.logoAt!)) : 0;
      window.setTimeout(() => {
        if (cancelled) return;
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        document.querySelectorAll(".rv-out").forEach((el) => el.classList.remove("rv-out"));
        document.body.classList.remove("is-leaving");
        document.body.classList.add("is-arriving");
        window.setTimeout(() => document.body.classList.remove("is-arriving"), 320);
        setLogoVisible(false);
        pending.current = null;
        // Let the logo clear (200ms) before the new page starts arriving,
        // so the hero wipe never plays underneath it.
        window.setTimeout(() => {
          phase.current = "idle";
          register();
          check();
        }, shown ? 200 : 0);
      }, wait);
    };
    requestAnimationFrame(finish);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* ---------------- pointer zoom ---------------- */

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (reducedMotion()) return;
    let current: HTMLElement | null = null;
    let raf = 0;
    let last: PointerEvent | null = null;

    const reset = (el: HTMLElement) => {
      el.classList.remove("pz-on");
      el.style.setProperty("--pz-x", "0");
      el.style.setProperty("--pz-y", "0");
    };

    const apply = () => {
      raf = 0;
      if (!last) return;
      const el = (last.target as HTMLElement | null)?.closest<HTMLElement>("[data-pz]") ?? null;
      if (el !== current) {
        if (current) reset(current);
        current = el;
        if (el) el.classList.add("pz-on");
      }
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (last.clientX - r.left) / r.width)) - 0.5;
      const y = Math.min(1, Math.max(0, (last.clientY - r.top) / r.height)) - 0.5;
      el.style.setProperty("--pz-x", x.toFixed(3));
      el.style.setProperty("--pz-y", y.toFixed(3));
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeaveDoc = () => {
      if (current) reset(current);
      current = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeaveDoc);
    window.addEventListener("blur", onLeaveDoc);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeaveDoc);
      window.removeEventListener("blur", onLeaveDoc);
    };
  }, []);

  return <LogoStage variant="overlay" visible={logoVisible} />;
}
