import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface ImageLightboxModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top action bar */}
      <div className="absolute top-4 right-4 flex items-center space-x-3 z-50" onClick={(e) => e.stopPropagation()}>
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full bg-gray-800/80 hover:bg-gray-700 text-gray-200 transition-colors"
          title="Open original in new tab"
        >
          <ExternalLink size={20} />
        </a>
        <a
          href={imageUrl}
          download="aerocord-image"
          className="p-2 rounded-full bg-gray-800/80 hover:bg-gray-700 text-gray-200 transition-colors"
          title="Download image"
        >
          <Download size={20} />
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-gray-800/80 hover:bg-[#f23f43] text-gray-200 transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X size={20} />
        </button>
      </div>

      {/* Image container */}
      <div
        className="max-w-5xl max-h-[90vh] flex items-center justify-center overflow-hidden rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Enlarged preview"
          className="max-w-full max-h-[85vh] object-contain rounded-lg transition-transform duration-200"
        />
      </div>
    </div>
  );
};
