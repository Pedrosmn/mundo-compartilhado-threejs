import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { assetUrl } from './config.js';

/**
 * Creates a GLTF loader configured with a local Draco decoder. The manager is
 * kept around so the UI can report how many files have finished loading.
 */
export function createModelLoader({ onManagerProgress } = {}) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, loaded, total) => {
    onManagerProgress?.({ url, loaded, total });
  };

  const dracoLoader = new DRACOLoader(manager);
  dracoLoader.setDecoderPath(assetUrl('draco/'));

  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(dracoLoader);

  function load(member, onProgress) {
    return new Promise((resolve, reject) => {
      loader.load(
        assetUrl(member.file),
        resolve,
        (event) => {
          if (!event.lengthComputable || !event.total) return;
          onProgress?.(event.loaded / event.total);
        },
        (error) => {
          reject(
            new Error(
              `Não foi possível carregar "${member.file}": ${error?.message ?? error}`,
            ),
          );
        },
      );
    });
  }

  function dispose() {
    dracoLoader.dispose();
  }

  return { load, dispose, manager };
}
