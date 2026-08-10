import AdSlot from './AdSlot'

const SIDE_RAIL_SLOT = '4549103729'

export default function SideRailAds() {
  return (
    <>
      <div className="hidden min-[1600px]:block fixed top-24 left-4 w-[160px] min-h-[600px] z-10">
        <AdSlot slot={SIDE_RAIL_SLOT} format="vertical" />
      </div>
      <div className="hidden min-[1600px]:block fixed top-24 right-4 w-[160px] min-h-[600px] z-10">
        <AdSlot slot={SIDE_RAIL_SLOT} format="vertical" />
      </div>
    </>
  )
}
