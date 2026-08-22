import { useEffect, useState } from 'react'
import AdSlot from './AdSlot'

const SIDE_RAIL_SLOT = '4549103729'
const GAP_PX = 16

// SideBanners' width is derived from the viewport height (auto aspect ratio),
// not a fixed value, so the gap to clear has to be measured live rather than
// assumed as a constant rem offset.
function useSideBannerWidth(side) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const banner = document.querySelector(`img[data-side-banner="${side}"]`)
    if (!banner) return

    const update = () => setWidth(banner.getBoundingClientRect().width)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(banner)
    return () => observer.disconnect()
  }, [side])

  return width
}

export default function SideRailAds() {
  const leftBannerWidth = useSideBannerWidth('left')
  const rightBannerWidth = useSideBannerWidth('right')

  return (
    <>
      <div
        className="hidden min-[2100px]:block fixed top-24 w-[160px] min-h-[600px] z-10"
        style={{ right: `calc(50% + 32rem + ${leftBannerWidth}px + ${GAP_PX}px)` }}
      >
        <AdSlot slot={SIDE_RAIL_SLOT} format="vertical" />
      </div>
      <div
        className="hidden min-[2100px]:block fixed top-24 w-[160px] min-h-[600px] z-10"
        style={{ left: `calc(50% + 32rem + ${rightBannerWidth}px + ${GAP_PX}px)` }}
      >
        <AdSlot slot={SIDE_RAIL_SLOT} format="vertical" />
      </div>
    </>
  )
}
