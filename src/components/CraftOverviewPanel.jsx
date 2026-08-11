import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatYang } from '../utils/formatYang'
import { formatItemName } from '../utils/itemName'

function shortYang(v) {
  return formatYang(v).replace(' yang', '')
}

function OverviewIcon({ row, large }) {
  const name = row.kind === 'item' ? formatItemName(row.material) : row.material.name
  const box = large ? 'w-10 h-10' : 'w-9 h-9'
  const img = large ? 'w-7 h-7' : 'w-6 h-6'
  const to = row.kind === 'item' ? `/chapter/${row.material.category_id}/item/${row.material.id}` : `/materials/${row.material.id}`
  return (
    <Link
      to={to}
      className={`relative ${box} shrink-0 bg-black/40 border border-gray-700 rounded-md flex items-center justify-center hover:border-yellow-400/50 transition-colors`}
      title={name}
    >
      {row.material.image_url
        ? <img src={row.material.image_url} alt={name} className={`${img} object-contain`} />
        : <span className="text-base">{row.kind === 'item' ? '⚔️' : '🧪'}</span>}
      <span className="absolute right-0 bottom-0 text-[0.6rem] leading-tight font-bold text-amber-100 bg-black/80 rounded px-0.5">
        ×{row.quantity}
      </span>
    </Link>
  )
}

// Compact "at a glance" summary of an item's craft + upgrade path, shown above
// the interactive calculator. Reads the same grouped/yangCosts data the
// calculator itself uses, so the two are always in sync.
export default function CraftOverviewPanel({ allSteps, grouped, yangCosts }) {
  const { t } = useTranslation()
  const upgradeSteps = allSteps.filter(s => s !== 0)
  const craftMats = grouped[0] ?? []

  if (upgradeSteps.length === 0 && craftMats.length === 0) return null

  const maxRows = upgradeSteps.length > 0 ? Math.max(1, ...upgradeSteps.map(s => (grouped[s] ?? []).length)) : 0

  return (
    <div className="flex flex-col gap-5 mb-6">
      {upgradeSteps.length > 0 && (
        <div>
          <div className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2">{t('itemDetail.overviewUpgrade')}</div>
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <div
              className="grid bg-gray-900 min-w-full"
              style={{ gridTemplateColumns: `minmax(3.4rem,4rem) repeat(${upgradeSteps.length}, minmax(2.3rem, 1fr))` }}
            >
              <div className="bg-gray-800/80 text-[0.6rem] font-bold uppercase text-gray-500 border-b border-r border-gray-800 flex items-center justify-center px-1 py-1.5">
                {t('common.material')}
              </div>
              {upgradeSteps.map(step => (
                <div key={step} className="bg-gray-800/80 text-yellow-400 text-xs font-bold border-b border-r border-gray-800 flex items-center justify-center py-1.5 font-mono">
                  +{step}
                </div>
              ))}

              {Array.from({ length: maxRows }).map((_, row) => (
                <div key={row} className="contents">
                  <div className="bg-gray-800/40 border-b border-r border-gray-800" />
                  {upgradeSteps.map(step => {
                    const r = (grouped[step] ?? [])[row]
                    return (
                      <div key={step} className="h-12 border-b border-r border-gray-800 flex items-center justify-center p-1">
                        {r ? <OverviewIcon row={r} /> : <span className="text-gray-600 text-sm">–</span>}
                      </div>
                    )
                  })}
                </div>
              ))}

              <div className="bg-gray-800/40 text-[0.58rem] text-gray-500 border-r border-gray-800 flex items-center justify-end px-1.5">
                {t('itemDetail.overviewPrice')}
              </div>
              {upgradeSteps.map(step => (
                <div key={step} className="h-8 border-r border-gray-800 flex items-center justify-center text-yellow-400 text-[0.66rem] font-bold font-mono">
                  {shortYang(yangCosts[step] ?? 0)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {craftMats.length > 0 && (
        <div>
          <div className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2">{t('itemDetail.step0')}</div>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2 bg-gray-900 border border-gray-700 rounded-xl p-2.5">
              {craftMats.map(row => (
                <OverviewIcon key={`${row.kind}-${row.material.id}`} row={row} large />
              ))}
            </div>
            <div className="inline-flex items-center gap-2 self-start bg-yellow-600/15 border border-yellow-500/30 rounded-lg px-3 py-1.5">
              <span className="text-base leading-none">💰</span>
              <span className="text-yellow-400 font-bold text-sm font-mono">{formatYang(yangCosts[0] ?? 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
