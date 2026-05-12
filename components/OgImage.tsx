'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Star } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  repoName: string;
}

export default function OgImage({ src, alt, repoName }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-darker">
        <Star className="w-10 h-10 text-accent-teal/30 mb-2" />
        <span className="font-mono text-sm text-fg-dim">{repoName}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
      sizes="(max-width: 768px) 100vw, 50vw"
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
