/* =========================================================
   CineView – Interactive Booking, 3D POV & Navigation Logic
   File: app.js (Requires engine.js to be loaded first)
   ========================================================= */

const MAX_SEATS = 6;

const TRAILERS = {
  tears: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  sintel: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
};

// Central Application State
const state = {
  hallType: "multiplex",
  formatKey: "scope2d",
  profileKey: "balanced",
  heatmapOn: true,
  isReclined: false,
  motion4dx: false,
  rowsGrid: [],
  focusedRow: 5, // Default: Row F (Center Sweet Spot)
  focusedCol: 6, // Default: Seat 7
  selectedSeats: [], // Blue seats currently being booked (max 6)
  myBookedSeats: new Set(), // Green seats confirmed by the user
  bookedSeats: new Set(["A4", "A5", "B8", "B9", "D6", "D7", "E3", "F10", "F11", "G4", "H7", "H8", "I5", "J4"]),
  reservedSeats: new Set(["C7", "C8", "E9", "G10", "I8"]),
  timerSeconds: 300,
  timerInterval: null
};

// Initialize App on Page Load
document.addEventListener("DOMContentLoaded", () => {
  populateDropdowns();
  rebuildHall("multiplex");
  bindControls();
  startFallbackCanvasAnimation();
  updateAllViews();
});

// 1. Populate Format & Profile Selectors from engine.js
function populateDropdowns() {
  const formatSelect = document.getElementById("format-select");
  Object.values(SCREEN_FORMATS).forEach((fmt) => {
    const opt = document.createElement("option");
    opt.value = fmt.id;
    opt.textContent = fmt.name;
    if (fmt.id === state.formatKey) opt.selected = true;
    formatSelect.appendChild(opt);
  });

  const profileSelect = document.getElementById("profile-select");
  Object.values(PREFERENCE_PROFILES).forEach((prof) => {
    const opt = document.createElement("option");
    opt.value = prof.id;
    opt.textContent = prof.label;
    if (prof.id === state.profileKey) opt.selected = true;
    profileSelect.appendChild(opt);
  });
}

// 2. Build Auditorium Rows & Reset Default Focus to Center Sweet Spot
function rebuildHall(hallType) {
  state.hallType = hallType;
  state.rowsGrid = buildAuditoriumGrid(hallType);
  state.selectedSeats = [];
  stopHoldTimer();

  const midRow = Math.floor(state.rowsGrid.length * 0.55);
  const midCol = Math.floor(state.rowsGrid[midRow].seats.length / 2) - 1;
  state.focusedRow = midRow;
  state.focusedCol = Math.max(0, midCol);
}

