import { generateOGImage } from 'fumadocs-ui/og'
import { appName, siteTagline, siteUrl } from '@/lib/shared'

export const alt = `${appName} — ${siteTagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** The Fumadocs template fits one title line and about three description lines before text overlaps. */
export default function OpenGraphImage() {
  return generateOGImage({
    title: appName,
    description: siteTagline,
    site: new URL(siteUrl).host,
  })
}
