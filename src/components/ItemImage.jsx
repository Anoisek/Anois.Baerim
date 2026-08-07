import { useEffect, useState } from 'react'

const INTERVAL_MS = 3000

export default function ItemImage({ images, alt, className }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (images.length <= 1) return
    const id = setInterval(() => setIndex(i => (i + 1) % images.length), INTERVAL_MS)
    return () => clearInterval(id)
  }, [images.join('|')])

  if (images.length === 0) return null
  return <img src={images[index]} alt={alt} className={className} />
}
