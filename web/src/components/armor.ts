import * as THREE from 'three';
import type { PlayerObject } from 'skinview3d';

export interface ArmorPalette {
  base: string;
  light: string;
  dark: string;
  edge: string;
}

export const DIAMOND: ArmorPalette = { base: '#5ff5e0', light: '#c8fff4', dark: '#3fd6c0', edge: '#239a8a' };
export const NETHERITE: ArmorPalette = { base: '#8f838c', light: '#b9adb6', dark: '#72676f', edge: '#4c434a' };

/** Pixel-noise armor face texture; `hole` cuts a transparent window (the helmet's face opening). */
function faceTexture(w: number, h: number, p: ArmorPalette, seed: number, hole?: [number, number, number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const r = rand();
      ctx.fillStyle = edge ? p.edge : r > 0.88 ? p.light : r < 0.1 ? p.dark : p.base;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (hole) ctx.clearRect(...hole);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function piece(w: number, h: number, d: number, p: ArmorPalette, seed: number, frontHole?: [number, number, number, number]) {
  // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back)
  const sizes: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const materials = sizes.map(
    ([fw, fh], i) =>
      // Lambert like the skin itself: flat, bright Minecraft look (metal shading turns dark without an env map)
      new THREE.MeshLambertMaterial({
        map: faceTexture(Math.round(fw), Math.round(fh), p, seed + i * 17, i === 4 ? frontHole : undefined),
        transparent: i === 4 && !!frontHole,
        alphaTest: 0.5,
      }),
  );
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
}

/** Dresses a skinview3d player in a full armor set (helmet, chestplate, sleeves, leggings, boots). */
export function addArmor(player: PlayerObject, palette: ArmorPalette, slim = false) {
  const { head, body, rightArm, leftArm, rightLeg, leftLeg } = player.skin;
  // Arms and legs keep their skin box inside an extra pivot group, so armor goes next to the box, not on the part.
  const attach = (part: typeof head, mesh: THREE.Mesh, dy = 0) => {
    mesh.position.copy(part.innerLayer.position);
    mesh.position.y += dy;
    (part.innerLayer.parent ?? part).add(mesh);
  };
  // Helmet with a face opening (eyes and mouth visible)
  attach(head, piece(10, 10, 10, palette, 3, [2, 3, 6, 6]), 0.5);
  attach(body, piece(9.4, 12.6, 5.2, palette, 7));
  const armW = slim ? 3.6 : 4.6;
  attach(rightArm, piece(armW, 7, 4.6, palette, 11), 2.6);
  attach(leftArm, piece(armW, 7, 4.6, palette, 13), 2.6);
  // Leggings (upper legs) and boots (lower legs)
  attach(rightLeg, piece(4.5, 8.4, 4.5, palette, 19), 1.8);
  attach(leftLeg, piece(4.5, 8.4, 4.5, palette, 23), 1.8);
  attach(rightLeg, piece(4.8, 4.4, 4.8, palette, 29), -3.9);
  attach(leftLeg, piece(4.8, 4.4, 4.8, palette, 31), -3.9);
}
