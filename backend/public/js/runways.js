// ======================================================
// METAR — PRO+++
// - Chargement sécurisé
// - Détection piste active (04 / 22)
// - Composantes vent (headwind / crosswind)
// - Mise à jour UI + carte + sonomètres
// ======================================================

import { ENDPOINTS } from "./config.js";
import { fetchJSON, updateStatusPanel } from "./helpers.js";
import { computeWindComponents } from "./runways.js";
import { drawApproachCorridor, drawDepartureCorridor } from "./map.js";

const IS_DEV = location.hostname.includes("localhost");
const log = (...a) => IS_DEV && console.log("[METAR]", ...a);
const logErr = (...a) => console.error("[METAR ERROR]", ...a);

let lastMetar = null;

// ------------------------------------------------------
// INIT
// ------------------------------------------------------
export function initMetar() {
    safeLoadMetar();
}

// ------------------------------------------------------
// SAFE LOAD
// ------------------------------------------------------
export async function safeLoadMetar() {
    try {
        const data = await fetchJSON(ENDPOINTS.metar);
        if (!data || !data.data || !data.data[0]) {
            updateStatusPanel("METAR", { error: true });
            return;
        }

        const raw = data.data[0].raw_text;
        lastMetar = raw;

        updateMetarUI(raw);

        const rwy = detectActiveRunway(raw);
        window.activeRunway = rwy;

        updateRunwayUI(rwy);
        updateWindUI(raw, rwy);

        drawApproachCorridor(rwy);
        drawDepartureCorridor(rwy);

        updateStatusPanel("METAR", { ok: true });

    } catch (err) {
        logErr("Erreur METAR", err);
        updateStatusPanel("METAR", { error: true });
    }
}

// ------------------------------------------------------
// UI METAR
// ------------------------------------------------------
function updateMetarUI(raw) {
    const el = document.getElementById("metar");
    if (el) el.textContent = raw || "METAR indisponible";

    const ageEl = document.getElementById("metar-age");
    if (ageEl) ageEl.textContent = computeMetarAge(raw);
}

function computeMetarAge(raw) {
    if (!raw) return "inconnu";
    const m = raw.match(/(\d{2})(\d{2})(\d{2})Z/);
    if (!m) return "inconnu";

    const day = parseInt(m[1], 10);
    const hour = parseInt(m[2], 10);
    const min = parseInt(m[3], 10);

    const now = new Date();
    const metarDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), day, hour, min);

    const diff = (now - metarDate) / 60000;
    return `${Math.round(diff)} min`;
}

// ------------------------------------------------------
// Détection piste active
// ------------------------------------------------------
function detectActiveRunway(raw) {
    const m = raw.match(/ (\d{3})(\d{2})KT/);
    if (!m) return null;

    const windDir = parseInt(m[1], 10);

    const diff04 = angleDiff(windDir, 40);
    const diff22 = angleDiff(windDir, 220);

    return diff04 < diff22 ? "04" : "22";
}

function angleDiff(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

// ------------------------------------------------------
// UI RWY
// ------------------------------------------------------
function updateRunwayUI(rwy) {
    const box = document.getElementById("rwy-indicator");
    if (!box) return;

    box.textContent = rwy ? `RWY ${rwy}` : "RWY --";
}

// ------------------------------------------------------
// UI VENT
// ------------------------------------------------------
function updateWindUI(raw, rwy) {
    if (!raw || !rwy) return;

    const m = raw.match(/ (\d{3})(\d{2})KT/);
    if (!m) return;

    const windDir = parseInt(m[1], 10);
    const windSpeed = parseInt(m[2], 10);

    const rwyHeading = rwy === "04" ? 40 : 220;
    const { headwind, crosswind } = computeWindComponents(windDir, windSpeed, rwyHeading);

    const el = document.getElementById("runway-wind");
    if (el) {
        el.innerHTML = `
            Headwind : <b>${headwind} kt</b><br>
            Crosswind : <b>${crosswind} kt</b>
        `;
    }
}
