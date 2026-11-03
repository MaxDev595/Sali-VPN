import Svg, { Path } from 'react-native-svg';
import { brand } from '../theme';
import { LOGO_PATHS, MARK_VIEWBOX } from './logoPaths';

/** The original Sali mark (traced 1:1): ring, crescent and pen. `tone="light"` for dark backgrounds. */
export function LogoMark({ size = 40, tone = 'light' }: { size?: number; tone?: 'light' | 'dark' }) {
  const ink = tone === 'light' ? brand.paper : brand.navy;
  const v = MARK_VIEWBOX;
  return <Svg width={size} height={size * v.h / v.w} viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}>
    <Path d={LOGO_PATHS.ring} fill={ink} fillRule="evenodd" />
    <Path d={LOGO_PATHS.swoosh} fill={ink} fillRule="evenodd" />
    <Path d={LOGO_PATHS.nib} fill={ink} />
    <Path d={LOGO_PATHS.cap} fill={brand.peach} />
  </Svg>;
}

/** "sali" (and optionally "VPN") in the logo's own lettering. */
export function LogoWordmark({ height = 22, vpn = false, tone = 'light' }: { height?: number; vpn?: boolean; tone?: 'light' | 'dark' }) {
  const ink = tone === 'light' ? brand.paper : brand.navy;
  const box = vpn ? { x: 290, y: 585, w: 670, h: 450 } : { x: 290, y: 585, w: 670, h: 290 };
  const keys = vpn ? (['s', 'a', 'l', 'i', 'V', 'P', 'N'] as const) : (['s', 'a', 'l', 'i'] as const);
  return <Svg width={height * box.w / box.h} height={height} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
    {keys.map((key) => <Path key={key} d={LOGO_PATHS[key]} fill={ink} fillRule="evenodd" />)}
  </Svg>;
}
