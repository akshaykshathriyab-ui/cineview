/* =========================================================
   CineView – 3D Optical Geometry & SMPTE/THX Scoring Engine
   File: engine.js
   ========================================================= */

// 1. Indian Cinema Screen Formats & Projection Specifications
const SCREEN_FORMATS = {
  flat2d: {
    id: "flat2d",
    name: "Standard 2D Flat (1.85:1)",
    width: 14.0,       // meters
    height: 7.5,       // meters
    screenCenterZ: 4.1,
    aspectRatio: "16 / 9",
    curved: false,
    projection: "4K Laser / Xenon • 7.1 Surround",
    idealFov: 38,
    idealOrthoRatio: 1.30,
    skewWeight: 1.15,
    note: "Standard flat framing; balanced center rows deliver optimal perspective."
  },
  scope2d: {
    id: "scope2d",
    name: "Standard 2D Scope (2.39:1)",
    width: 18.0,
    height: 7.5,
    screenCenterZ: 4.1,
    aspectRatio: "21 / 9",
    curved: false,
    projection: "4K Scope Lens • Dolby Atmos",
    idealFov: 40,
    idealOrthoRatio: 1.25,
    skewWeight: 1.20,
    note: "Extra-wide cinemascope frame; mid-to-rear center seats prevent horizontal eye scan."
  },
  reald3d: {
    id: "reald3d",
    name: "3D (RealD / Laser 3D)",
    width: 16.0,
    height: 7.0,
    screenCenterZ: 4.0,
    aspectRatio: "21 / 9",
    curved: false,
    projection: "Dual-Beam Polarized Laser 3D",
    idealFov: 42,
    idealOrthoRatio: 1.15,
    skewWeight: 1.30,
    note: "Polarized glasses narrow peripheral vision; slightly closer center rows boost 3D depth."
  },
  imax: {
    id: "imax",
    name: "IMAX with Laser (1.90:1)",
    width: 22.0,
    height: 11.6,
    screenCenterZ: 5.4,
    aspectRatio: "1.9 / 1",
    curved: true,
    projection: "Dual 4K Laser • 12-Channel Sound",
    idealFov: 46,
    idealOrthoRatio: 1.05,
    skewWeight: 0.95,
    note: "Massive tall curved screen; upper-mid stadium rows prevent steep upward neck strain."
  },
  dolby: {
    id: "dolby",
    name: "Dolby Cinema (Vision + Atmos)",
    width: 21.0,
    height: 9.0,
    screenCenterZ: 4.6,
    aspectRatio: "2.35 / 1",
    curved: true,
    projection: "Dolby Vision HDR Dual 4K Laser",
    idealFov: 42,
    idealOrthoRatio: 1.15,
    skewWeight: 0.90,
    note: "High-contrast HDR laser and calibrated stadium slope widen the horizontal sweet spot."
  },
  fourdx: {
    id: "fourdx",
    name: "4DX / MX4D Motion",
    width: 15.0,
    height: 6.5,
    screenCenterZ: 3.9,
    aspectRatio: "21 / 9",
    curved: false,
    projection: "4-Seat Hydraulic Motion + Wind/Water/Fog",
    idealFov: 38,
    idealOrthoRatio: 1.25,
    skewWeight: 1.45,
    note: "Center-block pods provide balanced pitch/roll motion; outer edge seats feel heavy sway."
  },
  screenx: {
    id: "screenx",
    name: "ScreenX (270° Panoramic)",
    width: 16.0,
    height: 6.7,
    screenCenterZ: 4.0,
    aspectRatio: "21 / 9",
    curved: false,
    projection: "3-Wall Multi-Projector 270° Canvas",
    idealFov: 34,
    idealOrthoRatio: 1.45,
    skewWeight: 1.50,
    note: "Rear-center rows keep both left and right wall projections inside peripheral vision."
  },
  ice: {
    id: "ice",
    name: "ICE (Immersive Cinema Experience)",
    width: 16.0,
    height: 6.7,
    screenCenterZ: 4.0,
    aspectRatio: "21 / 9",
    curved: false,
    projection: "4K RGB Laser + 12 Ambient LED Side Panels",
    idealFov: 36,
    idealOrthoRatio: 1.35,
    skewWeight: 1.25,
    note: "Mid-to-rear center rows balance main screen focus with peripheral LED color ambience."
  },
  onyx: {
    id: "onyx",
    name: "Samsung Onyx Cinema LED",
    width: 14.0,
    height: 7.4,
    screenCenterZ: 4.0,
    aspectRatio: "1.89 / 1",
    curved: false,
    projection: "Direct-View 4K HDR LED Wall (No Projector)",
    idealFov: 38,
    idealOrthoRatio: 1.25,
    skewWeight: 0.75,
    note: "Self-emissive LED wall maintains uniform brightness and zero corner washout off-axis."
  },
  plf: {
    id: "plf",
    name: "Indian PLF (PVR P[XL] / INOX BIGPIX / PCX)",
    width: 24.0,
    height: 10.0,
    screenCenterZ: 5.0,
    aspectRatio: "2.39 / 1",
    curved: true,
    projection: "Wall-to-Wall Giant Screen • 4K RGB Laser",
    idealFov: 44,
    idealOrthoRatio: 1.10,
    skewWeight: 1.05,
    note: "Wall-to-wall giant format; rows 65%–80% back deliver immersive FOV without head turning."
  }
};

