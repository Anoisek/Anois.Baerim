import { useState } from 'react'
import OreFinderReportPlacesModal from './OreFinderReportPlacesModal'

export default function OreFinderBotGuideModal({ maps = [], onClose, t }) {
  const [showPlaces, setShowPlaces] = useState(false)
  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl shadow-black/50 max-h-[90vh] overflow-y-auto"
      >
        <p className="text-xl font-extrabold text-yellow-400 tracking-wide">{t('oreFinder.guideTitle')}</p>

        <ol className="flex flex-col gap-3 text-sm text-gray-200 list-decimal list-inside">
          <li>{t('oreFinder.guideStep1')}</li>
          <li>
            {t('oreFinder.guideStep2')}
            <code className="block mt-1.5 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-yellow-300 font-mono text-xs w-fit">
              /orefinder-here
            </code>
          </li>
          <li>
            {t('oreFinder.guideStep3')}
            <code className="block mt-1.5 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-yellow-300 font-mono text-xs w-fit">
              /orefinder-role @rola
            </code>
          </li>
        </ol>

        <div>
          <p className="text-xs text-gray-400 mb-2">{t('oreFinder.guideExampleLabel')}</p>
          <img
            src="/ore-finder-bot-example.png"
            alt="Przykładowa wiadomość bota Ore Finder na Discordzie"
            className="w-full rounded-lg border border-gray-700"
          />
        </div>

        <div className="border-t border-gray-700 pt-4 flex flex-col gap-3">
          <p className="text-base font-extrabold text-yellow-400">{t('oreFinder.guideReportTitle')}</p>
          <ol className="flex flex-col gap-3 text-sm text-gray-200 list-decimal list-inside">
            <li>
              {t('oreFinder.guideReportStep1')}
              <code className="block mt-1.5 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-yellow-300 font-mono text-xs w-fit">
                /orefinder-reportmap Yongan (red)
              </code>
            </li>
            <li>
              {t('oreFinder.guideReportStep2')}
              <code className="block mt-1.5 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-yellow-300 font-mono text-xs w-fit">
                @Ore Finder 512 734
              </code>
            </li>
            <li>
              {t('oreFinder.guideReportStep3')}
              <code className="block mt-1.5 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-yellow-300 font-mono text-xs w-fit">
                @Ore Finder bio
              </code>
            </li>
          </ol>
          <button
            type="button"
            onClick={() => setShowPlaces(true)}
            className="w-fit px-3 py-2 rounded-xl text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 border border-red-500/50 text-red-200 transition-colors"
          >
            ⭕ {t('oreFinder.reportPlacesButton')}
          </button>
          <ul className="flex flex-col gap-1.5 text-xs text-gray-400 list-disc list-inside">
            <li>{t('oreFinder.guideReportWindow')}</li>
            <li>{t('oreFinder.guideReportOnce')}</li>
            <li>{t('oreFinder.guideReportPermission')}</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 text-gray-950 transition-colors"
        >
          {t('oreFinder.guideCloseButton')}
        </button>
      </div>
    </div>
    {showPlaces && <OreFinderReportPlacesModal maps={maps} onClose={() => setShowPlaces(false)} t={t} />}
    </>
  )
}
