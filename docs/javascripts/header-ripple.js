(() => {
  "use strict";

  const MAX_DEVICE_PIXEL_RATIO = 2;
  const RIPPLE_STRENGTH = 0.015;
  const RIPPLE_RADIUS = 0.14;
  const RIPPLE_DECAY = 1.45;
  const DESKTOP_MEDIA = "(min-width: 76.25em) and (pointer: fine)";
  const scriptUrl = document.currentScript?.src;

  const initializeHeaderRipple = () => {
    const header = document.querySelector(".md-header");
    const tabs = document.querySelector(".md-tabs");

    if (!header || !scriptUrl || !window.matchMedia(DESKTOP_MEDIA).matches) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "header-ripple-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      canvas.remove();
      return;
    }

    const vertexSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;

      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;

      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform vec2 uResolution;
      uniform vec2 uImageResolution;
      uniform vec2 uMouse;
      uniform float uTime;
      uniform float uEnergy;
      uniform float uStrength;
      uniform float uRadius;

      vec2 coverUv(vec2 uv) {
        float canvasAspect = uResolution.x / uResolution.y;
        float imageAspect = uImageResolution.x / uImageResolution.y;

        if (canvasAspect > imageAspect) {
          uv.y = (uv.y - 0.5) * (imageAspect / canvasAspect) + 0.5;
        } else {
          uv.x = (uv.x - 0.5) * (canvasAspect / imageAspect) + 0.5;
        }

        return uv;
      }

      void main() {
        vec2 delta = vUv - uMouse;
        vec2 distanceSpace = vec2(
          delta.x,
          delta.y * (uResolution.y / uResolution.x)
        );
        float distanceFromPointer = length(distanceSpace);
        float envelope = smoothstep(uRadius, 0.0, distanceFromPointer);
        envelope *= envelope;

        float wave = sin(distanceFromPointer * 110.0 - uTime * 7.0);
        vec2 direction = normalize(delta + vec2(0.00001));
        vec2 displacedUv = vUv + direction * wave * envelope * uStrength * uEnergy;
        vec3 stars = texture2D(uTexture, coverUv(displacedUv)).rgb;
        vec3 darkened = mix(stars, vec3(0.02, 0.03, 0.07), 0.76);
        float lowerEdgeFade = smoothstep(0.22, 0.0, vUv.y);
        darkened = mix(darkened, vec3(0.02, 0.03, 0.07), lowerEdgeFade * 0.22);

        gl_FragColor = vec4(darkened, 1.0);
      }
    `;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        throw new Error("Header ripple shader compilation failed");
      }

      return shader;
    };

    const createProgram = () => {
      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      const program = gl.createProgram();

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        throw new Error("Header ripple shader linking failed");
      }

      return program;
    };

    let program;

    try {
      program = createProgram();
    } catch {
      canvas.remove();
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      imageResolution: gl.getUniformLocation(program, "uImageResolution"),
      mouse: gl.getUniformLocation(program, "uMouse"),
      time: gl.getUniformLocation(program, "uTime"),
      energy: gl.getUniformLocation(program, "uEnergy"),
      strength: gl.getUniformLocation(program, "uStrength"),
      radius: gl.getUniformLocation(program, "uRadius"),
    };

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const pointer = { x: 0.5, y: 0.5 };
    let energy = 0;
    let previousPointer = null;
    let previousFrameTime = performance.now();
    let animationFrame = 0;
    let imageWidth = 1;
    let imageHeight = 1;

    const visibleTopBoundary = () => {
      const headerRect = header.getBoundingClientRect();
      const tabsRect = tabs?.getBoundingClientRect();
      const tabsVisible = tabsRect && tabsRect.height > 0 && getComputedStyle(tabs).display !== "none";
      const top = Math.max(0, Math.min(headerRect.top, tabsVisible ? tabsRect.top : headerRect.top));
      const bottom = Math.max(headerRect.bottom, tabsVisible ? tabsRect.bottom : headerRect.bottom);

      return { top, height: Math.max(1, bottom - top) };
    };

    const resizeCanvas = () => {
      const bounds = visibleTopBoundary();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      const width = Math.max(1, window.innerWidth);

      canvas.style.top = `${bounds.top}px`;
      canvas.style.height = `${bounds.height}px`;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(bounds.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (time) => {
      animationFrame = 0;

      const deltaSeconds = Math.min((time - previousFrameTime) / 1000, 0.1);
      previousFrameTime = time;
      energy *= Math.exp(-RIPPLE_DECAY * deltaSeconds);

      if (energy < 0.002) {
        energy = 0;
      }

      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.imageResolution, imageWidth, imageHeight);
      gl.uniform2f(uniforms.mouse, pointer.x, pointer.y);
      gl.uniform1f(uniforms.time, time / 1000);
      gl.uniform1f(uniforms.energy, energy);
      gl.uniform1f(uniforms.strength, RIPPLE_STRENGTH);
      gl.uniform1f(uniforms.radius, RIPPLE_RADIUS);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (energy > 0 && !document.hidden) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    const requestDraw = () => {
      if (!animationFrame && !document.hidden) {
        previousFrameTime = performance.now();
        animationFrame = requestAnimationFrame(draw);
      }
    };

    const handlePointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) {
        previousPointer = null;
        return;
      }

      const now = performance.now();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      let speed = 0;

      if (previousPointer) {
        const elapsedSeconds = Math.max((now - previousPointer.time) / 1000, 0.001);
        speed = Math.hypot(x - previousPointer.x, y - previousPointer.y) / elapsedSeconds;
      }

      pointer.x = x;
      pointer.y = y;
      previousPointer = { x, y, time: now };
      energy = Math.max(energy, Math.min(1, 0.38 + speed * 0.055));
      requestDraw();
    };

    const handleLayoutChange = () => {
      resizeCanvas();
      requestDraw();
    };

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      imageWidth = image.naturalWidth;
      imageHeight = image.naturalHeight;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      resizeCanvas();
      document.body.classList.add("header-ripple-active");
      requestDraw();
    };
    image.onerror = () => canvas.remove();
    image.src = new URL("../assets/header-stars.png", scriptUrl).href;

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        requestDraw();
      }
    });
    window.addEventListener("resize", handleLayoutChange, { passive: true });
    window.addEventListener("scroll", handleLayoutChange, { passive: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeHeaderRipple, { once: true });
  } else {
    initializeHeaderRipple();
  }
})();
