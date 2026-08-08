import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Tile from '../components/Tile'

export default function Systems() {
  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Systems' }]} />
          <h1 className="text-2xl font-bold text-gray-100 mb-6">Systems</h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <Tile to="/systems/interactive-map" emoji="🗺️" label="Mococko Interactive Map" />
          </div>
        </div>
      </div>
    </div>
  )
}