// 3. Bind All UI Events, Quick Presets & 4-Way Arrow Controls
function bindControls() {
  // Format Switcher
  document.getElementById("format-select").addEventListener("change", (e) => {
    state.formatKey = e.target.value;
    updateAllViews();
  });

  // Hall Layout Switcher (Multiplex / Boutique LUXE / Single-Screen)
  document.getElementById("hall-select").addEventListener("change", (e) => {
    rebuildHall(e.target.value);
    updateAllViews();
  });

  // Preference Profile Switcher
  document.getElementById("profile-select").addEventListener("change", (e) => {
    state.profileKey = e.target.value;
    updateAllViews();
  });

  // Comfort Heatmap Toggle
  document.getElementById("heatmap-toggle").addEventListener("change", (e) => {
    state.heatmapOn = e.target.checked;
    renderSeatGrid();
  });

  // Recliner Tilt Toggle
  document.getElementById("recline-toggle").addEventListener("change", (e) => {
    state.isReclined = e.target.checked;
    updateAllViews();
  });

  // 4DX Seat Motion Simulation Toggle
  document.getElementById("motion-4dx-toggle").addEventListener("change", (e) => {
    state.motion4dx = e.target.checked;
    updateTheatrePOV(getFocusedSeat());
  });

  // Trailer Switcher & Mute/Unmute Button
  document.getElementById("video-select").addEventListener("change", (e) => {
    const video = document.getElementById("trailer-video");
    video.src = TRAILERS[e.target.value] || TRAILERS.tears;
    video.play().catch(() => {});
  });

  document.getElementById("mute-btn").addEventListener("click", () => {
    const video = document.getElementById("trailer-video");
    const btn = document.getElementById("mute-btn");
    video.muted = !video.muted;
    btn.textContent = video.muted ? "🔇 Unmute Trailer" : "🔊 Mute Trailer";
  });

  // Quick POV Comparison Presets
  document.getElementById("preset-front").addEventListener("click", () => jumpToSeat(0, 6));
  document.getElementById("preset-sweet").addEventListener("click", () => {
    const r = Math.floor(state.rowsGrid.length * 0.55);
    const c = Math.floor(state.rowsGrid[r].seats.length / 2) - 1;
    jumpToSeat(r, c);
  });
  document.getElementById("preset-corner").addEventListener("click", () => {
    const r = Math.min(3, state.rowsGrid.length - 1);
    jumpToSeat(r, 0);
  });
  document.getElementById("preset-recliner").addEventListener("click", () => {
    const lastR = state.rowsGrid.length - 1;
    const midC = Math.floor(state.rowsGrid[lastR].seats.length / 2) - 1;
    jumpToSeat(lastR, midC);
  });

  // On-Screen 4-Way Arrow D-Pad (Left, Right, Up, Down + Select)
  document.getElementById("btn-up").addEventListener("click", () => moveFocus(-1, 0));
  document.getElementById("btn-down").addEventListener("click", () => moveFocus(1, 0));
  document.getElementById("btn-left").addEventListener("click", () => moveFocus(0, -1));
  document.getElementById("btn-right").addEventListener("click", () => moveFocus(0, 1));
  document.getElementById("btn-select-seat").addEventListener("click", () => {
    toggleSeatSelection(getFocusedSeat());
  });

  // Keyboard Arrow Navigation (Without leaving the booking screen)
  document.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(-1, 0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(1, 0);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveFocus(0, -1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveFocus(0, 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleSeatSelection(getFocusedSeat());
    }
  });

  // Best-Group Sliding-Window Seat Finder
  document.getElementById("btn-find-group").addEventListener("click", () => {
    const size = parseInt(document.getElementById("group-size-select").value, 10);
    const bestGroup = findBestGroupSeats(
      state.rowsGrid,
      state.bookedSeats,
      state.reservedSeats,
      size,
      state.formatKey,
      state.profileKey,
      state.isReclined
    );

    if (!bestGroup) {
      showToast(`No ${size} contiguous seats available in a single block.`, "error");
      return;
    }

    state.selectedSeats = [...bestGroup];
    const centerSeat = bestGroup[Math.floor(bestGroup.length / 2)];
    state.focusedRow = centerSeat.rowIndex;
    state.focusedCol = centerSeat.colIndex;

    startHoldTimer();
    showToast(`Selected best ${size} contiguous seats in Row ${centerSeat.rowLabel}!`, "info");
    updateAllViews();
  });

  // Clear Selection & Confirm Booking Buttons
  document.getElementById("btn-clear-selection").addEventListener("click", () => {
    state.selectedSeats = [];
    stopHoldTimer();
    updateAllViews();
  });

  document.getElementById("btn-confirm-booking").addEventListener("click", confirmBooking);

  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("eticket-modal").classList.add("hidden");
  });
}

// 4. Cursor Movement & Seat Selection Helpers
function getFocusedSeat() {
  const row = state.rowsGrid[state.focusedRow] || state.rowsGrid[0];
  const col = Math.min(state.focusedCol, row.seats.length - 1);
  state.focusedCol = col;
  return row.seats[col];
}

