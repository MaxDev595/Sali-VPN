import { useEffect, useId, useRef } from 'react';
import { LOGO_COLORS, LOGO_DRAW as D, LOGO_PATHS, LOGO_VIEWBOX, MARK_VIEWBOX } from './logoPaths';

/**
 * The original Sali logo (traced 1:1, original colours) drawing itself — same
 * choreography as the app launch (apps/mobile/src/components/LogoIntro.tsx):
 * draw ring + crescent → lift and tilt → line up on the pen axis → slide in →
 * click (squash, cap snaps, peach ripples) → "sali" and "VPN" rise.
 * Meant to sit on white.
 */
const T = {
  penIn: [0, 420], draw: [420, 1850], lift: [1850, 2180], align: [2120, 2420], insert: [2420, 2600],
  impact: [2600, 3000], ripple: [2600, 3150], ripple2: [2720, 3300], pulse: [2600, 2950], word: [2850, 3550], vpn: [3300, 3900],
} as const;
const END = 4000;
const LETTERS = ['s', 'a', 'l', 'i'] as const;
const VPN = ['V', 'P', 'N'] as const;
const AXIS = { x: .742, y: -.671 };
const A = { x: AXIS.x * 120, y: AXIS.y * 120 };
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const phase = (t: number, w: readonly [number, number]) => clamp((t - w[0]) / (w[1] - w[0]));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeIn = (x: number) => x * x * x;
const wobble = (x: number) => Math.exp(-5 * x) * Math.sin(14 * x);
const ringPoint = (deg: number) => { const r = (deg * Math.PI) / 180; return { x: D.center.x + D.penRadius * Math.cos(r), y: D.center.y + D.penRadius * Math.sin(r) }; };

function penPose(t: number) {
  const pIn = easeOut(phase(t, T.penIn));
  const d = easeInOut(phase(t, T.draw));
  let dx: number, dy: number, rot = 0, scale = 1.04, cap = 0, shadow = 0;
  if (t < T.lift[0]) {
    const tip = ringPoint(D.startDeg - D.sweepDeg * d);
    dx = tip.x - D.nibTip.x; dy = tip.y - D.nibTip.y;
    if (t < T.draw[0]) { dy -= 60 * (1 - pIn); dx += 30 * (1 - pIn); scale = .9 + .14 * pIn; }
  } else {
    const end = ringPoint(D.startDeg - D.sweepDeg);
    const E = { x: end.x - D.nibTip.x, y: end.y - D.nibTip.y };
    const H = { x: E.x + 50, y: E.y - 170 };
    const l = easeOut(phase(t, T.lift)), al = easeInOut(phase(t, T.align)), ins = easeIn(phase(t, T.insert)), im = phase(t, T.impact);
    dx = mix(E.x, H.x, l); dy = mix(E.y, H.y, l); rot = mix(0, -26, l); scale = mix(1.04, 1.12, l); shadow = l;
    if (al > 0) { dx = mix(dx, A.x, al); dy = mix(dy, A.y, al); rot = mix(-26, 0, al); }
    if (ins > 0) { dx = mix(A.x, 0, ins); dy = mix(A.y, 0, ins); scale = mix(1.12, 1, ins); shadow = 1 - ins; }
    if (im > 0) { const w = wobble(im); scale = 1 - .07 * w; cap = -10 * w; dx = AXIS.x * 4 * w; dy = AXIS.y * 4 * w; rot = 2 * w; }
  }
  return { dx, dy, rot, scale, cap, shadow, opacity: pIn };
}

