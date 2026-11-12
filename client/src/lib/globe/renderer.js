import * as THREE from "three";
import { enhanceSurface } from "./surface.js";
const point = (lat, lon, r = 1.0001) => {
  const phi = THREE.MathUtils.degToRad(90 - lat),
    theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
};

export function createGlobe(
  container,
  textureName,
  initialLocation,
  color,
  onMove,
) {
  container.replaceChildren();
  let disposed = false,
    location = initialLocation,
    yaw = 0.2,
    pitch = 0.1,
    distance = 3.8,
    flight = null,
    frame = 0,
    drag = null;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const label = document.createElement("div");
  label.className = "world-marker";
  label.innerHTML = "<i></i><span></span>";
  label.style.setProperty("--marker-color", "#" + color.toString(16));
  container.appendChild(label);
  const status = document.createElement("span");
  status.className = "world-load";
  status.textContent = "Loading surface imagery…";
  container.appendChild(status);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20),
    group = new THREE.Group();
  scene.add(group);
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 0,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 80, 56), material);
  group.add(sphere);
  const textures = [];
  new THREE.TextureLoader().load(
    "/assets/" + textureName,
    (t) => {
      if (disposed) {
        t.dispose();
        return;
      }
      t.colorSpace = THREE.SRGBColorSpace;
      material.map = t;
      material.needsUpdate = true;
      textures.push(t);
      status.remove();
    },
    undefined,
    () => {
      if (!disposed)
        status.textContent =
          "Surface imagery unavailable · location marker only";
    },
  );
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sun = new THREE.DirectionalLight(0xfff5e7, 1.7);
  sun.position.set(-3, 3, 5);
  scene.add(sun);
  const gridMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.12,
  });
  for (let lat = -60; lat <= 60; lat += 30) {
    const ps = [];
    for (let lon = -180; lon <= 180; lon += 3) ps.push(point(lat, lon, 1.003));
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ps),
        gridMaterial,
      ),
    );
  }
  for (let lon = -180; lon < 180; lon += 45) {
    const ps = [];
    for (let lat = -90; lat <= 90; lat += 3) ps.push(point(lat, lon, 1.003));
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ps),
        gridMaterial,
      ),
    );
  }
  const surface = enhanceSurface({
    scene,
    group,
    renderer,
    camera,
    container,
    body:
      textureName === "earth.jpg"
        ? "Earth"
        : textureName === "moon.jpg"
          ? "Moon"
          : "Mars",
  });
  surface.select(location);
  const resize = () => {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const api = {
    move(dx, dy, dz) {
      flight = null;
      const sensitivity = Math.min(1, (distance - 1) * 1.2);
      yaw += dx * sensitivity;
      pitch = Math.max(-1.55, Math.min(1.55, pitch + dy * sensitivity));
      distance = Math.max(
        1.0015,
        Math.min(5.5, 1 + (distance - 1) * Math.exp(dz)),
      );
    },
    setLocation(p) {
      location = p;
      surface.select(p);
    },
    fly(close = true) {
      const p = point(location.lat, location.lon);
      let toYaw = -Math.atan2(p.x, p.z);
      while (toYaw - yaw > Math.PI) toYaw -= 2 * Math.PI;
      while (toYaw - yaw < -Math.PI) toYaw += 2 * Math.PI;
      flight = {
        start: performance.now(),
        yaw,
        pitch,
        distance,
        toDistance: close ? 1.008 : 3.8,
        toYaw,
        toPitch: THREE.MathUtils.degToRad(location.lat),
      };
    },
    dispose() {
      disposed = true;
      surface.dispose();
      cancelAnimationFrame(frame);
      observer.disconnect();
      container.onpointerdown =
        container.onpointermove =
        container.onpointerup =
        container.onpointercancel =
        container.onwheel =
        container.onkeydown =
          null;
      group.traverse((o) => o.geometry?.dispose());
      gridMaterial.dispose();
      material.dispose();
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      container.replaceChildren();
    },
  };
  container.onpointerdown = (e) => {
    if (e.target.tagName === "BUTTON") return;
    drag = { x: e.clientX, y: e.clientY };
    container.setPointerCapture(e.pointerId);
  };
  container.onpointermove = (e) => {
    if (!drag) return;
    onMove((e.clientX - drag.x) * 0.006, (e.clientY - drag.y) * 0.006, 0, api);
    drag = { x: e.clientX, y: e.clientY };
  };
  container.onpointerup = container.onpointercancel = () => (drag = null);
  container.onwheel = (e) => {
    e.preventDefault();
    onMove(0, 0, e.deltaY * 0.002, api);
  };
  container.onkeydown = (e) => {
    const actions = {
      ArrowLeft: [-0.12, 0, 0],
      ArrowRight: [0.12, 0, 0],
      ArrowUp: [0, -0.12, 0],
      ArrowDown: [0, 0.12, 0],
      "+": [0, 0, -0.2],
      "=": [0, 0, -0.2],
      "-": [0, 0, 0.2],
    };
    if (actions[e.key]) {
      e.preventDefault();
      onMove(...actions[e.key], api);
    }
  };
  function draw(now) {
    if (disposed) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden) return;
    if (flight) {
      let t = Math.min(
        1,
        (now - flight.start) /
          (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 2200),
      );
      t = t * t * (3 - 2 * t);
      yaw = flight.yaw + (flight.toYaw - flight.yaw) * t;
      pitch = flight.pitch + (flight.toPitch - flight.pitch) * t;
      distance =
        1 +
        Math.exp(
          Math.log(flight.distance - 1) +
            (Math.log(flight.toDistance - 1) - Math.log(flight.distance - 1)) *
              t,
        );
      if (t === 1) flight = null;
    }
    surface.update(distance);
    group.children.forEach((o) => {
      if (o.isLine) o.visible = distance > 1.25;
    });
    group.rotation.set(pitch, yaw, 0, "XYZ");
    camera.position.z = distance;
    camera.updateMatrixWorld();
    group.updateMatrixWorld();
    const v = point(location.lat, location.lon).applyMatrix4(group.matrixWorld);
    label.hidden = v.dot(camera.position.clone().sub(v)) <= 0;
    const pos = v.clone().project(camera);
    label.style.left = `${(pos.x / 2 + 0.5) * container.clientWidth}px`;
    label.style.top = `${(-pos.y / 2 + 0.5) * container.clientHeight}px`;
    label.querySelector("span").textContent = location.name;
    renderer.render(scene, camera);
  }
  api.fly(false);
  frame = requestAnimationFrame(draw);
  return api;
}
