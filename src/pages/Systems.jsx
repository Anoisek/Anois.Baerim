import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'

export default function Systems() {
  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Systems' }]} />
          <h1 className="text-2xl font-bold text-gray-100 mb-6">Systems</h1>

          <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
            <span className="text-5xl">⚙️</span>
            <p className="text-sm">No systems yet.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
