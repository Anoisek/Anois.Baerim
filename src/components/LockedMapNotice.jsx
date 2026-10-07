import { useTranslation } from 'react-i18next'

// What a non-admin sees for a locked map (maps.locked) on the interactive map
// and /mokoko-finder: the map image greyed out, no markers, and a notice. The
// worker withholds the markers themselves too (hiddenWhere in worker/src/db.js).
export default function LockedMapNotice({ imageUrl, width, height, name }) {
  const { t } = useTranslation()
  return (
    <div
      className="relative w-full rounded-xl border border-gray-700 bg-gray-950 overflow-hidden select-none"
      style={{ maxHeight: '70vh', aspectRatio: `${width} / ${height}` }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          draggable="false"
          className="w-full h-full object-contain grayscale opacity-30 pointer-events-none"
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="text-4xl">🔒</span>
        <p className="text-lg font-bold text-gray-100 drop-shadow">{t('maps.mapUnavailable')}</p>
      </div>
    </div>
  )
}
