import * as THREE from 'three';
import { CharacterVisual } from './characters/CharacterVisual.js';
import { buildMrOdd } from './characters/placeholders.js';

// 캐릭터 선택 화면 / HUD 초상화 — 실제 3D 모델(GLB 또는 Placeholder)을 렌더해서 이미지로 사용
export function renderPortraits(ids, { size = 256 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#cfe0ff', '#3a2414', 1.1));
  const key = new THREE.DirectionalLight('#ffd7a6', 2.4);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9a66ff', 1.6);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const out = {};
  for (const id of ids) {
    let obj;
    let h;
    if (id === 'mrOdd') {
      obj = buildMrOdd().root;
      h = 4.2;
      obj.position.y = -1.9;
    } else {
      const v = new CharacterVisual(id);
      v.update(0.016, 'IDLE', 0, {});
      obj = v.object;
      h = v.cfg.height;
    }
    obj.rotation.y = -0.38;
    scene.add(obj);
    const focusY = id === 'mrOdd' ? 0.9 : h * 0.55;
    const dist = id === 'mrOdd' ? 6.5 : h * 2.45;
    camera.position.set(0.25 * dist * 0.3, focusY + dist * 0.18, dist);
    camera.lookAt(0, focusY, 0);
    renderer.render(scene, camera);
    out[id] = renderer.domElement.toDataURL('image/png');
    scene.remove(obj);
  }
  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