function jumpToSeat(rowIdx, colIdx) {
  state.focusedRow = Math.max(0, Math.min(state.rowsGrid.length - 1, rowIdx));
  const maxCol = state.rowsGrid[state.focusedRow].seats.length - 1;
  state.focusedCol = Math.max(0, Math.min(maxCol, colIdx));
  updateAllViews();
}

function moveFocus(dRow, dCol) {
  const nextRow = Math.max(0, Math.min(state.rowsGrid.length - 1, state.focusedRow + dRow));
  const maxCol = state.rowsGrid[nextRow].seats.length - 1;
  const nextCol = Math.max(0, Math.min(maxCol, state.focusedCol + dCol));

  state.focusedRow = nextRow;
  state.focusedCol = nextCol;
  updateAllViews();
}

function toggleSeatSelection(seat) {
  if (!seat) return;

  if (state.bookedSeats.has(seat.id) || state.myBookedSeats.has(seat.id)) {
    showToast(`Seat ${seat.id} is already booked.`, "error");
    return;
  }

  if (state.reservedSeats.has(seat.id)) {
    showToast(`Seat ${seat.id} is temporarily reserved by another viewer.`, "error");
    return;
  }

  const existingIdx = state.selectedSeats.findIndex((s) => s.id === seat.id);
  if (existingIdx > -1) {
    // Deselect seat
    state.selectedSeats.splice(existingIdx, 1);
    if (state.selectedSeats.length === 0) stopHoldTimer();
  } else {
    // Enforce Strict Max 6 Seats Cap
    if (state.selectedSeats.length >= MAX_SEATS) {
      showToast("Maximum 6 seats allowed per booking. Deselect a seat to choose another.", "error");
      return;
    }
    state.selectedSeats.push(seat);
    if (state.selectedSeats.length === 1) startHoldTimer();
  }

  updateAllViews();
}

// 5. Refresh Everything Consistently
function updateAllViews() {
  const focusedSeat = getFocusedSeat();
  updateTheatrePOV(focusedSeat);
  renderSeatGrid();
  renderItemizedCart();
}

