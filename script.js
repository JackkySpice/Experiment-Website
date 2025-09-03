"use strict";

(() => {
  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d");

  const smallMassInput = document.getElementById("smallMass");
  const largeMassInput = document.getElementById("largeMass");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const collisionCountEl = document.getElementById("collisionCount");
  const statusTextEl = document.getElementById("statusText");

  // Physical-to-pixel mapping
  const PIXELS_PER_UNIT = 200; // 1 unit in sim space = 200 pixels
  const WALL_OFFSET_PX = 40;   // wall inset from left edge

  // Block drawing parameters (in simulation units)
  const LARGE_WIDTH_U = 1.0;
  const SMALL_WIDTH_U = 0.5;

  // Initial state parameters (in simulation units)
  const INITIAL_X_LARGE_U = 1.0;   // left edge
  const INITIAL_X_SMALL_U = 3.5;   // left edge, to the right of large block
  const INITIAL_V_LARGE = 0.0;
  const INITIAL_V_SMALL = -1.0;    // small block moving left toward large block

  const EPS = 1e-12;

  /**
   * Simulation state; all distances in simulation units; velocities in units/sec.
   */
  const state = {
    massSmall: 1,
    massLarge: 100,
    xSmall: INITIAL_X_SMALL_U,
    xLarge: INITIAL_X_LARGE_U,
    vSmall: INITIAL_V_SMALL,
    vLarge: INITIAL_V_LARGE,
    collisionCount: 0,
    running: false,
    finished: false,
    lastFrameMs: 0,
    simTime: 0,
    speedMultiplier: 1.0, // could be wired to a UI control in the future
  };

  function resetSimulationFromInputs() {
    const mSmall = Math.max(1e-6, Number(smallMassInput.value) || 1);
    const mLarge = Math.max(1e-6, Number(largeMassInput.value) || 100);
    state.massSmall = mSmall;
    state.massLarge = mLarge;
    state.xSmall = INITIAL_X_SMALL_U;
    state.xLarge = INITIAL_X_LARGE_U;
    state.vSmall = INITIAL_V_SMALL;
    state.vLarge = INITIAL_V_LARGE;
    state.collisionCount = 0;
    state.simTime = 0;
    state.finished = false;
    state.lastFrameMs = performance.now();
    collisionCountEl.textContent = String(state.collisionCount);
    statusTextEl.textContent = "Ready";
    draw();
  }

  function startSimulation() {
    if (state.finished) return;
    state.running = true;
    statusTextEl.textContent = "Running";
  }

  function pauseSimulation() {
    state.running = false;
    if (!state.finished) statusTextEl.textContent = "Paused";
  }

  function finishSimulation() {
    state.running = false;
    state.finished = true;
    statusTextEl.textContent = "Done";
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    // Optionally scale canvas for DPR (kept simple; fixed size canvas for now)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Track and wall
    const wallX = WALL_OFFSET_PX;
    const floorY = canvas.height - 60;
    ctx.lineWidth = 2;

    // Track line
    ctx.strokeStyle = "#2a356e";
    ctx.beginPath();
    ctx.moveTo(0, floorY + 40);
    ctx.lineTo(canvas.width, floorY + 40);
    ctx.stroke();

    // Wall rectangle
    ctx.fillStyle = "#3d4aa3";
    ctx.fillRect(wallX - 8, floorY - 100, 8, 140);

    // Compute pixel positions for blocks (left edges)
    const pxLargeX = wallX + state.xLarge * PIXELS_PER_UNIT;
    const pxSmallX = wallX + state.xSmall * PIXELS_PER_UNIT;
    const pxLargeW = LARGE_WIDTH_U * PIXELS_PER_UNIT;
    const pxSmallW = SMALL_WIDTH_U * PIXELS_PER_UNIT;
    const blockY = floorY - 60;

    // Large block
    ctx.fillStyle = "#6ea8fe";
    ctx.fillRect(pxLargeX, blockY, pxLargeW, 60);
    // Small block
    ctx.fillStyle = "#3ddc97";
    ctx.fillRect(pxSmallX, blockY + 10, pxSmallW, 40);

    // Labels
    ctx.fillStyle = "#e6ecff";
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`M_large = ${formatMass(state.massLarge)} kg`, pxLargeX + pxLargeW / 2, blockY - 10);
    ctx.fillText(`M_small = ${formatMass(state.massSmall)} kg`, pxSmallX + pxSmallW / 2, blockY + 66);
  }

  function formatMass(m) {
    if (m >= 10000) return m.toExponential(0);
    if (m >= 1000) return m.toLocaleString();
    return String(m);
  }

  function simulateFrame(nowMs) {
    const dtMs = Math.min(64, nowMs - state.lastFrameMs);
    state.lastFrameMs = nowMs;

    if (state.running && !state.finished) {
      // Convert wall-clock delta to simulation time
      let remaining = (dtMs / 1000) * state.speedMultiplier;

      // Process events within this frame deterministically
      let guard = 0;
      while (remaining > 0 && guard < 10000) {
        guard++;
        const tWall = timeToWallCollision();
        const tBlock = timeToBlockCollision();
        const tNext = Math.min(tWall, tBlock);

        if (!isFinite(tNext)) {
          // No more collisions possible; finish
          // Advance positions by remaining for visualization then stop
          advanceKinematics(remaining);
          state.simTime += remaining;
          remaining = 0;
          finishSimulation();
          break;
        }

        if (tNext > remaining + EPS) {
          // No event in this frame; just advance and exit
          advanceKinematics(remaining);
          state.simTime += remaining;
          remaining = 0;
          break;
        }

        // Step to the exact event time
        const step = Math.max(0, tNext);
        advanceKinematics(step);
        state.simTime += step;
        remaining -= step;

        // Resolve the event happening at tNext
        if (almostEqual(tNext, tWall)) {
          // Large block hits the wall
          state.xLarge = 0; // left edge at wall
          state.vLarge = -state.vLarge;
          state.collisionCount += 1;
          collisionCountEl.textContent = String(state.collisionCount);
        } else if (almostEqual(tNext, tBlock)) {
          // Block-block elastic collision (1D)
          resolveBlockBlockCollision();
          state.collisionCount += 1;
          collisionCountEl.textContent = String(state.collisionCount);
        }

        // After collision, check terminal condition
        if (noMoreCollisionsPossible()) {
          finishSimulation();
          break;
        }

        // Protect against zero-time loops by nudging forward a hair
        if (remaining <= EPS) {
          remaining = 0;
        }
      }
    }

    draw();
    requestAnimationFrame(simulateFrame);
  }

  function advanceKinematics(dt) {
    if (dt <= 0) return;
    state.xSmall += state.vSmall * dt;
    state.xLarge += state.vLarge * dt;
  }

  function timeToWallCollision() {
    // Large block wall at x = 0 (left edge)
    if (state.vLarge < -EPS) {
      return state.xLarge / (-state.vLarge);
    }
    return Infinity;
  }

  function timeToBlockCollision() {
    // Time until x_small = x_large + width_large
    const relativeVelocity = state.vLarge - state.vSmall;
    if (relativeVelocity <= EPS) return Infinity;
    const gap = state.xSmall - state.xLarge - LARGE_WIDTH_U;
    if (gap <= EPS) return 0; // already touching or slight overlap
    const t = gap / relativeVelocity;
    return t > EPS ? t : 0;
  }

  function resolveBlockBlockCollision() {
    // Post-collision velocities for 1D elastic collision
    const m1 = state.massSmall;
    const m2 = state.massLarge;
    const u1 = state.vSmall;
    const u2 = state.vLarge;
    const v1 = ((m1 - m2) / (m1 + m2)) * u1 + (2 * m2 / (m1 + m2)) * u2;
    const v2 = (2 * m1 / (m1 + m2)) * u1 + ((m2 - m1) / (m1 + m2)) * u2;
    // Set contact configuration exactly to avoid overlap drift
    state.xSmall = state.xLarge + LARGE_WIDTH_U;
    state.vSmall = v1;
    state.vLarge = v2;
  }

  function noMoreCollisionsPossible() {
    // No more wall collision if vLarge >= 0
    // No more block-block collision if vLarge <= vSmall and small is to the right
    const wallOk = state.vLarge >= -EPS;
    const blockOk = (state.vLarge - state.vSmall) <= EPS && (state.xSmall - state.xLarge - LARGE_WIDTH_U) >= -EPS;
    return wallOk && blockOk;
  }

  function almostEqual(a, b, tol = 1e-9) {
    return Math.abs(a - b) <= tol;
  }

  // Wire up controls
  startBtn.addEventListener("click", () => {
    if (!state.running) startSimulation();
  });
  pauseBtn.addEventListener("click", () => {
    pauseSimulation();
  });
  resetBtn.addEventListener("click", () => {
    pauseSimulation();
    resetSimulationFromInputs();
  });

  // Initialize and start RAF loop
  resetSimulationFromInputs();
  state.lastFrameMs = performance.now();
  requestAnimationFrame(simulateFrame);
})();