// 2. User Preference Profiles (Dynamic Score Weights)
const PREFERENCE_PROFILES = {
  balanced: {
    id: "balanced",
    label: "Balanced (THX Standard)",
    fovWeight: 1.5,
    tiltWeight: 2.1,
    skewWeight: 1.1,
    orthoWeight: 16,
    aisleBonus: 0
  },
  immersion: {
    id: "immersion",
    label: "IMAX / PLF Immersion",
    fovWeight: 2.2,
    tiltWeight: 1.5,
    skewWeight: 1.0,
    orthoWeight: 12,
    aisleBonus: 0
  },
  neckFriendly: {
    id: "neckFriendly",
    label: "Neck-Friendly (Zero Strain)",
    fovWeight: 1.1,
    tiltWeight: 3.4,
    skewWeight: 1.0,
    orthoWeight: 14,
    aisleBonus: 2
  },
  easyExit: {
    id: "easyExit",
    label: "Easy Exit (Aisle Priority)",
    fovWeight: 1.3,
    tiltWeight: 1.9,
    skewWeight: 0.9,
    orthoWeight: 14,
    aisleBonus: 14
  }
};

// 3. Auditorium Hall Layouts & Indian Seating Tiers
function buildAuditoriumGrid(hallType = "multiplex") {
  const rows = [];

  if (hallType === "boutique") {
    // Luxury Boutique Hall (PVR LUXE / INOX Insignia)
    const boutiqueTiers = [
      { label: "A", tier: "LUXE Front Lounger", price: 550, seats: 8, widthMm: 750, pitch: 1.50, riser: 0.35, recliner: true },
      { label: "B", tier: "LUXE Front Lounger", price: 550, seats: 8, widthMm: 750, pitch: 1.50, riser: 0.38, recliner: true },
      { label: "C", tier: "Insignia Prime Pod", price: 700, seats: 8, widthMm: 800, pitch: 1.60, riser: 0.42, recliner: true },
      { label: "D", tier: "Insignia Prime Pod", price: 700, seats: 8, widthMm: 800, pitch: 1.60, riser: 0.42, recliner: true },
      { label: "E", tier: "Royal Couple Recliner", price: 850, seats: 8, widthMm: 850, pitch: 1.70, riser: 0.45, recliner: true }
    ];
    return generateRowsFromSpec(boutiqueTiers, 6.2);
  }

  if (hallType === "singlescreen") {
    // Classic Indian Single-Screen Theatre (Front Stall, Dress Circle, Balcony)
    const singleScreenTiers = [
      { label: "A", tier: "Front Stall", price: 100, seats: 14, widthMm: 500, pitch: 0.90, riser: 0.15, recliner: false },
      { label: "B", tier: "Front Stall", price: 100, seats: 14, widthMm: 500, pitch: 0.90, riser: 0.15, recliner: false },
      { label: "C", tier: "Middle Stall / Dress Circle", price: 160, seats: 14, widthMm: 530, pitch: 0.98, riser: 0.28, recliner: false },
      { label: "D", tier: "Middle Stall / Dress Circle", price: 160, seats: 14, widthMm: 530, pitch: 0.98, riser: 0.30, recliner: false },
      { label: "E", tier: "Middle Stall / Dress Circle", price: 160, seats: 14, widthMm: 530, pitch: 0.98, riser: 0.32, recliner: false },
      { label: "F", tier: "Upper Dress Circle", price: 200, seats: 14, widthMm: 550, pitch: 1.02, riser: 0.35, recliner: false },
      { label: "G", tier: "Balcony", price: 260, seats: 12, widthMm: 580, pitch: 1.15, riser: 1.45, recliner: false },
      { label: "H", tier: "Balcony Box", price: 300, seats: 12, widthMm: 600, pitch: 1.20, riser: 0.42, recliner: false }
    ];
    return generateRowsFromSpec(singleScreenTiers, 5.5);
  }

  // Default: Standard 10-Row Indian Multiplex (Rows A–J)
  const multiplexTiers = [
    { label: "A", tier: "Classic / Silver (Silent Zone)", price: 150, seats: 14, widthMm: 525, pitch: 0.95, riser: 0.30, recliner: false },
    { label: "B", tier: "Classic / Silver (Silent Zone)", price: 150, seats: 14, widthMm: 525, pitch: 0.95, riser: 0.32, recliner: false },
    { label: "C", tier: "Executive / Classic Plus", price: 220, seats: 14, widthMm: 550, pitch: 1.00, riser: 0.35, recliner: false },
    { label: "D", tier: "Executive / Classic Plus", price: 220, seats: 14, widthMm: 550, pitch: 1.00, riser: 0.36, recliner: false },
    { label: "E", tier: "Prime / Gold / Grand", price: 320, seats: 14, widthMm: 575, pitch: 1.05, riser: 0.40, recliner: false },
    { label: "F", tier: "Prime / Gold / Grand", price: 320, seats: 14, widthMm: 575, pitch: 1.05, riser: 0.40, recliner: false },
    { label: "G", tier: "Prime / Gold / Grand", price: 320, seats: 14, widthMm: 575, pitch: 1.05, riser: 0.40, recliner: false },
    { label: "H", tier: "Diamond / Majestic / Platinum", price: 420, seats: 14, widthMm: 600, pitch: 1.10, riser: 0.42, recliner: false },
    { label: "I", tier: "Diamond / Majestic / Platinum", price: 420, seats: 14, widthMm: 600, pitch: 1.10, riser: 0.42, recliner: false },
    { label: "J", tier: "Recliner / Lounger", price: 650, seats: 10, widthMm: 750, pitch: 1.60, riser: 0.45, recliner: true }
  ];

  return generateRowsFromSpec(multiplexTiers, 6.0);
}

