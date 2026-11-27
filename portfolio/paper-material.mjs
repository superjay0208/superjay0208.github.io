import * as THREE from 'three';
import { material } from './objects.mjs';

// One deformation for the visible sheet and its silhouette in the projector's depth map.
function curlPaper(vertexShader) {
  return vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      attribute vec2 paperCurl;`,
    )
    .replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      objectNormal.xy -= objectNormal.z * vec2(paperCurl.y * position.y,
        2.0 * paperCurl.x * position.y + paperCurl.y * position.x);`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed.z += transformed.y * (transformed.y * paperCurl.x + transformed.x * paperCurl.y);`,
    );
}

export function makePaperMaterials(texture, variants) {
  const surface = material(0xece1cc, 0.77, 0, {
    map: texture,
    side: THREE.DoubleSide,
    emissive: 0x746859,
    emissiveMap: texture,
    emissiveIntensity: 0.14,
  });
  const depth = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });

  depth.onBeforeCompile = (shader) => {
    shader.vertexShader = curlPaper(shader.vertexShader).replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      // The overhead directional light keeps a cached map. The lens supplies the moving shadows.
      if (projectionMatrix[3][3] > .5) gl_Position = vec4(2.,2.,2.,1.);`,
    );
  };

  const spotLighting = THREE.ShaderChunk.lights_fragment_begin.replace(
    'vSpotLightCoord[ i ] ) : 1.0;\n\t\t#endif',
    `vSpotLightCoord[ i ] ) : 1.0;
        #endif

        // Preserve printed detail where the bright lens hits nearby paper.
        float paperExposure = dot(directLight.color, vec3(.2126, .7152, .0722));
        directLight.color *= .86 / (1. + .045 * paperExposure);

        // A small amount of light makes it through the fibres when viewed from the back.
        float paperIncidence = max(0., -dot(geometryNormal, directLight.direction));
        float fibres = mix(.28, 1., dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)));
        float transmitted = .27 * paperIncidence * exp(-.57 / max(.12, paperIncidence));
        reflectedLight.directDiffuse += directLight.color * vec3(1., .83, .62) * fibres * transmitted;
    `,
  );

  surface.onBeforeCompile = (shader) => {
    shader.vertexShader = curlPaper(shader.vertexShader)
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        int page = gl_InstanceID % ${variants};
        vec2 cell = vec2(float(page % 3), float(2 - page / 3));
        vMapUv = (vMapUv + cell) / 3.;
        vEmissiveMapUv = (vEmissiveMapUv + cell) / 3.;`,
      )
      .replace(
        '#include <shadowmap_vertex>',
        `#include <shadowmap_vertex>
        #if defined(USE_SHADOWMAP) && NUM_SPOT_LIGHT_SHADOWS > 0
          // The lens's constant depth bias works on either side of this thin material.
          vSpotLightCoord[0] = spotLightMatrix[0] * worldPosition;
        #endif
      `,
      );
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', spotLighting);
  };
  return { surface, depth };
}
