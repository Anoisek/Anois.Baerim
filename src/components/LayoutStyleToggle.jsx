import { useLayoutStyle } from '../context/LayoutStyleContext'

export default function LayoutStyleToggle() {
  const { horizontal, toggleLayout } = useLayoutStyle()

  return (
    <button
      onClick={toggleLayout}
      className="text-lg leading-none hover:opacity-80 transition-opacity p-1.5"
      title={horizontal ? 'Przełącz na widok pionowy' : 'Przełącz na widok poziomy'}
    >
      {horizontal ? '📱' : '🖥️'}
    </button>
  )
}
