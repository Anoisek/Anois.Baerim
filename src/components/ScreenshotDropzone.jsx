import { useRef, useState } from 'react'

export default function ScreenshotDropzone({ onFiles, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleFiles(fileList) {
    const files = [...fileList].filter(f => f.type.startsWith('image/'))
    if (files.length > 0) onFiles(files)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-2xl px-6 py-8 text-center transition-colors ${
        disabled ? 'border-gray-700 bg-gray-900/50 cursor-not-allowed' :
        dragging ? 'border-yellow-400 bg-yellow-400/10 cursor-pointer' : 'border-gray-600 hover:border-gray-500 bg-gray-900 cursor-pointer'
      }`}
    >
      <span className="text-3xl">📸</span>
      <p className="text-sm text-gray-300">Drag & drop farm session screenshots here</p>
      <p className="text-xs text-gray-500">or click to browse — you can drop several at once</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
