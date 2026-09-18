import { splitLinks } from '../utils/linkFilter'

// Renders user-written text with YouTube links clickable; every other link-like
// string stays plain text (the server rejects new ones, old comments may still hold some).
export default function LinkifiedText({ text }) {
  return splitLinks(text).map((part, i) => part.url ? (
    <a
      key={i}
      href={part.url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="text-yellow-400 hover:underline break-all"
    >
      {part.text}
    </a>
  ) : (
    <span key={i}>{part.text}</span>
  ))
}