function generateRowsFromSpec(rowSpecs, frontDistance) {
  let cumulativeDistance = frontDistance;
  let cumulativeFloorZ = 0.2;

  return rowSpecs.map((spec, rIdx) => {
    if (rIdx > 0) {
      cumulativeDistance += spec.pitch;
      cumulativeFloorZ += spec.riser;
    }

    const half = spec.seats / 2;
    const seatSpacingM = (spec.widthMm / 1000) + 0.08; // seat width + armrest gap
    const aisleGapM = 0.9; // central walkway width

    const rowSeats = [];
    for (let cIdx = 0; cIdx < spec.seats; cIdx++) {
      const seatNum = cIdx + 1;
      const isLeftSide = cIdx < half;
      const offsetFromAisle = isLeftSide ? (half - cIdx - 0.5) : (cIdx - half + 0.5);
      const xPos = (isLeftSide ? -1 : 1) * (aisleGapM / 2 + offsetFromAisle * seatSpacingM);
      const isAisle = cIdx === 0 || cIdx === half - 1 || cIdx === half || cIdx === spec.seats - 1;

      rowSeats.push({
        id: `${spec.label}${seatNum}`,
        rowLabel: spec.label,
        rowIndex: rIdx,
        colIndex: cIdx,
        seatNum,
        tier: spec.tier,
        price: spec.price,
        widthMm: spec.widthMm,
        pitchMm: Math.round(spec.pitch * 1000),
        riserM: spec.riser,
        isRecliner: spec.recliner,
        isAisle,
        distanceM: cumulativeDistance,
        floorZ: cumulativeFloorZ,
        xPos
      });
    }

    return {
      rowLabel: spec.label,
      tier: spec.tier,
      price: spec.price,
      isRecliner: spec.recliner,
      seats: rowSeats
    };
  });
}

