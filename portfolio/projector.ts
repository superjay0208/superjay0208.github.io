// Original Slide Projector chassis from src/scene/room.ts.
import * as THREE from 'three';

type ProjectorParts = {
  carouselTray: THREE.Group;
  fanImpeller: THREE.Group;
  focusRing: THREE.Group;
  powerSwitch: THREE.Mesh;
  glassMat: THREE.MeshStandardMaterial;
  halogenMat: THREE.MeshStandardMaterial;
  indicatorMat: THREE.MeshStandardMaterial;
  fanSpeed: number;
  trayAngle: number;
  trayVelocity: number;
};

function registerOwnedTexture(owner: THREE.Object3D, texture?: THREE.Texture) {
  if (!texture) return undefined;
  const list: THREE.Texture[] = (owner.userData.ownedTextures ??= []);
  if (!list.includes(texture)) list.push(texture);
  return texture;
}

function labelTexture(text: string, sub: string, bg = '#d3d1bc', color = '#222d25') {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = bg;
  c.fillRect(0, 0, 1024, 256);
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.strokeRect(14, 14, 996, 228);
  c.fillStyle = color;
  c.font = 'bold 80px Arial';
  c.fillText(text, 38, 115);
  c.font = '27px monospace';
  c.fillText(sub, 40, 192);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createProjectorModel() {
  const root = new THREE.Group();
  root.name = 'Slide projector 01';
  const housing = new THREE.MeshStandardMaterial({
    color: '#626b51',
    roughness: 0.65,
    metalness: 0.46,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: '#151c17',
    roughness: 0.44,
    metalness: 0.72,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: '#aaa992',
    roughness: 0.32,
    metalness: 0.78,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: '#b89456',
    roughness: 0.3,
    metalness: 0.85,
  });
  const slideMount = new THREE.MeshStandardMaterial({
    color: '#dfd9c3',
    roughness: 0.78,
    metalness: 0.05,
  });
  const halogenMat = new THREE.MeshStandardMaterial({
    color: '#f2b866',
    emissive: '#e88b2e',
    emissiveIntensity: 1.6,
    roughness: 0.35,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#c4d8aa',
    emissive: '#d8e5bd',
    emissiveIntensity: 2,
    roughness: 0.16,
    metalness: 0.1,
  });
  const indicatorMat = new THREE.MeshStandardMaterial({
    color: '#ca3b21',
    emissive: '#ba250b',
    emissiveIntensity: 2,
    roughness: 0.3,
  });

  const box = (
    size: number[],
    pos: number[],
    material: THREE.Material = housing,
    parent: THREE.Object3D = root,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...(size as [number, number, number])),
      material,
    );
    mesh.position.set(...(pos as [number, number, number]));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.layers.enable(1);
    parent.add(mesh);
    return mesh;
  };

  // Main olive-gray die-cast chassis & brushed top deck
  box([0.66, 0.31, 0.48], [0, 0, 0]);
  box([0.67, 0.035, 0.49], [0, 0.145, 0], metal);
  box([0.52, 0.025, 0.39], [0, -0.18, 0], dark);

  // Rubber feet + threaded brass leveling collars
  for (const x of [-0.24, 0.24]) {
    for (const z of [-0.15, 0.15]) {
      box([0.06, 0.04, 0.06], [x, -0.2, z], dark);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.024, 16), brass);
      collar.position.set(x, -0.175, z);
      collar.castShadow = true;
      collar.layers.enable(1);
      root.add(collar);
    }
  }

  // Optical lens assembly (socket stays at (0, 0.045, -0.465); keep all lens meshes >= -0.456)
  const lens = new THREE.Group();
  lens.position.set(0, 0.02, -0.24);
  lens.rotation.x = 0.1;
  root.add(lens);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.22, 32), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.1;
  barrel.layers.enable(1);
  barrel.castShadow = true;
  lens.add(barrel);

  // Brass focal-scale trim ring + anodized collars
  for (const [idx, z] of [-0.04, -0.15, -0.21].entries()) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.101, 0.009, 8, 40),
      idx === 1 ? brass : metal,
    );
    ring.position.z = z;
    lens.add(ring);
  }

  // Helical knurled focus collar (rotates with focusDistance)
  const focusRing = new THREE.Group();
  focusRing.position.z = -0.125;
  lens.add(focusRing);
  const collarSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.052, 28), dark);
  collarSleeve.rotation.x = Math.PI / 2;
  collarSleeve.layers.enable(1);
  focusRing.add(collarSleeve);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.048), i === 0 ? brass : metal);
    rib.position.set(Math.cos(a) * 0.107, Math.sin(a) * 0.107, 0);
    rib.rotation.z = a;
    focusRing.add(rib);
  }

  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.088, 32), glassMat);
  glass.rotation.y = Math.PI;
  glass.position.z = -0.216;
  lens.add(glass);

  // Internal halogen lamp glow + 7-blade cooling fan behind side intake louvers
  const halogenCore = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.11), halogenMat);
  halogenCore.rotation.y = Math.PI / 2;
  halogenCore.position.set(0.312, 0.015, -0.02);
  root.add(halogenCore);

  const fanImpeller = new THREE.Group();
  fanImpeller.position.set(0.323, 0.015, -0.02);
  root.add(fanImpeller);
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 14), brass);
  fanHub.rotation.z = Math.PI / 2;
  fanImpeller.add(fanHub);
  for (let b = 0; b < 7; b++) {
    const angle = (b / 7) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.056, 0.02), metal);
    blade.position.set(0, Math.cos(angle) * 0.036, Math.sin(angle) * 0.036);
    blade.rotation.set(angle, 0.38, 0);
    fanImpeller.add(blade);
  }

  // Side cooling louver slats
  for (let i = 0; i < 13; i++)
    box([0.009, 0.13, 0.28], [0.337, 0.015, -0.04 + i * 0.001], dark).position.z =
      -0.155 + i * 0.026;

  // Rotary 24-slot 35mm Slide Carousel Tray on top deck
  const carouselTray = new THREE.Group();
  carouselTray.position.set(0, 0.192, -0.035);
  root.add(carouselTray);

  const trayDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.184, 0.188, 0.054, 36), dark);
  trayDrum.castShadow = trayDrum.receiveShadow = true;
  trayDrum.layers.enable(1);
  carouselTray.add(trayDrum);

  const trayRim = new THREE.Mesh(new THREE.TorusGeometry(0.184, 0.006, 8, 44), metal);
  trayRim.rotation.x = Math.PI / 2;
  trayRim.position.y = 0.027;
  carouselTray.add(trayRim);

  for (let s = 0; s < 24; s++) {
    const a = (s / 24) * Math.PI * 2;
    const finGroup = new THREE.Group();
    finGroup.rotation.y = a;
    carouselTray.add(finGroup);

    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.056, 0.068), metal);
    divider.position.set(0, 0.003, 0.145);
    divider.layers.enable(1);
    finGroup.add(divider);

    // Populated archival 35mm slides in slots
    if (s % 3 !== 2) {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.048, 0.052), slideMount);
      slide.position.set(0.009, 0.008, 0.142);
      finGroup.add(slide);
    }
  }

  const capTex = registerOwnedTexture(
    root,
    labelTexture('CAROUSEL // 80', '35MM OPTICAL TRAY', '#cdcbb6', '#1f2821'),
  );
  const trayHub = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.074, 0.066, 24), metal);
  trayHub.position.y = 0.006;
  trayHub.layers.enable(1);
  carouselTray.add(trayHub);
  const trayLabel = new THREE.Mesh(
    new THREE.CircleGeometry(0.062, 24),
    new THREE.MeshStandardMaterial({ map: capTex ?? null, roughness: 0.85 }),
  );
  trayLabel.rotation.x = -Math.PI / 2;
  trayLabel.position.y = 0.04;
  carouselTray.add(trayLabel);

  // Arched rear-set steel carry handle (clears carousel tray cleanly, aligns with handle collider)
  box([0.04, 0.17, 0.04], [-0.23, 0.235, 0.155], dark);
  box([0.04, 0.17, 0.04], [0.23, 0.235, 0.155], dark);
  box([0.5, 0.036, 0.04], [0, 0.315, 0.155], dark);

  // Rear instrument plate, serial badge, power rocker switch, status LED, IEC inlet
  const badgeTex = registerOwnedTexture(root, labelTexture('LUMEN / 01', 'OPTICAL INSTRUMENTS'));
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.25, 0.064),
    new THREE.MeshStandardMaterial({
      map: badgeTex ?? null,
      roughness: 0.9,
    }),
  );
  badge.position.set(-0.04, 0.045, 0.242);
  root.add(badge);

  box([0.046, 0.058, 0.012], [0.185, 0.088, 0.243], metal);
  const powerSwitch = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.038, 0.018), dark);
  powerSwitch.position.set(0.185, 0.088, 0.249);
  powerSwitch.rotation.x = -0.22;
  root.add(powerSwitch);

  const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), indicatorMat);
  indicator.position.set(0.25, 0.09, 0.245);
  root.add(indicator);

  box([0.075, 0.048, 0.012], [-0.22, -0.075, 0.243], dark);

  const parts: ProjectorParts = {
    carouselTray,
    fanImpeller,
    focusRing,
    powerSwitch,
    glassMat,
    halogenMat,
    indicatorMat,
    fanSpeed: 28,
    trayAngle: 0,
    trayVelocity: 0,
  };
  root.userData.projectorParts = parts;
  return root;
}
