/**
 * Shared scene configuration.
 *
 * Every character is normalized to the same height so the group looks
 * proportional regardless of the source file scale.
 */
export const TARGET_HEIGHT = 1.75;

export const MEMBERS = [
  {
    id: 'member-1',
    role: 'Membro 1',
    displayName: 'Pedro',
    name: 'Male Adventurer',
    author: 'manoeldarochadeoliveira',
    file: 'models/male-adventurer.glb',
    clips: 21,
    color: '#c7f26e',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    link: 'https://sketchfab.com/3d-models/male-adventurer-3f5f7d12c07445fe9b8c4958935970e2',
    position: [-2.5, 0, 0.9],
    rotationY: 0.18,
  },
  {
    id: 'member-2',
    role: 'Membro 2',
    displayName: 'Anderson Gabriel',
    name: 'Blake — The Adventurer V3',
    author: 'manoeldarochadeoliveira',
    file: 'models/blake-adventurer.glb',
    clips: 18,
    color: '#7dd3fc',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    link: 'https://sketchfab.com/3d-models/blake-the-adventurer-version-3-0196f2f4aa6d41a4af15ddb204eaef34',
    position: [0, 0, -0.15],
    rotationY: 0,
  },
  {
    id: 'member-3',
    role: 'Membro 3',
    displayName: 'Thayná',
    name: 'Solus The Knight',
    author: 'manoeldarochadeoliveira',
    file: 'models/solus-knight.glb',
    clips: 47,
    color: '#f6c177',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    link: 'https://sketchfab.com/3d-models/solus-the-knight-566d1224b48e4765acad9593bd9637b8',
    position: [2.5, 0, 0.9],
    rotationY: -0.18,
  },
];

/**
 * Resolves a path inside the public folder while respecting the configured
 * Vite base, so the build also works from a subfolder.
 */
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`.replace(/\/{2,}/g, '/');
}