// 6. Update First-Person Theatre POV Screen & Telemetry HUD
function updateTheatrePOV(seat) {
  const fmt = SCREEN_FORMATS[state.formatKey];
  const metrics = evaluateSeat(seat, state.formatKey, state.profileKey, state.isReclined);

  const povStage = document.getElementById("pov-stage");
  const virtualScreen = document.getElementById("virtual-screen");
  const screenXLeft = document.getElementById("screenx-left");
  const screenXRight = document.getElementById("screenx-right");
  const iceLeft = document.getElementById("ice-panels-left");
  const iceRight = document.getElementById("ice-panels-right");
  const headrests = document.getElementById("front-headrests");

  // Format-specific visual overlays (Curved IMAX, ScreenX 270°, ICE LEDs, 4DX shake)
  virtualScreen.classList.toggle("screen-curved", fmt.curved);
  screenXLeft.classList.toggle("hidden", state.formatKey !== "screenx");
  screenXRight.classList.toggle("hidden", state.formatKey !== "screenx");
  iceLeft.classList.toggle("hidden", state.formatKey !== "ice");
  iceRight.classList.toggle("hidden", state.formatKey !== "ice");

  const enable4dx = state.formatKey === "fourdx" || state.motion4dx;
  povStage.classList.toggle("motion-4dx-active", enable4dx);

  // Calculate real-time 3D CSS perspective transform based on seat distance & angles
  const dist = parseFloat(metrics.distanceM);
  const scale = Math.max(0.46, Math.min(1.42, (fmt.width * 0.68) / dist));
  const rotateX = Math.max(-26, Math.min(26, parseFloat(metrics.vTilt) * 0.95));
  const rotateY = (metrics.xPos < 0 ? 1 : -1) * Math.min(34, parseFloat(metrics.hSkew) * 1.15);
  const shiftX = -metrics.xPos * 7;

  virtualScreen.style.aspectRatio = fmt.aspectRatio;
  virtualScreen.style.width = "270px";
  virtualScreen.style.transform = `translate3d(${shiftX}px, 0px, 0px) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  // Adjust foreground headrest silhouette height using Sightline Clearance (mm)
  // Low clearance = headrests rise higher into bottom edge of view
  const obstructionPx = seat.rowIndex === 0
    ? 44
    : Math.max(0, Math.min(36, Math.round((220 - metrics.sightlineClearanceMm) * 0.22)));
  headrests.style.transform = `translateY(${obstructionPx}px)`;

  // Update Format Banner & Live Seat Telemetry Readouts
  document.getElementById("format-badge").textContent = `${fmt.name} • ${fmt.width}m × ${fmt.height}m`;
  document.getElementById("format-note").textContent = fmt.note;

  document.getElementById("hud-seat-id").textContent = `Row ${seat.rowLabel} • Seat ${seat.seatNum} (${seat.tier})`;
  document.getElementById("hud-price").textContent = `₹${seat.price} / seat`;
  document.getElementById("hud-fov").textContent = `${metrics.fov}°`;
  document.getElementById("hud-vtilt").textContent = `${metrics.vTilt}°`;
  document.getElementById("hud-hskew").textContent = `${metrics.hSkew}°`;
  document.getElementById("hud-focal").textContent = `${metrics.distanceM}m • ~${metrics.equivalentLensMm}mm Lens`;

  const scoreEl = document.getElementById("hud-score");
  scoreEl.textContent = `${metrics.score}/100 • ${metrics.rating}`;
  scoreEl.className =
    metrics.score >= 85
      ? "text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
      : metrics.score >= 65
      ? "text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40"
      : "text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40";

  // Update Select/Deselect D-Pad Center Button Label
  const isAlreadySelected = state.selectedSeats.some((s) => s.id === seat.id);
  const selectBtn = document.getElementById("btn-select-seat");
  selectBtn.textContent = isAlreadySelected ? `Remove ${seat.id}` : `Select ${seat.id} (₹${seat.price})`;
}

// 7. Render Interactive Auditorium Seat Grid with Tier Prices & 4-State Colors
function renderSeatGrid() {
  const gridContainer = document.getElementById("seat-grid");
  gridContainer.innerHTML = "";
  let lastTier = "";

  state.rowsGrid.forEach((row) => {
    // Tier Section Header with Per-Seat Price
    if (row.tier !== lastTier) {
      lastTier = row.tier;
      const tierHeader = document.createElement("div");
      tierHeader.className =
        "w-full flex justify-between items-center text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mt-3 mb-1.5 px-1";
      tierHeader.innerHTML = `
        <span class="font-semibold text-slate-300">${row.tier}</span>
        <span class="font-bold text-amber-400">₹${row.price} / seat</span>
      `;
      gridContainer.appendChild(tierHeader);
    }

    const rowEl = document.createElement("div");
    rowEl.className = "flex items-center justify-center gap-1 sm:gap-1.5 my-1";

    // Left Row Label
    const labelLeft = document.createElement("span");
    labelLeft.className = "w-5 text-xs font-bold text-slate-400 text-right mr-1";
    labelLeft.textContent = row.rowLabel;
    rowEl.appendChild(labelLeft);

    const half = row.seats.length / 2;

    row.seats.forEach((seat, cIdx) => {
      // Center Walkway Aisle Gap
      if (cIdx === half) {
        const aisleGap = document.createElement("div");
        aisleGap.className = "w-4 sm:w-7 flex items-center justify-center text-[9px] text-slate-600";
        aisleGap.textContent = "│";
        rowEl.appendChild(aisleGap);
      }

      const metrics = evaluateSeat(seat, state.formatKey, state.profileKey, state.isReclined);
      const isFocused = seat.rowIndex === state.focusedRow && seat.colIndex === state.focusedCol;
      const isSelected = state.selectedSeats.some((s) => s.id === seat.id);
      const isMyBooked = state.myBookedSeats.has(seat.id);
      const isBooked = state.bookedSeats.has(seat.id);
      const isReserved = state.reservedSeats.has(seat.id);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = `${seat.id} • ${seat.tier} • ₹${seat.price} • Score: ${metrics.score}/100 (FOV ${metrics.fov}°)`;

      let classes = `seat-btn ${seat.isRecliner ? "w-9 sm:w-11 h-8" : "w-7 sm:w-8 h-7"} text-[10px] font-bold flex flex-col items-center justify-center leading-none `;

      if (isMyBooked) {
        classes += "seat-my-booked";
        btn.innerHTML = `<span>${seat.seatNum}</span><span class="text-[8px]">✓</span>`;
      } else if (isSelected) {
        classes += "seat-selected";
        btn.innerHTML = `<span>${seat.seatNum}</span><span class="text-[8px]">${metrics.score}</span>`;
      } else if (isBooked) {
        classes += "seat-booked";
        btn.innerHTML = `<span>✕</span>`;
      } else if (isReserved) {
        classes += "seat-reserved";
        btn.innerHTML = `<span>🔒</span>`;
      } else {
        classes += "seat-available ";
        if (state.heatmapOn) {
          classes += metrics.heatmapClass;
        }
        btn.innerHTML = state.heatmapOn
          ? `<span>${seat.seatNum}</span><span class="text-[8px] opacity-90">${metrics.score}</span>`
          : `<span>${seat.seatNum}</span>`;
      }

      if (isFocused) {
        classes += " seat-focused";
      }

      btn.className = classes;

      // Single click focuses seat (updating live movie POV) and toggles selection if available
      btn.addEventListener("click", () => {
        state.focusedRow = seat.rowIndex;
        state.focusedCol = seat.colIndex;
        toggleSeatSelection(seat);
      });

      rowEl.appendChild(btn);
    });

    // Right Row Label
    const labelRight = document.createElement("span");
    labelRight.className = "w-5 text-xs font-bold text-slate-400 text-left ml-1";
    labelRight.textContent = row.rowLabel;
    rowEl.appendChild(labelRight);

    gridContainer.appendChild(rowEl);
  });
}

// 8. Render Per-Seat Itemized Price Breakdown & Total Amount (₹)
function renderItemizedCart() {
  const listEl = document.getElementById("itemized-list");
  const countEl = document.getElementById("selected-count");
  const totalEl = document.getElementById("total-amount");
  const confirmBtn = document.getElementById("btn-confirm-booking");

  countEl.textContent = `${state.selectedSeats.length} / ${MAX_SEATS} Seats`;

  if (state.selectedSeats.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-slate-400 italic py-2">No seats selected yet. Tap any seat or use the 4-way arrows to preview the view and select up to 6 seats.</p>`;
    totalEl.textContent = "₹0";
    confirmBtn.disabled = true;
    confirmBtn.classList.add("opacity-50", "cursor-not-allowed");
    return;
  }

  let total = 0;
  listEl.innerHTML = "";

  state.selectedSeats.forEach((seat) => {
    total += seat.price;
    const item = document.createElement("div");
    item.className =
      "flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 text-xs";
    item.innerHTML = `
      <div>
        <span class="font-bold text-blue-400">Row ${seat.rowLabel} • Seat ${seat.seatNum}</span>
        <span class="text-slate-400 ml-1.5">(${seat.tier})</span>
      </div>
      <div class="flex items-center gap-2.5">
        <span class="font-bold text-emerald-400">₹${seat.price}</span>
        <button type="button" class="text-slate-400 hover:text-red-400 font-bold text-sm" title="Remove seat">×</button>
      </div>
    `;
    item.querySelector("button").addEventListener("click", () => toggleSeatSelection(seat));
    listEl.appendChild(item);
  });

  totalEl.textContent = `₹${total}`;
  confirmBtn.disabled = false;
  confirmBtn.classList.remove("opacity-50", "cursor-not-allowed");
}

