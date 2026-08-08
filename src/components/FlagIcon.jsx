const FLAGS = {
  en: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="20" fill="#00247d" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" strokeWidth="3.5" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#cf142b" strokeWidth="1.3" />
      <path d="M15,0 V20 M0,10 H30" stroke="#fff" strokeWidth="5.5" />
      <path d="M15,0 V20 M0,10 H30" stroke="#cf142b" strokeWidth="2.2" />
    </svg>
  ),
  pl: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="10" fill="#fff" />
      <rect y="10" width="30" height="10" fill="#dc143c" />
    </svg>
  ),
  de: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#dd0000" />
      <rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    </svg>
  ),
  es: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="20" fill="#c60b1e" />
      <rect y="5" width="30" height="10" fill="#ffc400" />
    </svg>
  ),
  pt: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="12" height="20" fill="#006600" />
      <rect x="12" width="18" height="20" fill="#ff0000" />
      <circle cx="12" cy="10" r="3.5" fill="#ffcc00" stroke="#fff" strokeWidth="0.5" />
    </svg>
  ),
  it: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="10" height="20" fill="#009246" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ce2b37" />
    </svg>
  ),
  el: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="20" fill="#0d5eaf" />
      <g fill="#fff">
        <rect y="2.22" width="30" height="2.22" />
        <rect y="6.67" width="30" height="2.22" />
        <rect y="11.11" width="30" height="2.22" />
        <rect y="15.56" width="30" height="2.22" />
      </g>
      <rect width="11.11" height="11.11" fill="#0d5eaf" />
      <rect x="4.44" width="2.22" height="11.11" fill="#fff" />
      <rect y="4.44" width="11.11" height="2.22" fill="#fff" />
    </svg>
  ),
  cs: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="10" fill="#fff" />
      <rect y="10" width="30" height="10" fill="#d7141a" />
      <polygon points="0,0 0,20 15,10" fill="#11457e" />
    </svg>
  ),
  sk: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="6.67" fill="#fff" />
      <rect y="6.67" width="30" height="6.67" fill="#0b4ea2" />
      <rect y="13.33" width="30" height="6.67" fill="#ee1c25" />
    </svg>
  ),
  ro: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="10" height="20" fill="#002b7f" />
      <rect x="10" width="10" height="20" fill="#fcd116" />
      <rect x="20" width="10" height="20" fill="#ce1126" />
    </svg>
  ),
  tr: (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="12" cy="10" r="5" fill="#fff" />
      <circle cx="13.5" cy="10" r="4" fill="#e30a17" />
      <polygon points="21,7.6 21.7,9.6 23.8,9.6 22.1,10.8 22.8,12.8 21,11.6 19.2,12.8 19.9,10.8 18.2,9.6 20.3,9.6" fill="#fff" />
    </svg>
  ),
}

export default function FlagIcon({ code, className }) {
  return (
    <span className={`inline-block overflow-hidden shrink-0 ${className ?? ''}`}>
      {FLAGS[code] ?? FLAGS.en}
    </span>
  )
}
