const ADSENSE_CLIENT = 'ca-pub-1407964187221252'
const SCRIPT_ID = 'adsbygoogle-script'

export function loadAdSenseScript() {
  if (document.getElementById(SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}
