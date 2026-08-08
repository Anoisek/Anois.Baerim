import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'

export default function ImageUpload({ onUploaded, bucket = 'images' }) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`

    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) {
      alert(t('imageUpload.uploadError', { message: error.message }))
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    onUploaded(data.publicUrl)
    setUploading(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {preview && (
        <img src={preview} alt="" className="w-24 h-24 object-contain rounded-lg border border-gray-600" />
      )}
      <label className="cursor-pointer bg-gray-800 border border-dashed border-gray-500 hover:border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-400 hover:text-white text-center transition-colors">
        {uploading ? t('imageUpload.uploading') : t('imageUpload.chooseFile')}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  )
}
