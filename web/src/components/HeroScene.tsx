'use client';

import { useEffect, useRef } from 'react';

interface Hero {
  name: string;
  skin: string;
  slim: boolean;
  turn: number;
  tag: string;
}

// HD (256x256) skins: same Minecraft body, 4x finer pixels
const HEROES: Hero[] = [
  { name: 'MikuuLovesCoffee', skin: '/skins/mikuulovescoffee.png', slim: false, turn: 0.45, tag: 'text-gold' },
  { name: 'xxbabyxv', skin: '/skins/xxbabyxv.png', slim: true, turn: -0.45, tag: 'text-pink' },
];

/** The two owners standing together, with name tags. */
export function HeroScene() {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    let disposed = false;
    const viewers: { dispose(): void }[] = [];
    // On a PC (mouse that can hover) both characters look at the cursor; touch screens keep drag-to-rotate.
    const followMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    const onMouse = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    if (followMouse) window.addEventListener('mousemove', onMouse);

    (async () => {
      const skinview3d = await import('skinview3d');
      if (disposed) return;
      HEROES.forEach((hero, i) => {
        const canvas = refs.current[i];
        if (!canvas) return;
        const viewer = new skinview3d.SkinViewer({
          canvas,
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          model: hero.slim ? 'slim' : 'default',
          zoom: 0.78,
          fov: 40,
        });
        viewer.globalLight.intensity = 2.4;
        viewer.cameraLight.intensity = 1.2;
        viewer.playerObject.rotation.y = hero.turn;
        viewer.controls.enableZoom = false;
        viewer.controls.enablePan = false;
        viewer.animation = new skinview3d.IdleAnimation();
        viewer.animation.speed = 0.8 + i * 0.15;
        void viewer.loadSkin(hero.skin, { model: hero.slim ? 'slim' : 'default' });
        const onResize = () => viewer.setSize(canvas.clientWidth, canvas.clientHeight);
        window.addEventListener('resize', onResize);

        let frame = 0;
        if (followMouse) {
          viewer.controls.enableRotate = false;
          const { head } = viewer.playerObject.skin;
          const look = () => {
            const r = canvas.getBoundingClientRect();
            // direction from the character's head (upper part of its canvas) to the cursor
            const dx = mouse.x - (r.left + r.width / 2);
            const dy = mouse.y - (r.top + r.height * 0.28);
            const yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(dx, 420)));
            const pitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dy, 420)));
            // body turns a little, the head does the rest; eased so it moves smoothly
            const bodyYaw = hero.turn * 0.4 + yaw * 0.35;
            viewer.playerObject.rotation.y += (bodyYaw - viewer.playerObject.rotation.y) * 0.12;
            head.rotation.y += (yaw - bodyYaw - head.rotation.y) * 0.15;
            head.rotation.x += (pitch - head.rotation.x) * 0.15;
            frame = requestAnimationFrame(look);
          };
          frame = requestAnimationFrame(look);
        }

        viewers.push({
          dispose() {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', onResize);
            viewer.dispose();
          },
        });
      });
    })();

    return () => {
      disposed = true;
      window.removeEventListener('mousemove', onMouse);
      viewers.forEach((v) => v.dispose());
    };
  }, []);

  return (
    <div className="relative mx-auto flex w-full max-w-xl items-end justify-center">
      {HEROES.map((hero, i) => (
        <div key={hero.name} className="relative w-1/2">
          {/* Minecraft-style name tag */}
          <span className={`absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap bg-black/45 px-2 py-0.5 font-pixel text-sm sm:text-base ${hero.tag}`}>
            {hero.name}
          </span>
          <canvas
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="h-[340px] w-full cursor-grab active:cursor-grabbing sm:h-[420px]"
            aria-label={`${hero.name} 3D`}
          />
        </div>
      ))}
      {/* little hearts floating up between them */}
      <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2" aria-hidden>
        {[0, 1.3, 2.6].map((delay, i) => (
          <span key={i} className="heart" style={{ left: (i - 1) * 18, animationDelay: `${delay}s` }} />
        ))}
      </div>
    </div>
  );
}