// 4. Core 3D Viewing-Angle & Comfort Score Calculator
function evaluateSeat(seat, formatKey = "scope2d", profileKey = "balanced", isReclined = false) {
  const fmt = SCREEN_FORMATS[formatKey] || SCREEN_FORMATS.scope2d;
  const profile = PREFERENCE_PROFILES[profileKey] || PREFERENCE_PROFILES.balanced;

  const d = seat.distanceM;
  const x = seat.xPos;
  const eyeHeightM = (seat.isRecliner && isReclined) ? 1.00 : 1.15;
  const zSeat = seat.floorZ + eyeHeightM;

  const toDeg = (rad) => (rad * 180) / Math.PI;

  // A. Horizontal Field of View (SMPTE / THX standard: ~36°–40°)
  const fovDeg = 2 * toDeg(Math.atan(fmt.width / (2 * d)));

  // B. Vertical Neck-Tilt Angle (positive = looking up, negative = looking down from balcony)
  const vTiltDeg = toDeg(Math.atan((fmt.screenCenterZ - zSeat) / d));

  // C. Horizontal Off-Axis Skew Angle
  const hSkewDeg = toDeg(Math.atan(Math.abs(x) / d));

  // D. Orthoscopic Focal-Length Match (35mm–50mm camera perspective equivalence)
  const orthoRatio = d / fmt.width;
  const equivalentLensMm = Math.round(Math.max(18, Math.min(85, 35 * orthoRatio)));
  const focalDiff = Math.abs(orthoRatio - fmt.idealOrthoRatio);

  // E. Sightline Head-Clearance Check (mm over viewer in front, minimum 120mm ideal)
  const sightlineClearanceMm = seat.rowIndex === 0
    ? 300
    : Math.round((seat.riserM * 1000) - 180 + (seat.pitchMm - 950) * 0.15);

  // F. Weighted Penalties & Comfort Score (0–100)
  const fovPenalty = Math.abs(fovDeg - fmt.idealFov) * profile.fovWeight;
  const tiltPenalty = vTiltDeg > 10
    ? (vTiltDeg - 10) * profile.tiltWeight
    : Math.max(0, Math.abs(vTiltDeg) - 8) * 0.8;
  const skewPenalty = hSkewDeg * profile.skewWeight * fmt.skewWeight;
  const orthoPenalty = focalDiff * profile.orthoWeight;
  const sightlinePenalty = sightlineClearanceMm < 120 ? (120 - sightlineClearanceMm) * 0.12 : 0;

  // Format-specific ergonomic adjustments
  let formatBonus = 0;
  if (formatKey === "fourdx" && seat.isAisle) formatBonus -= 10; // outer edge lateral sway
  if (formatKey === "screenx" && seat.rowIndex >= 6) formatBonus += 8; // rear rows see all 3 walls
  if (seat.isAisle) formatBonus += profile.aisleBonus;

  const rawScore = 100 - (fovPenalty + tiltPenalty + skewPenalty + orthoPenalty + sightlinePenalty) + formatBonus;
  const score = Math.max(12, Math.min(99, Math.round(rawScore)));

  // Classify rating label & heatmap CSS class
  let rating = "Fair View";
  let heatmapClass = "heatmap-low";
  if (score >= 85) {
    rating = "Orthoscopic Sweet Spot";
    heatmapClass = "heatmap-high";
  } else if (score >= 65) {
    rating = "Good Comfort";
    heatmapClass = "heatmap-mid";
  } else if (vTiltDeg > 18) {
    rating = "High Neck Strain";
  } else if (hSkewDeg > 22) {
    rating = "Off-Axis Skew";
  }

  return {
    distanceM: d.toFixed(1),
    fov: fovDeg.toFixed(1),
    vTilt: vTiltDeg.toFixed(1),
    hSkew: hSkewDeg.toFixed(1),
    equivalentLensMm,
    sightlineClearanceMm,
    score,
    rating,
    heatmapClass,
    xPos: x
  };
}

// 5. Sliding-Window Best-Group Seat Finder (N = 2 to 6 contiguous seats)
function findBestGroupSeats(rowsGrid, bookedSet, reservedSet, groupSize, formatKey, profileKey, isReclined) {
  let bestGroup = null;
  let bestAvgScore = -1;

  for (const row of rowsGrid) {
    const seats = row.seats;
    const half = seats.length / 2;

    for (let i = 0; i <= seats.length - groupSize; i++) {
      // Prevent splitting a group across the center aisle
      const crossesAisle = i < half && (i + groupSize) > half;
      if (crossesAisle) continue;

      const windowSeats = seats.slice(i, i + groupSize);
      const allAvailable = windowSeats.every(
        (s) => !bookedSet.has(s.id) && !reservedSet.has(s.id)
      );

      if (!allAvailable) continue;

      const totalScore = windowSeats.reduce((sum, s) => {
        return sum + evaluateSeat(s, formatKey, profileKey, isReclined).score;
      }, 0);

      const avgScore = totalScore / groupSize;
      if (avgScore > bestAvgScore) {
        bestAvgScore = avgScore;
        bestGroup = windowSeats;
      }
    }
  }

  return bestGroup;
}