import NavbarH from './NavbarH'
import { AboutContent } from '../pages/About'

export default function AboutH() {
  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <AboutContent />
      </div>
    </div>
  )
}
