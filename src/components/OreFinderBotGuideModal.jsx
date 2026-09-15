export default function OreFinderBotGuideModal({ onClose, t }) {
  return (
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

        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 text-gray-950 transition-colors"
        >
          {t('oreFinder.guideCloseButton')}
        </button>
      </div>
    </div>
  )
}
