import * as THREE from "three";
const manifestPromise = fetch("/assets/surface/manifest.json").then((r) => {
  if (!r.ok) throw Error("Imagery catalog unavailable");
  return r.json();
});
// Georeferenced images draped on the planetary sphere; no invented elevations.
// TODO(API): Add validated elevation tiles and level-of-detail imagery here.
// Preserve geographic bounds, source attribution, units and no-data masks.
export function enhanceSurface({
  scene,
  group,
  renderer,
  camera,
  container,
  body = "Earth",
}) {
  let disposed = false,
    generation = 0,
    patches = [],
    cloud,
    atmosphere,
    currentCredit = "",
    loaded = false,
    failed = false;
  const textures = [],
    extras = [];
  const loader = new THREE.TextureLoader();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  camera.near = 0.00005;
  camera.updateProjectionMatrix();
  scene.traverse((o) => {
    if (o.isAmbientLight) o.intensity = 0.65;
    if (o.isDirectionalLight) {
      o.intensity = 2.7;
      o.position.set(-2, 2, 5);
    }
  });
  const base = group.children.find((o) => o.isMesh);
  if (base?.material) {
    base.material.shininess = body === "Earth" ? 12 : 1;
    base.material.specular?.set(body === "Earth" ? 0x294b61 : 0x080808);
  }
  const hud = document.createElement("div");
  hud.className = "surface-hud";
  hud.innerHTML =
    "<b>ORBITAL VIEW</b><span>Choose a location to descend</span>";
  container.appendChild(hud);
  const load = (url, fn) =>
    loader.load(
      url,
      (t) => {
        if (disposed) {
          t.dispose();
          return;
        }
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        textures.push(t);
        fn(t);
      },
      undefined,
      () => {},
    );
  if (body === "Earth") {
    load("/assets/earth-normal.jpg", (t) => {
      base.material.normalMap = t;
      base.material.normalScale = new THREE.Vector2(0.45, 0.45);
      base.material.needsUpdate = true;
    });
    const cloudMaterial = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      shininess: 0,
    });
    cloud = new THREE.Mesh(
      new THREE.SphereGeometry(1.006, 96, 64),
      cloudMaterial,
    );
    group.add(cloud);
    extras.push(cloud);
    load("/assets/earth-clouds.png", (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      cloudMaterial.map = t;
      cloudMaterial.needsUpdate = true;
    });
  }
  if (body !== "Moon") {
    atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(body === "Earth" ? 1.025 : 1.012, 80, 56),
      new THREE.ShaderMaterial({
        uniforms: {
          tint: {
            value: new THREE.Color(body === "Earth" ? 0x4ca8e8 : 0xc98b62),
          },
        },
        vertexShader:
          "varying vec3 n; varying vec3 p; void main(){n=normalize(normalMatrix*normal); vec4 v=modelViewMatrix*vec4(position,1.);p=v.xyz;gl_Position=projectionMatrix*v;}",
        fragmentShader:
          "uniform vec3 tint; varying vec3 n; varying vec3 p; void main(){float edge=pow(1.-max(dot(normalize(n),normalize(-p)),0.),3.);gl_FragColor=vec4(tint,edge*.42);}",
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(atmosphere);
    extras.push(atmosphere);
  }
  const clear = () => {
    patches.forEach((p) => {
      group.remove(p);
      p.geometry.dispose();
      p.material.map?.dispose();
      p.material.dispose();
    });
    patches = [];
  };
  return {
    async select(location) {
      const token = ++generation;
      clear();
      loaded = false;
      failed = false;
      try {
        const manifest = await manifestPromise;
        if (disposed || token !== generation) return;
        const info =
          manifest[body === "Earth" ? location.id : body.toLowerCase()];
        if (!info) throw Error("No imagery");
        currentCredit = info.credit;
        let ready = 0;
        for (const patch of info.patches) {
          const [west, south, east, north] = patch.bbox;
          const geometry = new THREE.SphereGeometry(
            1.00002,
            64,
            64,
            THREE.MathUtils.degToRad(west + 180),
            THREE.MathUtils.degToRad(east - west),
            THREE.MathUtils.degToRad(90 - north),
            THREE.MathUtils.degToRad(north - south),
          );
          const material = new THREE.MeshBasicMaterial({
            // Kaguya's dark reflectance mosaic needs display exposure compensation.
            // This changes only presentation brightness, never geographic features.
            color: new THREE.Color(1, 1, 1).multiplyScalar(body === "Moon" ? 10 : 1),
            transparent: true,
            opacity: 0,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            toneMapped: false,
          });
          const mesh = new THREE.Mesh(geometry, material);
          group.add(mesh);
          patches.push(mesh);
          loader.load(
            "/assets/surface/" + patch.file,
            (t) => {
              if (disposed || token !== generation) {
                t.dispose();
                return;
              }
              t.colorSpace = THREE.SRGBColorSpace;
              t.anisotropy = Math.min(
                8,
                renderer.capabilities.getMaxAnisotropy(),
              );
              material.map = t;
              material.needsUpdate = true;
              ready++;
              loaded = ready === info.patches.length;
            },
            undefined,
            () => (failed = true),
          );
        }
      } catch {
        failed = true;
      }
    },
    update(distance) {
      const near = distance < 1.25;
      patches.forEach(
        (p) =>
          (p.material.opacity = p.material.map
            ? THREE.MathUtils.clamp((1.5 - distance) / 0.25, 0, 1)
            : 0),
      );
      if (cloud) {
        cloud.visible = !near;
        cloud.rotation.y += 0.000015;
      }
      if (atmosphere) atmosphere.visible = !near;
      hud.querySelector("b").textContent = near
        ? "SURFACE CLOSE-UP"
        : "ORBITAL VIEW";
      hud.querySelector("span").textContent = near
        ? failed
          ? "Some imagery unavailable · global basemap fallback"
          : loaded
            ? currentCredit +
              " · Imagery draped on a sphere; no elevation model"
            : "Loading detailed imagery…"
        : "Select a site to fly closer · Drag to explore";
      container.dataset.view = near ? "surface" : "orbit";
    },
    dispose() {
      disposed = true;
      generation++;
      clear();
      extras.forEach((o) => {
        group.remove(o);
        o.geometry.dispose();
        o.material.dispose();
      });
      textures.forEach((t) => t.dispose());
      hud.remove();
    },
  };
}