// 9. Confirm Booking -> Turn Seats Emerald Green & Show Digital E-Ticket
function confirmBooking() {
  if (state.selectedSeats.length === 0) return;

  const fmt = SCREEN_FORMATS[state.formatKey];
  let grandTotal = 0;
  const ticketLines = [];

  state.selectedSeats.forEach((seat) => {
    state.myBookedSeats.add(seat.id);
    grandTotal += seat.price;
    ticketLines.push(
      `<div class="flex justify-between py-1 border-b border-slate-800 text-xs">
        <span><strong>Row ${seat.rowLabel} • Seat ${seat.seatNum}</strong> (${seat.tier})</span>
        <span class="font-bold text-emerald-400">₹${seat.price}</span>
      </div>`
    );
  });

  document.getElementById("eticket-id").textContent = `CV-${Math.floor(100000 + Math.random() * 900000)}`;
  document.getElementById("eticket-details").innerHTML = `
    <p class="text-xs text-amber-400 font-semibold mb-2">${fmt.name}</p>
    ${ticketLines.join("")}
  `;
  document.getElementById("eticket-total").textContent = `₹${grandTotal}`;
  document.getElementById("eticket-modal").classList.remove("hidden");

  state.selectedSeats = [];
  stopHoldTimer();
  updateAllViews();
}

