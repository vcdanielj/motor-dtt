import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useStore } from '@/state/store'

export default function DropZone() {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | null | undefined) => {
    if (!file) return
    void useStore.getState().startPipeline(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  return (
    <div
      data-testid="dropzone"
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
        isDragging ? 'border-navy bg-bg' : 'border-line bg-panel'
      }`}
    >
      <div className="text-sm font-semibold text-navy">
        Arrastra un archivo CSV/XLSX o haz clic para seleccionar
      </div>
      <div className="text-xs text-slate">Formatos soportados: .csv, .xlsx, .xls</div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={onInputChange}
        className="hidden"
      />
    </div>
  )
}