export function AnimatedLogo({ wordmark = true, ink = LOGO_COLORS.navy, className = '', replayKey = 0 }: { wordmark?: boolean; ink?: string; className?: string; replayKey?: number }) {
  const root = useRef<SVGSVGElement>(null);
  const reveal = useRef<SVGPathElement>(null);
  const pen = useRef<SVGGElement>(null);
  const cap = useRef<SVGPathElement>(null);
  const mark = useRef<SVGGElement>(null);
  const shadowEl = useRef<SVGFEDropShadowElement>(null);
  const ripples = useRef<(SVGCircleElement | null)[]>([]);
  const letters = useRef<(SVGPathElement | null)[]>([]);
  const uid = useId().replace(/:/g, '');
  const v = wordmark ? LOGO_VIEWBOX : MARK_VIEWBOX;

  useEffect(() => {
    const revealEl = reveal.current!, penEl = pen.current!, capEl = cap.current!, markEl = mark.current!, sh = shadowEl.current!;
    revealEl.style.strokeDasharray = `${D.maskLength}`;
    const frame = (t: number) => {
      const d = easeInOut(phase(t, T.draw));
      revealEl.style.strokeDashoffset = `${D.maskLength * (1 - d)}`;
      revealEl.style.opacity = d > .002 ? '1' : '0';
      const p = penPose(t);
      const { x: tx, y: ty } = D.nibTip;
      penEl.setAttribute('transform', `translate(${p.dx} ${p.dy}) rotate(${p.rot} ${tx} ${ty}) translate(${tx} ${ty}) scale(${p.scale}) translate(${-tx} ${-ty})`);
      penEl.style.opacity = `${p.opacity}`;
      capEl.setAttribute('transform', `translate(${AXIS.x * p.cap} ${AXIS.y * p.cap})`);
      sh.setAttribute('flood-opacity', `${.3 * p.shadow}`); sh.setAttribute('dy', `${4 + 16 * p.shadow}`); sh.setAttribute('stdDeviation', `${6 + 8 * p.shadow}`);
      [[T.ripple, 150, .8, 12], [T.ripple2, 220, .3, 6]].forEach(([w, grow, alpha, width], i) => {
        const el = ripples.current[i]; if (!el) return;
        const r = phase(t, w as readonly [number, number]);
        el.setAttribute('r', `${10 + (grow as number) * easeOut(r)}`);
        el.setAttribute('opacity', `${r > 0 && r < 1 ? (alpha as number) * (1 - r) : 0}`);
        el.setAttribute('stroke-width', `${(width as number) * (1 - r) + 1}`);
      });
      const pulse = Math.sin(phase(t, T.pulse) * Math.PI) * .035;
      markEl.setAttribute('transform', `translate(${D.center.x} ${D.center.y}) scale(${1 + pulse}) translate(${-D.center.x} ${-D.center.y})`);
      letters.current.forEach((el, i) => {
        if (!el) return;
        const isVpn = i >= LETTERS.length;
        const start = isVpn ? T.vpn[0] + (i - LETTERS.length) * 90 : T.word[0] + i * 85;
        const e = easeOut(clamp((t - start) / 460));
        el.style.opacity = `${e}`;
        el.setAttribute('transform', `translate(0 ${(isVpn ? 18 : 40) * (1 - e)})`);
      });
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { frame(END); return; }
    frame(0);
    let raf = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const t0 = performance.now();
      const loop = (now: number) => { const t = now - t0; frame(t); if (t < END) raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }, { threshold: .4 });
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [replayKey]);

  return <svg ref={root} className={className} viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} role="img" aria-label="Sali VPN" style={{ overflow: 'visible' }}>
    <defs>
      <mask id={`r${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254"><path ref={reveal} d={D.maskPath} stroke="#fff" strokeWidth={D.maskWidth} fill="none" /></mask>
      <filter id={`s${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feDropShadow ref={shadowEl} dx="0" dy="4" stdDeviation="6" floodColor={LOGO_COLORS.navy} floodOpacity="0" /></filter>
    </defs>
    <g ref={mark}>
      <g mask={`url(#r${uid})`}><path d={LOGO_PATHS.ring} fill={ink} fillRule="evenodd" /><path d={LOGO_PATHS.swoosh} fill={ink} fillRule="evenodd" /></g>
      {[0, 1].map((i) => <circle key={i} ref={(el) => { ripples.current[i] = el; }} cx={D.nibTip.x} cy={D.nibTip.y} r="0" fill="none" stroke={LOGO_COLORS.peach} opacity="0" />)}
      <g ref={pen} filter={`url(#s${uid})`}><path d={LOGO_PATHS.nib} fill={ink} /><path ref={cap} d={LOGO_PATHS.cap} fill={LOGO_COLORS.peach} /></g>
    </g>
    {wordmark && [...LETTERS, ...VPN].map((key, i) => <path key={key} ref={(el) => { letters.current[i] = el; }} d={LOGO_PATHS[key]} fill={ink} fillRule="evenodd" />)}
  </svg>;
}

/** Static original mark. */
export function LogoMarkStatic({ ink = LOGO_COLORS.navy, className = '' }: { ink?: string; className?: string }) {
  const v = MARK_VIEWBOX;
  return <svg className={className} viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} aria-hidden="true">
    <path d={LOGO_PATHS.ring} fill={ink} fillRule="evenodd" /><path d={LOGO_PATHS.swoosh} fill={ink} fillRule="evenodd" />
    <path d={LOGO_PATHS.nib} fill={ink} /><path d={LOGO_PATHS.cap} fill={LOGO_COLORS.peach} />
  </svg>;
}

/** The logo's mark on a white tile — how the logo appears on dark UI. */
export function LogoBadge({ className = '' }: { className?: string }) {
  return <span className={`sali-badge ${className}`}><LogoMarkStatic /></span>;
}

/** Original wordmark ("sali" + "VPN") in the logo's own lettering. */
export function LogoWordmark({ ink = '#F4F7FC', className = '', vpn = true }: { ink?: string; className?: string; vpn?: boolean }) {
  const keys = vpn ? [...LETTERS, ...VPN] : [...LETTERS];
  return <svg className={className} viewBox={vpn ? '290 585 670 450' : '290 585 670 290'} aria-label="sali VPN">{keys.map((key) => <path key={key} d={LOGO_PATHS[key]} fill={ink} fillRule="evenodd" />)}</svg>;
}