// 10. 5-Minute Reservation Lock Countdown & Toast Notifications
function startHoldTimer() {
  stopHoldTimer();
  state.timerSeconds = 300;
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.timerSeconds -= 1;
    updateTimerDisplay();

    if (state.timerSeconds <= 0) {
      state.selectedSeats = [];
      stopHoldTimer();
      showToast("5-minute seat reservation hold expired.", "error");
      updateAllViews();
    }
  }, 1000);
}

function stopHoldTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  const timerEl = document.getElementById("hold-timer");
  if (timerEl) timerEl.textContent = "05:00";
}

function updateTimerDisplay() {
  const mins = String(Math.floor(state.timerSeconds / 60)).padStart(2, "0");
  const secs = String(state.timerSeconds % 60).padStart(2, "0");
  const timerEl = document.getElementById("hold-timer");
  if (timerEl) timerEl.textContent = `${mins}:${secs}`;
}

function showToast(message, type = "info") {
  const banner = document.getElementById("toast-banner");
  banner.textContent = message;
  banner.className =
    type === "error"
      ? "text-xs font-semibold px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 mb-3"
      : "text-xs font-semibold px-3 py-2 rounded-lg bg-sky-500/20 border border-sky-500/50 text-sky-200 mb-3";
  banner.classList.remove("hidden");

  clearTimeout(banner._hideTimeout);
  banner._hideTimeout = setTimeout(() => banner.classList.add("hidden"), 3500);
}

// 11. Offline Animated Widescreen Trailer Canvas Fallback
function startFallbackCanvasAnimation() {
  const canvas = document.getElementById("fallback-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let frame = 0;

  function draw() {
    frame += 1;
    const w = canvas.width;
    const h = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#090d16");
    grad.addColorStop(0.5, "#1e1b4b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Animated sci-fi light sweep
    const sweepX = (Math.sin(frame * 0.03) * 0.5 + 0.5) * w;
    const glow = ctx.createRadialGradient(sweepX, h * 0.45, 8, sweepX, h * 0.45, 110);
    glow.addColorStop(0, "rgba(56, 189, 248, 0.55)");
    glow.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Perspective horizon grid lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 18, h * 0.55);
      ctx.lineTo(w / 2 + i * 55, h);
      ctx.stroke();
    }

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CINEVIEW DEMO REEL • 4K HDR", w / 2, h * 0.45);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "10px monospace";
    ctx.fillText("[ SUBTITLE: OPTIMAL VIEWING ANGLE CALIBRATED ]", w / 2, h * 0.86);

    requestAnimationFrame(draw);
  }

  draw();
}