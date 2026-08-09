import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'

export default function PrivacyPolicy() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: 'Polityka prywatności' },
          ]} />

          <h1 className="text-2xl font-bold text-gray-100 mb-1">Polityka prywatności</h1>
          <p className="text-xs text-gray-500 mb-6">Ostatnia aktualizacja: 9 sierpnia 2026</p>
          <p className="text-xs text-gray-500 mb-8 italic">
            This page is currently only available in Polish. If you need information in another language, contact us at the address below.
          </p>

          <div className="flex flex-col gap-6 text-sm text-gray-300 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Czym jest ta strona</h2>
              <p>
                Baerim Calculator to nieoficjalne, fanowskie narzędzie stworzone dla graczy serwera Baerim (Metin2).
                Strona nie jest powiązana z zespołem Baerim ani z twórcami gry Metin2. Nie wymaga zakładania konta
                ani logowania, żeby z niej korzystać.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Dane przechowywane lokalnie w Twojej przeglądarce</h2>
              <p className="mb-2">
                Strona zapisuje część danych wyłącznie lokalnie, w pamięci Twojej przeglądarki (localStorage) —
                te dane nie są wysyłane na żaden serwer i znikają, jeśli wyczyścisz dane przeglądania. Służą do
                zapamiętania Twoich ustawień i postępów między odwiedzinami:
              </p>
              <ul className="list-disc list-inside flex flex-col gap-1 text-gray-400">
                <li>wybrany język strony i tryb nocny</li>
                <li>ustawiona wielkość interfejsu (skala HUD)</li>
                <li>wpisany nick z gry Metin2 (używany do podpisywania wpisów w Hall of Fame)</li>
                <li>lista zebranych mokoko na mapach interaktywnych</li>
                <li>polubione komentarze pod markerami mokoko</li>
                <li>Twoje własne, ręcznie wpisane ceny materiałów oraz lista w Build Calculatorze</li>
                <li>wybory tomarów/pieczęci/pity zapisane dla poszczególnych itemków</li>
                <li>krótkotrwałe blokady czasowe po użyciu zakazanego słowa w komentarzu</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Dane wysyłane na serwer</h2>
              <p>
                Jeśli dodajesz komentarz pod mokoko na mapie (opcjonalnie razem ze zdjęciem), zgłaszasz cenę do
                globalnej bazy cen, lub zostawiasz swój nick do Hall of Fame — te dane trafiają do bazy danych
                strony (Supabase) i są widoczne publicznie dla innych odwiedzających. Nie proś o podawanie w
                komentarzach danych osobowych — nie są one do tego potrzebne.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Cookies i reklamy</h2>
              <p>
                Obecnie strona nie wyświetla reklam ani nie używa cookies do śledzenia czy profilowania. W
                przyszłości planowane jest dodanie niewielkich, mało inwazyjnych reklam (np. Google AdSense) —
                jeśli to nastąpi, przed załadowaniem jakichkolwiek cookies reklamowych poprosimy o Twoją zgodę
                za pomocą banera na dole strony, a ta polityka zostanie zaktualizowana o szczegóły.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Logi hostingu</h2>
              <p>
                Jak większość stron internetowych, infrastruktura hostingowa (Vercel) i baza danych (Supabase),
                z których korzysta ta strona, mogą standardowo zapisywać adres IP i podstawowe informacje
                techniczne o żądaniach (np. typ przeglądarki) w ramach normalnego działania i bezpieczeństwa
                usługi. Nie mamy do tych danych bezpośredniego dostępu poza podstawowymi statystykami.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Twoje prawa</h2>
              <p>
                Dane zapisane lokalnie możesz w każdej chwili usunąć, czyszcząc dane przeglądania dla tej strony.
                Jeśli chcesz, żebyśmy usunęli komentarz, zdjęcie lub wpis w Hall of Fame, który dodałeś/aś,
                napisz do nas na adres podany poniżej.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Zmiany tej polityki</h2>
              <p>
                Ta polityka może być aktualizowana wraz z rozwojem strony (np. po uruchomieniu reklam). Data
                ostatniej aktualizacji znajduje się na górze strony.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Kontakt</h2>
              <p>
                W sprawach związanych z prywatnością napisz na adres:{' '}
                <a href="mailto:anois131313@gmail.com" className="text-yellow-400 hover:underline">
                  anois131313@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
