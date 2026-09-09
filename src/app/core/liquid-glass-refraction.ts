/** Shape-based optics adapted from the local liquid-glass demo (index.html). */
export interface GlassMaps {
  displacement: Uint8ClampedArray;
  scale: number;
}

export function createGlassMaps(width: number, height: number, cornerRadius: number): GlassMaps {
  const radius = Math.max(1, Math.min(cornerRadius, width / 2, height / 2));
  const bezel = Math.max(1, Math.min(60, radius - 1));
  const profile = refractionProfile(bezel);
  const scale = Math.max(...profile.map(Math.abs), 1);
  const displacement = new Uint8ClampedArray(width * height * 4);

  // Initialise the flat centre with a cheap linear pass. The optical calculation
  // below then only visits the narrow perimeter where refraction can occur instead
  // of evaluating hypot/powers for every interior pixel of a large panel.
  for (let index = 0; index < displacement.length; index += 4) {
    displacement[index] = 128;
    displacement[index + 1] = 128;
    displacement[index + 3] = 255;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= radius && x < width - radius && y >= radius && y < height - radius) {
        continue;
      }
      const index = (y * width + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = px < radius ? px - radius : px > width - radius ? px - width + radius : 0;
      const dy = py < radius ? py - radius : py > height - radius ? py - height + radius : 0;
      const distance = Math.hypot(dx, dy);
      const fromEdge = radius - distance;
      if (distance === 0 || fromEdge < -1) continue;

      const coverage = Math.min(1, fromEdge + 1);
      if (fromEdge >= 0 && fromEdge < bezel) {
        const sample = Math.min(
          Math.floor((fromEdge / bezel) * profile.length),
          profile.length - 1,
        );
        const strength = (profile[sample] / scale) * 127 * coverage;
        displacement[index] = Math.round(128 - (dx / distance) * strength);
        displacement[index + 1] = Math.round(128 - (dy / distance) * strength);
      }
    }
  }

  return { displacement, scale };
}

function refractionProfile(bezel: number): Float64Array {
  const samples = 128;
  const thickness = 80;
  const eta = 1 / 3;
  const surface = (x: number) => (1 - (1 - x) ** 4) ** 0.25;
  const profile = new Float64Array(samples);

  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const height = surface(x);
    const slope = (surface(x + 0.0001) - height) / 0.0001;
    const magnitude = Math.hypot(slope, 1);
    const nx = -slope / magnitude;
    const ny = -1 / magnitude;
    const refraction = eta * ny + Math.sqrt(1 - eta * eta * (1 - ny * ny));
    const rayX = -refraction * nx;
    const rayY = eta - refraction * ny;
    profile[i] = (rayX * (height * bezel + thickness)) / rayY;
  }

  return profile;
}
