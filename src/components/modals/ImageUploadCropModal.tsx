import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, ZoomIn, ZoomOut, RotateCw, Check, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiUrl } from '../../config/api';

interface ImageUploadCropModalProps {
  isOpen: boolean;
  title?: string;
  aspectRatio?: 'circle' | 'square' | 'banner';
  maxDimension?: number;
  onClose: () => void;
  onImageUploaded: (url: string) => void;
}

export const ImageUploadCropModal: React.FC<ImageUploadCropModalProps> = ({
  isOpen,
  title = 'Upload & Edit Gambar',
  aspectRatio = 'circle',
  maxDimension = 400,
  onClose,
  onImageUploaded
}) => {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setImageSrc(null);
      setImageObj(null);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Format Tidak Didukung', 'Silakan pilih file gambar (PNG, JPG, WebP, dll).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setImageSrc(src);
      const img = new Image();
      img.onload = () => {
        setImageObj(img);
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Draw Canvas Preview
  useEffect(() => {
    if (!imageObj || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 300;
    canvas.width = size;
    canvas.height = aspectRatio === 'banner' ? 120 : size;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Calculate aspect fit
    const hRatio = canvas.width / imageObj.width;
    const vRatio = canvas.height / imageObj.height;
    const ratio = Math.max(hRatio, vRatio);

    const drawWidth = imageObj.width * ratio;
    const drawHeight = imageObj.height * ratio;

    ctx.drawImage(imageObj, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }, [imageObj, zoom, rotation, pan, aspectRatio]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Crop, Compress and Upload
  const handleCropAndUpload = async () => {
    if (!imageObj || !canvasRef.current) return;

    setLoading(true);

    try {
      // Create high-res export canvas
      const exportCanvas = document.createElement('canvas');
      const exportWidth = maxDimension;
      const exportHeight = aspectRatio === 'banner' ? Math.round(maxDimension * 0.4) : maxDimension;

      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;
      const ctx = exportCanvas.getContext('2d');

      if (!ctx) throw new Error('Canvas context error');

      const scaleMultiplier = exportWidth / 300;

      ctx.save();
      ctx.translate(exportWidth / 2 + pan.x * scaleMultiplier, exportHeight / 2 + pan.y * scaleMultiplier);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom * scaleMultiplier, zoom * scaleMultiplier);

      const hRatio = 300 / imageObj.width;
      const vRatio = (aspectRatio === 'banner' ? 120 : 300) / imageObj.height;
      const ratio = Math.max(hRatio, vRatio);

      const drawWidth = imageObj.width * ratio;
      const drawHeight = imageObj.height * ratio;

      ctx.drawImage(imageObj, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      // Compress to WebP / JPEG Blob (quality 0.85)
      exportCanvas.toBlob(async (blob) => {
        if (!blob) {
          showError('Gagal Mengolah Gambar', 'Terjadi kesalahan saat kompresi gambar.');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', blob, 'avatar_compressed.webp');

        try {
          const res = await fetch(apiUrl('/api/media/upload'), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
            },
            body: formData
          });

          const data = await res.json();
          const finalUrl = data.url || data.attachment?.url;

          if (res.ok && finalUrl) {
            onImageUploaded(finalUrl);
            showSuccess('Gambar Berhasil Diupload & Dikompres', `Ukuran: ${Math.round(blob.size / 1024)} KB`);
            onClose();
          } else {
            // If backend returned an error (e.g. guest restriction or server error), show message or fallback
            if (data.error && data.error.includes('tamu')) {
              showError('Batasan Akun Tamu', data.error);
            } else {
              // Fallback to optimized Base64 Data URL so local edit always succeeds
              const dataUrl = exportCanvas.toDataURL('image/webp', 0.85);
              onImageUploaded(dataUrl);
              showSuccess('Gambar Berhasil Diterapkan', 'Gambar berhasil diolah dan disimpan.');
              onClose();
            }
          }
        } catch (fetchErr: any) {
          // Fallback to data URL on network issues
          const dataUrl = exportCanvas.toDataURL('image/webp', 0.85);
          onImageUploaded(dataUrl);
          showSuccess('Gambar Berhasil Diterapkan', 'Gambar disimpan secara lokal.');
          onClose();
        } finally {
          setLoading(false);
        }
      }, 'image/webp', 0.85);

    } catch (err: any) {
      showError('Gagal', err.message || 'Terjadi kesalahan saat memproses gambar');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <ImageIcon size={18} />
            </div>
            <h3 className="font-bold text-sm text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {!imageSrc ? (
            /* Upload Drop Area */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-indigo-500/60 rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-[#0c0e14] hover:bg-white/[0.02] group"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 group-hover:scale-110 flex items-center justify-center mb-3 transition-transform shadow-lg shadow-indigo-600/10">
                <Upload size={24} />
              </div>
              <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                Klik untuk memilih file gambar dari komputer
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                Mendukung PNG, JPG, WebP (Otomatis Crop & Kompres)
              </span>
            </div>
          ) : (
            /* Crop & Canvas Editor */
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <div
                  className={`overflow-hidden bg-[#0c0e14] border-2 border-indigo-500/50 shadow-2xl relative cursor-move ${
                    aspectRatio === 'circle'
                      ? 'rounded-full w-[260px] h-[260px]'
                      : aspectRatio === 'banner'
                      ? 'rounded-2xl w-full h-[120px]'
                      : 'rounded-2xl w-[260px] h-[260px]'
                  }`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <canvas ref={canvasRef} className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] text-slate-400 mt-2">
                  💡 Klik & geser gambar untuk mengatur posisi crop
                </span>
              </div>

              {/* Sliders & Tools */}
              <div className="bg-[#0c0e14] p-3 rounded-2xl border border-white/5 space-y-2.5">
                {/* Zoom */}
                <div className="flex items-center space-x-3 text-xs">
                  <ZoomOut size={15} className="text-slate-400" />
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                  <ZoomIn size={15} className="text-slate-400" />
                </div>

                {/* Rotate & Change File */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                  >
                    <RotateCw size={13} />
                    <span>Putar 90°</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-400 hover:underline text-xs font-semibold cursor-pointer"
                  >
                    Ganti Gambar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Batal
            </button>

            {imageSrc && (
              <button
                type="button"
                onClick={handleCropAndUpload}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check size={14} />
                <span>{loading ? 'Mengompres & Mengupload...' : 'Terapkan & Simpan'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

