import { useNightMode } from '../context/NightModeContext'

export default function NightModeToggle() {
  const { night, toggleNight } = useNightMode()

  return (
    <button
      onClick={toggleNight}
      className="text-lg leading-none hover:opacity-80 transition-opacity p-1.5"
      title={night ? 'Switch to normal mode' : 'Switch to night mode'}
    >
      {night ? '☀️' : '🌙'}
    </button>
  )
}
