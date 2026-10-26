'use client';

import dynamic from 'next/dynamic';

// WebGL only exists in the browser, so the 3D scene is never server-rendered.
export const HeroSceneLazy = dynamic(() => import('./HeroScene').then((m) => m.HeroScene), {
  ssr: false,
  loading: () => <div className="h-[340px] sm:h-[420px]" />,
});

export const SkinViewerLazy = dynamic(() => import('./SkinViewer').then((m) => m.SkinViewer), {
  ssr: false,
  loading: () => <div className="h-[360px]" />,
});
