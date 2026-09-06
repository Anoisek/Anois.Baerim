export default function Modal({ title, onClose, children, maxWidthClass = 'max-w-lg', horizontal }) {
  const box = horizontal ? 'bg-[#1c1712] border-white/10' : 'bg-gray-900 border-gray-700'
  const headerBorder = horizontal ? 'border-white/10' : 'border-gray-700'
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`border rounded-xl w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto ${box}`}>
        <div className={`flex items-center justify-between p-6 border-b ${headerBorder}`}>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
