import React, { useState } from 'react';
import { ExternalLink, Play, Globe } from 'lucide-react';
import { LinkPreviewData } from '../../types';

interface LinkEmbedCardProps {
  preview: LinkPreviewData;
}

export const LinkEmbedCard: React.FC<LinkEmbedCardProps> = ({ preview }) => {
  const [showVideoPlayer, setShowVideoPlayer] = useState<boolean>(false);

  return (
    <div className="mt-2 max-w-lg rounded-2xl overflow-hidden border border-white/10 bg-[#11131a]/80 backdrop-blur-sm shadow-xl flex flex-col transition-all hover:border-white/20 select-none">
      {/* YouTube Embedded Video Player */}
      {preview.youtubeId && (
        <div className="relative w-full aspect-video bg-black">
          {showVideoPlayer ? (
            <iframe
              src={`https://www.youtube.com/embed/${preview.youtubeId}?autoplay=1`}
              title={preview.title || 'YouTube video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="relative w-full h-full group cursor-pointer" onClick={() => setShowVideoPlayer(true)}>
              <img
                src={preview.image || `https://img.youtube.com/vi/${preview.youtubeId}/hqdefault.jpg`}
                alt={preview.title || 'YouTube thumbnail'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-600/90 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <Play size={24} fill="currentColor" className="ml-1" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Non-YouTube OpenGraph Image */}
      {!preview.youtubeId && preview.image && (
        <a href={preview.url} target="_blank" rel="noopener noreferrer" className="relative w-full max-h-56 overflow-hidden block">
          <img
            src={preview.image}
            alt={preview.title || 'Preview image'}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        </a>
      )}

      {/* Embed Text Details */}
      <div className="p-3.5 space-y-1.5 border-l-2 border-indigo-500">
        {/* Site Name & Favicon */}
        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          {preview.favicon ? (
            <img src={preview.favicon} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />
          ) : (
            <Globe size={13} className="text-indigo-400" />
          )}
          <span className="font-semibold uppercase tracking-wider">{preview.siteName || 'Link'}</span>
        </div>

        {/* Title */}
        {preview.title && (
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-xs sm:text-sm text-indigo-300 hover:text-indigo-200 hover:underline line-clamp-2 block leading-snug"
          >
            {preview.title}
          </a>
        )}

        {/* Description */}
        {preview.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}

        {/* URL Link */}
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors pt-0.5"
        >
          <span className="truncate max-w-xs">{preview.url}</span>
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
};
