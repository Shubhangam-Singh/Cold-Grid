// ═══════════════════════════════════════════════════════
//  PPSC v25 — Final Patent-Ready Firmware
//  ─────────────────────────────────────────────────────
//  Project  : Perishable Predictor Smart Cart (PPSC)
//  Version  : v25 (built on v24 derived λ/γ parameters)
//  Author   : Shubhangam Singh (23BKT0059), VIT Vellore
//  Course   : BCSE497J — Project 1
//  Guide    : Dr. Kankana Roy
//  College  : VIT Vellore
//  Patent   : Indian Patent Application filed, IPO Chennai
//             IDF-B Doc No. 02-IPR-R003, VIT IPR&TTCELL
//  Novel    : Adaptive Arrhenius with EMA thermal memory (Ea_eff modulation)
//  Board    : ESP32 DevKit V1 | Core: 3.3.6 | IDE: 1.8.19
//  ─────────────────────────────────────────────────────
//  Base     : v24 (Derived λ/γ + State Reset + USB Power Fix)
//
//  ═══════════════════════════════════════════════════
//  v25 ADDITIONS (additive only — physics & patent claims unchanged):
//  ═══════════════════════════════════════════════════
//   [v25-1] Hardware watchdog (30dfs) — auto-reboots on loop hang
//           (I2C lockup, SD stall). Essential for unattended carts.
//   [v25-2] Persistent state (PPSC_STATE.txt) — freshness, EMA, and
//           expiry survive power cycles. Checksum + range validated.
//           Critical for food safety: half-spoiled stock must NOT
//           falsely read 100% after a battery swap or brownout.
//   [v25-3] NaN/range guards on sensor→Arrhenius path — a single
//           DHT22 CRC error or MQ-135 glitch can no longer poison
//           cumulativeDeg into permanent "nan%".
//
//  v24 PARAMETER DERIVATION RETAINED (patent-critical — DO NOT REVERT):
//    λ = exp(−2.9957 × Δt / τ_bio) → 0.9950–0.9975 (20–40 min persistence)
//    γ = R·T·ln(A_target)/Ea_base  → 0.020–0.050   (2–5% Ea depression)
//    Reverting to old λ=0.87–0.94 / γ=0.30 reintroduces the IPO
//    Section 10(4) disclosure flaw. See IDF-B Appendix A.
//
//  ═══════════════════════════════════════════════════
//  CRITICAL CHANGE — v24: DERIVED λ AND γ PARAMETERS
//  ═══════════════════════════════════════════════════
//
//  PROBLEM IN v23 (and all prior versions):
//    λ values (0.87–0.94) gave EMA persistence of only
//    0.7–1.6 MINUTES — not the 25–35 minutes claimed in
//    the patent specification (Indian Patent Application,
//    IPO Chennai). This was a Section 10(4) fatal flaw:
//    insufficient disclosure, parameters unjustified.
//
//    γ values (0.20–0.32) depressed Ea by 20–32%,
//    implying covalent bond breaking at ambient temp —
//    physically impossible (kT ≈ 2.5 kJ/mol at 300K).
//
//  DERIVATION (see IDF-B Appendix A):
//    λ = exp(−2.9957 × Δt / τ_bio)
//      where Δt=2s, τ_bio = biological persistence time
//      = time for enzyme activity to decay to 5% of peak
//      (3 time constants, standard exponential decay)
//
//    γ = R × T × ln(A_target) / Ea_base
//      where A_target = literature-reported spoilage rate
//      amplification after thermal abuse vs. isothermal
//
//  RESULT — all persistence times now match patent claim:
//    Tomato  λ=0.997151  γ=0.030  τ=35 min  (PG enzyme)
//    Banana  λ=0.996677  γ=0.030  τ=30 min  (PPO enzyme)
//    Apple   λ=0.997507  γ=0.020  τ=40 min  (PPO thermostable)
//    Leafy   λ=0.995020  γ=0.050  τ=20 min  (Chlorophyllase+LOX)
//    Mango   λ=0.996677  γ=0.030  τ=30 min  (PG+PPO cascade)
//    Milk    λ=0.996014  γ=0.040  τ=25 min  (Psychrotrophic lipase)
//    Fish    λ=0.996014  γ=0.050  τ=25 min  (TMAO reductase)
//    Paneer  λ=0.996014  γ=0.040  τ=25 min  (Residual protease)
//
//  eaMinFrac updated to per-produce F_ss values (0.95–0.98)
//  fMin updated to match eaMinFrac (was blanket 0.55–0.75)
//
//  ─────────────────────────────────────────────────────
//  FIXES IN v24:
//
//  [A] DERIVED λ/γ PARAMETERS — All 8 produce updated with
//      first-principles derivations from enzyme inactivation
//      kinetics literature. See IDF-B Appendix A for full
//      per-produce mathematical derivation and verification.
//      Old λ gave ~1 min persistence; v24 gives 20–40 min.
//      Old γ gave 20–32% Ea depression; v24 gives 2–5%.
//
//  [B] WiFi ADC DEBOUNCE — ESP32 RF amplifier draws 300–400mA
//      bursts during WiFi TX. This causes voltage sag on GPIO35
//      battery ADC, triggering false Mode C transitions. In v23
//      this created oscillation: C→B→A→C (WiFi on→sag→off→recover).
//      Fix: 8-sample rolling average on battery ADC with outlier
//      rejection (>15% deviation from rolling mean discarded).
//      Minimum 5s dwell time before any mode transition.
//
//  [C] dt ROLLOVER CAP — millis() wraps at ~49.7 days.
//      Previous code: dt = (now - lastDegTime) / 3600000.0
//      If millis() wraps while system is running, dt would be
//      ~49.7 days → massive cumulativeDeg spike → instant expiry.
//      Fix: dt = fminf(dt, 60.0f/3600.0f)  [cap at 60 seconds]
//
//  [D] saveProdHistory() BUG FIX — In v23, handleInput() set
//      selectedProduce = menuCursor BEFORE calling resetProduce(),
//      which calls saveProdHistory(). History was saved with the
//      NEW produce name (wrong). Fixed: saveProdHistory() now
//      called explicitly with oldProduce index before switch.
//
//  [E] ENHANCED SELF-TEST — Added 35°C EMA persistence check.
//      Verifies that λ values produce >20min persistence window
//      (catches any future regression to v23-style λ values).
//
//  ─────────────────────────────────────────────────────
//  v23 FIXES (retained):
//
//  [A] STATE CARRYOVER — Auto-reset on produce switch.
//  [B] USB POWER MODE — Battery disabled by default (USB lock).
//  [C] MQ135_PWR_PIN gated on USE_BATTERY flag.
//
//  ─────────────────────────────────────────────────────
//  v22 FIXES (retained):
//
//  [1] PHYSICS FIX — G(VOC) and H(RH) MOVED to rate
//      post-multipliers. In v21 they acted on Ea, causing
//      catastrophic exponential amplification:
//        v21 at 92%RH: Tomato=55× Fish=5264× (should be ~1.5×)
//        v21 at 350ppm VOC: up to 4408× (should be ~1.1×)
//      Physical basis: humidity affects water availability
//      (pre-exponential), VOC is a spoilage indicator.
//      Only F(thermal history) genuinely changes Ea via
//      irreversible protein denaturation (Bigelow 1921).
//
//  [2] RECALIBRATED DB[] — Ea values from peer-reviewed
//      literature (Kale&Nath 2018, Disney 1969, Dalavi 2025).
//      k0 recalculated via Arrhenius half-life formula.
//      All 8 produce pass baseline self-test at 25°C.
//
//  [3] eaMinFrac TIGHTENED to 0.90-0.95 (was 0.68-0.75)
//      eaMaxFrac REMOVED (proven mathematically unreachable)
//
//  [4] PER-PRODUCE thermalStressK replaces global 303.15K
//      Physical: different produce have different stress onset
//
//  [5] LEAFY VEG bidirectional humidity (desiccation at RH<60%)
//
//  [6] STARTUP SELF-TEST validates all produce at baseline
//
//  All v21 features preserved: energy scheduler, LUT modes,
//  battery monitoring, MQ-135 power gating, dashboard.
//
//  HARDWARE  (ESP32 DevKit V1):
//    1.3" SSH1106 OLED I2C — SDA=21  SCL=22
//    DHT22           — GPIO4  (10kΩ pullup)
//    MQ-135 AO       — GPIO34 (ADC1, 5V power)
//    MQ-135 PWR      — GPIO13 (NPN gate for power saving)
//    DS1307 RTC      — SDA=21  SCL=22 (shared I2C)
//    SD Card SPI     — CS=5  SCK=18  MISO=19  MOSI=23
//    RGB LED         — R=GPIO2  G=GPIO27  B=GPIO15
//                      220Ω on each colour leg
//    Buzzer NPN      — GPIO32 → 1kΩ → NPN Base
//    BTN UP=25  DOWN=26  SEL=33  BACK=14
//    Battery ADC     — GPIO35 (voltage divider, input-only)
// ═══════════════════════════════════════════════════════

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <DHT.h>
#include <RTClib.h>
#include <SD.h>
#include <SPI.h>
#include <math.h>
#include <WiFi.h>
#include <WebServer.h>
#include <esp_task_wdt.h>   // v25: hardware watchdog for continuous deployment

// ═══════════════════════════════════════════════════════
//  VERSION STRINGS — v24
// ═══════════════════════════════════════════════════════
const char* MODEL_VERSION  = "PPSC-v25-final";
const char* PHYSICS_MODEL  = "Arrhenius+EMA+PostMult v25 (2026-03-05)";

// v25: Watchdog — reboots ESP32 if main loop hangs >30s (I2C lockup, SD stall)
#define WDT_TIMEOUT_S   30
// v25: Persistent state — survives power cycle so freshness resumes correctly
#define STATE_FILE      "/PPSC_STATE.txt"

// ═══════════════════════════════════════════════════════
//  WIFI CONFIG
// ═══════════════════════════════════════════════════════
#define WIFI_SSID  "PPSC_Cart"
#define WIFI_PASS  "12345678"
WebServer server(80);

// ═══════════════════════════════════════════════════════
//  DISPLAY — 1.3 inch SSH1106, 128×64 px
//  Font size 1 → 6×8 px per char → 21 chars wide, 8 rows
// ═══════════════════════════════════════════════════════
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
#define OLED_RESET      -1
Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ═══════════════════════════════════════════════════════
//  HARDWARE PINS
// ═══════════════════════════════════════════════════════
#define DHTPIN   4
#define DHTTYPE  DHT22
DHT dht(DHTPIN, DHTTYPE);
RTC_DS1307 rtc;

#define BTN_UP    25
#define BTN_DOWN  26
#define BTN_SEL   33
#define BTN_BACK  14

// ── RGB LED ──────────────────────────────────────────
#define RGB_COMMON_ANODE  false
#define RGB_R   2
#define RGB_G  27
#define RGB_B  15

void rgbWrite(int pin, bool on) {
  if (RGB_COMMON_ANODE)
    digitalWrite(pin, on ? LOW : HIGH);
  else
    digitalWrite(pin, on ? HIGH : LOW);
}

#define BUZZER_PIN      32
#define BUZZER_RES       8
#define BUZZER_FREQ    880
#define BUZZ_ON_MS     400
#define BUZZ_OFF_MS   3000
#define BUZZ_EXP_ON_MS  200
#define BUZZ_EXP_OFF_MS 200
#define LED_BLINK_MS    250

#define SD_CS 5

// ═══════════════════════════════════════════════════════
//  MQ-135 GAS SENSOR
// ═══════════════════════════════════════════════════════
#define MQ135_PIN        34
#define MQ135_SAMPLES     8
#define MQ135_WARMUP_MS   120000UL
#define MQ135_OFFSET      200
#define MQ135_PWR_PIN    13    // v21: power gate for Mode C (only if USE_BATTERY)

// ═══════════════════════════════════════════════════════
//  BATTERY / ENERGY SCHEDULER  — v21
//  ★ SET TO false WHEN POWERED BY USB (no battery) ★
//  When false: GPIO35 not read, locked to PWR_MODE_A,
//  MQ135_PWR_PIN not toggled, full-precision Arrhenius.
// ═══════════════════════════════════════════════════════
#define USE_BATTERY      0     // ← set to 1 if battery+divider on GPIO35

// PowerMode enum MUST be declared before #if USE_BATTERY block.
// Arduino IDE auto-generates forward declarations at file top;
// if PowerMode is inside #if, the stub signatures in #else become
// invisible to the preprocessor → "not declared in this scope" error.
enum PowerMode { PWR_MODE_A, PWR_MODE_B, PWR_MODE_C };
PowerMode currentPowerMode = PWR_MODE_A;
float batteryPct = 100.0f;
unsigned long lastBattCheck = 0;
#define BATT_CHECK_MS  10000

// Forward declarations (always needed for LUT functions)
void precompute_lut2D(int idx);
void precompute_lut1D(int idx);

#if USE_BATTERY
#define BATT_ADC_PIN     35    // input-only GPIO
#define BATT_ADC_SAMPLES 16
#define BATT_FULL_MV     4200  // fully charged Li-ion
#define BATT_EMPTY_MV    3000  // cutoff voltage
// Voltage divider: R1=100k, R2=100k → Vpin = Vbatt/2
// ADC 12-bit: 0-4095 → 0-3.3V → 0-6.6V battery
#define BATT_MV_PER_ADC  1.6117f  // 6600.0/4095.0
// Hysteresis thresholds (battery %)
#define BATT_THRESH_AB   60  // above 60% → Mode A
#define BATT_THRESH_BC   25  // above 25% → Mode B, below → Mode C
#define BATT_HYST        5   // hysteresis band

void transitionToMode(PowerMode newMode);

#else  // USE_BATTERY == false
// ── No battery: lock to Mode A, skip GPIO35 ──
// MUST use #define macros, NOT inline functions.
// Arduino IDE auto-generates forward declarations for ALL functions
// at the very top of the file — before enum PowerMode is declared.
// Macros bypass this entirely.
#define evaluatePowerMode()   ((void)0)
#define transitionToMode(x)   ((void)0)
#endif  // USE_BATTERY

// LUT for Mode B: 2D lookup [temperature × Ea_eff]
// 128 entries: 8 Ea steps × 16 temp steps
#define LUT2D_EA_STEPS   8
#define LUT2D_T_STEPS   16
#define LUT2D_SIZE      (LUT2D_EA_STEPS * LUT2D_T_STEPS)
static float lut2D[LUT2D_SIZE];
static float lut2D_Ea_min, lut2D_Ea_step, lut2D_Ea_inv;
static float lut2D_T_min = 0.0f, lut2D_T_step = 3.4375f; // 0-55°C in 16 steps
static float lut2D_T_inv;

// LUT for Mode C: 1D lookup [temperature only, fixed Ea_base]
#define LUT1D_T_STEPS   31  // 0-60°C in 2°C steps
static float lut1D[LUT1D_T_STEPS];

// ═══════════════════════════════════════════════════════
//  PHYSICS CONSTANT
// ═══════════════════════════════════════════════════════
#define R_GAS  8.314f

// ═══════════════════════════════════════════════════════
//  PRODUCE DATABASE  — v22: corrected physics model
//
//  KEY CHANGES FROM v21:
//  - alpha, beta → alpha_rate, beta_rate (POST-multipliers on rate)
//  - eaMaxFrac REMOVED (mathematically unreachable: G×H×F ≤ 1.0)
//  - thermalStressK ADDED (per-produce EMA onset temperature)
//  - Only F(hist) modulates Ea (physically justified)
//  - H(RH) and G(VOC) are rate multipliers (not Ea modifiers)
//
//  Struct fields (16 per produce):
//    name, basePrice, Ea(kJ/mol), shelfLifeDays, k0(h⁻¹),
//    lambda, gamma_, fMin, eaMinFrac, thermalStressK,
//    beta_rate, rhRef, sRh,
//    alpha_rate, vocRef, sVoc
// ═══════════════════════════════════════════════════════
#define PRODUCE_COUNT 8
#define GRAPH_POINTS  64
#define GRAPH_LOG_REAL_MS  600000UL
#define GRAPH_LOG_DEMO_MS     500UL

struct Produce {
  const char* name;
  float basePrice;        // INR per unit
  float Ea;               // kJ/mol — base activation energy (literature-cited)
  float shelfLifeDays;    // days at 25°C (vendor practical life)
  float k0;               // h⁻¹ pre-exponential factor (cancels in ratio; used in Arrhenius rate calc)

  // ── F(hist): THERMAL HISTORY → modulates Ea ──────────────
  // Physical basis: sustained elevated degradation rate from heat-induced
  // irreversible enzyme/membrane structural changes (Gram & Huss 1996; Peleg 2006)
  // NOT Bigelow 1921 (which covers microbial D/z-values, not enzyme refolding)
  float lambda;           // EMA smoothing factor — v24: 0.9950–0.9975 (derived from τ_bio)
  float gamma_;           // EMA→Ea coupling coeff — v24: 0.020–0.050 (2–5% Ea depression)
  float fMin;             // Floor for F — v24: equals eaMinFrac (F_ss = 1−γ)
  float eaMinFrac;        // Hard clamp floor — v24: 0.95–0.98 (conformational changes only)
  float thermalStressK;   // Per-produce EMA onset temperature [Kelvin]

  // ── H(RH): HUMIDITY → POST-MULTIPLIER on rate ────────────
  // Physical basis: water activity (aw) for microbial growth (pre-exponential)
  float beta_rate;        // Rate multiplier coeff  (0.00 liquid → 0.30 solid)
  float rhRef;            // Threshold RH% (no penalty below this)
  float sRh;              // Scale [%RH]

  // ── G(VOC): VOC → POST-MULTIPLIER on rate ────────────────
  // Physical basis: VOC = biological state indicator, not Ea modifier
  float alpha_rate;       // Rate multiplier coeff  (0.10–0.40)
  float vocRef;           // Baseline VOC [pseudo-ppm, MQ-135 scale] — RAISED vs v21
  float sVoc;             // Sigmoid scale

  // NOTE: eaMaxFrac REMOVED — proven unreachable: G×H×F ≤ 1.0 always
};

// ═══════════════════════════════════════════════════════
//  PRODUCE DATABASE  — v24: DERIVED λ AND γ PARAMETERS
//
//  KEY CHANGES FROM v23:
//  - lambda: derived from biological persistence time τ_bio
//    λ = exp(−2.9957 × Δt / τ_bio), Δt=2s
//    Old values (0.87–0.94): 0.7–1.6 min persistence [WRONG]
//    New values (0.9950–0.9975): 20–40 min persistence [CORRECT]
//  - gamma_: derived from literature rate amplification A_target
//    γ = R × T × ln(A_target) / Ea_base
//    Old values (0.20–0.32): 20–32% Ea depression [UNPHYSICAL]
//    New values (0.02–0.05): 2–5% Ea depression [CORRECT]
//  - fMin: updated to match eaMinFrac (F_ss = 1−γ)
//    Physical: EMA steady-state F cannot exceed design floor
//  - eaMinFrac: updated to per-produce F_ss values (0.95–0.98)
//    Physical: conformational enzyme changes, not covalent bonds
//
//  All other fields (Ea, shelfLifeDays, k0, thermalStressK,
//  beta_rate, rhRef, sRh, alpha_rate, vocRef, sVoc) UNCHANGED.
//
//  Literature sources for λ/γ: see IDF-B Appendix A.
//  ★★★ = peer-reviewed  ★★ = derived  ★ = engineering est.
// ═══════════════════════════════════════════════════════
const Produce DB[PRODUCE_COUNT] = {

// ── TOMATO ─────────────────────────────────────────────────────────────────
// Ea=109.7 kJ/mol: Kale & Nath 2018 IJCMAS DOI:10.20546/ijcmas.2018.706.131 ★★★
// shelf=3.75d: Indian market standard ★★
// thermalStressK=303.15K: mesophilic fungi optimal at 30°C
// vocRef=120: raised from 100 — prevents ethylene false alarm
// beta_rate=0.20: solid produce, fungal at 90%+ RH → ~1.14× max
// ── v24 DERIVED PARAMETERS ──────────────────────────────
// Enzyme: Polygalacturonase (PG) — Kale & Nath 2018 Table 3
// τ_bio = 35 min (2100 s): PG re-folding at 30–35°C, conservative upper bound
// λ = exp(−2.9957 × 2 / 2100) = 0.997151  → persistence = 35.0 min ✓
// γ = 0.030: 3% Ea depression → 3.54× rate at design point
//   A_target=3.54: Kale & Nath 2018 report 3–4× firmness acceleration
//   F_ss = 1−0.030 = 0.970  eaMinFrac=0.97  fMin=0.970
//   name       price  Ea     shelf  k0
{  "Tomato",   20.0, 109.7,  3.750, 1.277e17f,
//   lam         gam     fMin   eaMin  Tstress   beta_r rhRef  sRh  alpha_r vocRef  sVoc
   0.997151f, 0.030f, 0.970f, 0.97f, 303.15f, 0.20f, 75.0f, 25.0f, 0.15f, 120.0f, 150.0f},

// ── BANANA ─────────────────────────────────────────────────────────────────
// Ea=60.9 kJ/mol: Dalavi et al. 2025 JABB 2-point fit (13°C/336h, 25°C/120h) ★★
// shelf=5.0d: Dalavi et al. 2025 ★★
// thermalStressK=301.15K: 28°C — ethylene autocatalysis threshold
// vocRef=100: prevents false alarm from isoamyl acetate background
// ── v24 DERIVED PARAMETERS ──────────────────────────────
// Enzyme: Polyphenol oxidase (PPO) — Weemaes et al. 1998; Dalavi 2025 Table 2
// τ_bio = 30 min (1800 s): PPO partial reactivation at 28–35°C
// λ = exp(−2.9957 × 2 / 1800) = 0.996677  → persistence = 30.0 min ✓
// γ = 0.030: 3% Ea depression → 2.03× rate at design point
//   A_target=2.03: Dalavi 2025 report ~2× accelerated browning
//   F_ss = 0.970  eaMinFrac=0.97  fMin=0.970
{"Banana",     15.0,  60.9,  5.000, 2.701e8f,
   0.996677f, 0.030f, 0.970f, 0.97f, 301.15f, 0.20f, 75.0f, 25.0f, 0.15f, 100.0f, 130.0f},

// ── APPLE ──────────────────────────────────────────────────────────────────
// Ea=90.0 kJ/mol: Hertog/Gwanpua 2014 Phil Trans R Soc A ★ (cold data extrapolated)
// shelf=7.0d: Indian market observation ★
// thermalStressK=301.15K: cold-adapted cultivar, stress begins at 28°C
// vocRef=110: ethylene-blind (MQ-135 detects terminal ethanol only)
// beta_rate=0.15: Penicillium rot modest above 90% RH
// ── v24 DERIVED PARAMETERS ──────────────────────────────
// Enzyme: PPO thermostable isoform — Vamos-Vigyázó 1981; Hertog/Gwanpua 2014
// τ_bio = 40 min (2400 s): Apple PPO thermostable; 40–60 min residual activity
// λ = exp(−2.9957 × 2 / 2400) = 0.997507  → persistence = 40.1 min ✓
// γ = 0.020: 2% Ea depression → 2.01× rate at design point
//   A_target=2.01: Hertog 2014 report 1.8–2.2× respiration acceleration
//   F_ss = 0.980  eaMinFrac=0.98  fMin=0.980
{"Apple",      80.0,  90.0,  7.000, 2.419e13f,
   0.997507f, 0.020f, 0.980f, 0.98f, 301.15f, 0.15f, 85.0f, 20.0f, 0.10f, 110.0f, 150.0f},

// ── LEAFY VEG ──────────────────────────────────────────────────────────────
// Ea=44.5 kJ/mol: Kaur et al. (chlorophyll thermal, endpoint mismatch) ★
// shelf=2.0d: FSSAI "highly perishable", ICMR guidance ★★
// thermalStressK=298.15K: 25°C — extremely heat-sensitive, stress from 25°C
// vocRef=80: intentionally low — detects terminal NH₃/H₂S from bacteria
// beta_rate=0.25: bacterial soft rot is strongly RH-sensitive
// NOTE: bidirectional humidity (desiccation at RH<60%) in updateDegradationAdaptive()
// ── v24 DERIVED PARAMETERS ──────────────────────────────
// Enzyme: Chlorophyllase + Lipoxygenase (LOX) — Toivonen & Brummell 2008
// τ_bio = 20 min (1200 s): wilting acceleration subsides 15–25 min post-cooling
// λ = exp(−2.9957 × 2 / 1200) = 0.995020  → persistence = 20.0 min ✓
// γ = 0.050: 5% Ea depression → 2.38× rate at design point
//   A_target=2.38: FSSAI/ICMR note 2–3× faster degradation after cold-chain break
//   F_ss = 0.950  eaMinFrac=0.95  fMin=0.950
{"Leafy_Veg",  30.0,  44.5,  2.000, 9.038e5f,
   0.995020f, 0.050f, 0.950f, 0.95f, 298.15f, 0.25f, 85.0f, 20.0f, 0.10f,  80.0f, 120.0f},

// ── MANGO ──────────────────────────────────────────────────────────────────
// Ea=50.0 kJ/mol: Conservative (Chula U ETD 2019 DOI:10.58837/CHULA.THE.2019.84) ★★
// shelf=4.0d: Chula U ETD 2019 ★★
// thermalStressK=303.15K: tropical — stress above 30°C
// beta_rate=0.30: Colletotrichum anthracnose highly RH-sensitive (max 1.30×)
// ── v24 DERIVED PARAMETERS ──────────────────────────────
// Enzyme: PG + PPO cascade — Chula U 2019 ETD Table 4.2
// τ_bio = 30 min (1800 s): softening persistence 25–35 min post-heat (midpoint)
// λ = exp(−2.9957 × 2 / 1800) = 0.996677  → persistence = 30.0 min ✓
// γ = 0.030: 3% Ea depression → 1.78× rate at design point
//   A_target=1.78: Chula U 2019 data show 1.7–2.0× softening ratio
//   F_ss = 0.970  eaMinFrac=0.97  fMin=0.970
{"Mango",      60.0,  50.0,  4.000, 4.156e6f,
   0.996677f, 0.030f, 0.970f, 0.97f, 303.15f, 0.30f, 75.0f, 25.0f, 0.15f, 100.0f, 140.0f},

// ── MILK ───────────────────────────────────────────────────────────────────
// Ea=90.0 kJ/mol: Composite — Ratkowsky LAB=71.8, conservative estimate ★
// shelf=0.229d (5.5h): FSSAI raw milk ambient guidance ★★
// thermalStressK=298.15K: mesophilic bacteria active from 25°C
// beta_rate=0.00: LIQUID — ambient RH cannot change internal aw=0.995 ★★★
// alpha_rate=0.25: NH₃+ethanol from LAB fermentation reliably on MQ-135
// vocRef=90: slightly below 100 to catch NH₃ at early fermentation
// PATENT: Dynamic Ea for liquid validated by Zwietering 1991 (strongest claim)
// ── v24 DERIVED PARAMETERS ──────────────────────────────
// Enzyme: Psychrotrophic lipase (Pseudomonas fluorescens) — Stepaniak 1991
// τ_bio = 25 min (1500 s): residual lipolytic activity 20–30 min post-recooling
// λ = exp(−2.9957 × 2 / 1500) = 0.996014  → persistence = 25.0 min ✓
// γ = 0.040: 4% Ea depression → 4.08× rate at design point
//   A_target=4.08: FSSAI shelf life halved after 30-min thermal abuse above 25°C
//   F_ss = 0.960  eaMinFrac=0.96  fMin=0.960
{"Milk",       25.0,  90.0,  0.229, 7.390e14f,
   0.996014f, 0.040f, 0.960f, 0.96f, 298.15f, 0.00f, 99.0f, 10.0f, 0.25f,  90.0f, 100.0f},

// ── FISH ───────────────────────────────────────────────────────────────────
// Ea=82.9 kJ/mol: Disney et al. 1969 / ICAR: 5°C→192h, 30°C→10h fitted ★★★
// shelf=0.725d (17.4h): Indian fish market standard ★★★
// thermalStressK=298.15K: Shewanella optimal at 20–25°C
// alpha_rate=0.40: HIGHEST — TMA→NH₃ progressively detected by MQ-135 ★★★
// vocRef=80: trace TMAO present from fresh fish baseline
// BEST CALIBRATED PRODUCE — Ea 82.9 kJ/mol within published range 70–100
// ── v24 DERIVED PARAMETERS ──────────────────────────────
// Enzyme: TMAO reductase (Shewanella putrefaciens) — Gram & Huss 1996; Disney 1969
// τ_bio = 25 min (1500 s): TMA production acceleration persists 20–30 min
// λ = exp(−2.9957 × 2 / 1500) = 0.996014  → persistence = 25.0 min ✓
// γ = 0.050: 5% Ea depression → 5.04× rate at design point (most perishable)
//   A_target=5.04: Disney 1969 report 4–6× TMA production acceleration
//   F_ss = 0.950  eaMinFrac=0.95  fMin=0.950
{"Fish",      150.0,  82.9,  0.725, 1.332e13f,
   0.996014f, 0.050f, 0.950f, 0.95f, 298.15f, 0.08f, 80.0f, 20.0f, 0.40f,  80.0f, 100.0f},

// ── PANEER ─────────────────────────────────────────────────────────────────
// Ea=52.8 kJ/mol: 2-point fit Raju & Sasikala 2016 (4°C→144h, 25°C→24h) ★★
// shelf=1.0d: Raju & Sasikala 2016 explicitly stated ★★★
// thermalStressK=298.15K: dairy, same mesophilic range as milk
// beta_rate=0.10: semi-solid surface, modest fungal at high RH
// alpha_rate=0.20: ethanol+NH₃ detectable at 50%+ spoilage
// ── v24 DERIVED PARAMETERS ──────────────────────────────
// Enzyme: Residual milk protease + surface Lactobacillus — Raju & Sasikala 2016 Table 3
// τ_bio = 25 min (1500 s): growth acceleration persists 20–30 min post-cooling
// λ = exp(−2.9957 × 2 / 1500) = 0.996014  → persistence = 25.0 min ✓
// γ = 0.040: 4% Ea depression → 2.28× rate at design point
//   A_target=2.28: Raju & Sasikala 2016 report 2.0–2.5× spoilage acceleration
//   F_ss = 0.960  eaMinFrac=0.96  fMin=0.960
{"Paneer",     90.0,  52.8,  1.000, 5.144e7f,
   0.996014f, 0.040f, 0.960f, 0.96f, 298.15f, 0.10f, 80.0f, 20.0f, 0.20f, 100.0f, 130.0f},
};

const char* produceNames[PRODUCE_COUNT] = {
  "Tomato", "Banana", "Apple",  "Leafy Veg",
  "Mango",  "Milk",   "Fish",   "Paneer"
};

const char* detailItems[] = {
  "Status",        // 0
  "Dyn. Price",    // 1
  "Arrhenius",     // 2
  "Temp Graph",    // 3
  "Fresh Graph",   // 4
  "Sell Log",      // 5
  "Prod History",  // 6
  "Day Report",    // 7
  "Demo Mode",     // 8
  "Physics Mode",  // 9
  "Reset",         // 10
  "Back"           // 11
};
#define DETAIL_COUNT 12

// ── Demo speeds — up to 10000x ───────────────────────
const float demoSpeeds[]     = {100.0, 500.0, 1000.0, 3000.0, 5000.0, 10000.0};
const char* demoSpeedShort[] = {"1",   "5",   "1k",   "3k",   "5k",   "10k"  };
const int   demoSpeedFull[]  = {100,   500,   1000,   3000,   5000,   10000  };
#define DEMO_SPEED_COUNT 6

// ═══════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════
float tempHistory[GRAPH_POINTS];
float freshHistory[GRAPH_POINTS];
int   historyIdx   = 0;
int   historyCount = 0;

int   selectedProduce    = 5;
float currentFreshness   = 100.0;
float currentTemp        = 25.0;
float currentHumidity    = 60.0;
float currentPrice       = 0.0;
float degradationRate    = 1.0;
float shelfLifeRemaining = 0.0;
float cumulativeDeg      = 0.0;
bool  demoMode           = false;
bool  isExpired          = false;
int   demoSpeedIdx       = 2;
unsigned long produceSetTime = 0;

// MQ-135
float currentVOC    = 0.0;
float gasMultiplier = 1.0;   // kept for display compatibility
bool  mq135Ready    = false;
int   mq135RawLast  = 0;

// Physics mode
bool useAdaptiveEa = false;
float adp_thermalEMA   = 0.0f;   // v21: init to 0 (new EMA formula)
float adp_Ea_eff       = 0.0f;
float adp_G_voc        = 1.0f;
float adp_H_rh         = 1.0f;
float adp_F_hist       = 1.0f;

// Timing
unsigned long lastBuzzTime  = 0;
bool          buzzerOn      = false;
unsigned long lastLEDBlink  = 0;
bool          ledBlinkState = false;
unsigned long lastBtnTime    = 0;
unsigned long lastSensorRead = 0;
unsigned long lastDegTime    = 0;
unsigned long lastGraphLog   = 0;
unsigned long lastDemoUpdate = 0;
#define DEBOUNCE_MS      200
#define SENSOR_INTERVAL 2000
#define DEMO_UPDATE_MS   300

// ML — non-blocking serial buffer
#define ML_CONFIDENCE  50.0
#define ML_DISPLAY_MS  3000
#define ML_BUF_SIZE    64
#define ML_TIMEOUT_MS  50
bool   mlDetected  = false;
char   mlLabel[20] = "";
float  mlConf      = 0.0;
unsigned long mlTime = 0;
char   mlBuf[ML_BUF_SIZE];
int    mlBufIdx    = 0;
unsigned long mlLastChar = 0;

// Sell tracking
struct SellRecord {
  int   atFull, at15, at35, at60, at85;
  float totalRevenue;
};
SellRecord sellRecord     = {0, 0, 0, 0, 0, 0.0};
int        totalUnitsSold = 0;

// SD card
int  lastSummaryDay    = -1;
bool sdOk              = false;
char logFilename[20]   = "/PPSC_LOG.csv";
char summaryFilename[] = "/PPSC_SUMM.csv";
unsigned long totalLogs = 0;
bool stateRestored = false;  // v25: set by loadLastState() to skip fresh-start resets

// v25 UI: OLED burn-in protection. SH1106 panels burn in during 24/7 cart
// deployment (static border + labels). Dim contrast after idle, restore on
// any button. Set OLED_DIM_IDLE_MS to 0 to disable (e.g. if the price must
// stay full-bright for customers at all times).
unsigned long lastButtonActivity = 0;
bool oledDimmed = false;
#define OLED_DIM_IDLE_MS   600000UL  // 10 min no button → dim
#define OLED_DIM_LEVEL     40        // contrast 0–255 when dimmed (still readable)
#define OLED_FULL_LEVEL    255

// Produce history
#define PROD_HIST_MAX 5
struct ProdHistEntry {
  char  name[12];
  float finalFreshness;
  bool  valid;
};
ProdHistEntry prodHist[PROD_HIST_MAX];
int prodHistNext  = 0;
int prodHistCount = 0;

// Temp spike
float prevTemp              = 25.0;
bool  tempSpikeActive       = false;
unsigned long tempSpikeTime = 0;
bool  tempSpikeWarned       = false;
#define TEMP_SPIKE_THRESH   3.0f
#define TEMP_SPIKE_SHOW_MS  6000

// Stock
int stockQty = 10;
#define STOCK_MIN  1
#define STOCK_MAX 99

// Screen state machine
enum Screen {
  SCR_HOME, SCR_PRODUCE_LIST, SCR_PRODUCE_DETAIL,
  SCR_STATUS, SCR_PRICE, SCR_ARRHENIUS,
  SCR_TEMP_GRAPH, SCR_FRESH_GRAPH, SCR_SELL_LOG,
  SCR_PROD_HISTORY, SCR_DAY_REPORT, SCR_RESET_CONFIRM,
  SCR_DEMO, SCR_PHYSICS_MODE
};
Screen currentScreen = SCR_HOME;
int menuCursor = 0, menuScroll = 0;
int detailCursor = 0, detailScroll = 0;
int physicsCursor = 0;

// ═══════════════════════════════════════════════════════
//  MQ-135 READ
// ═══════════════════════════════════════════════════════
float readMQ135ppm() {
  long sum = 0;
  for (int i = 0; i < MQ135_SAMPLES; i++) {
    sum += analogRead(MQ135_PIN);
    delay(2);
  }
  mq135RawLast = (int)(sum / MQ135_SAMPLES);
  float adj = (float)max(0, mq135RawLast - MQ135_OFFSET);
  return constrain(adj * 500.0f / (4095.0f - MQ135_OFFSET), 0.0f, 500.0f);
}

// ═══════════════════════════════════════════════════════
//  BATTERY MONITORING — v21 (only when USE_BATTERY=true)
//  v24 FIX [B]: WiFi ADC debounce — rolling average + dwell timer
// ═══════════════════════════════════════════════════════
#if USE_BATTERY

// v24: Rolling buffer for ADC debounce
// ESP32 WiFi TX draws 300–400mA causing GPIO35 voltage sag
// → false Mode C transitions → oscillation loop
#define BATT_ROLLING_N     8     // 8-sample rolling mean
static float battRollingBuf[BATT_ROLLING_N];
static int   battRollingIdx  = 0;
static bool  battRollingFull = false;
static float battRollingSum  = 0.0f;
#define BATT_OUTLIER_RATIO 0.15f  // reject if >15% below rolling mean
#define BATT_DWELL_MS      5000   // min 5s between mode transitions
static unsigned long lastModeTransitionMs = 0;

float readBatteryMV() {
  long sum = 0;
  for (int i = 0; i < BATT_ADC_SAMPLES; i++) {
    sum += analogRead(BATT_ADC_PIN);
    delayMicroseconds(100);
  }
  float rawMV = ((float)sum / BATT_ADC_SAMPLES) * BATT_MV_PER_ADC;

  // v24: outlier rejection — discard WiFi TX sag readings
  if (battRollingFull) {
    float mean = battRollingSum / BATT_ROLLING_N;
    if (rawMV < mean * (1.0f - BATT_OUTLIER_RATIO)) {
      // Reading is suspiciously low — likely a WiFi TX sag spike
      // Return the rolling mean instead of the sag value
      Serial.printf("[BATT] Sag rejected: %.0fmV (mean=%.0fmV)\n", rawMV, mean);
      return mean;
    }
  }

  // Update rolling buffer
  battRollingSum -= battRollingBuf[battRollingIdx];
  battRollingBuf[battRollingIdx] = rawMV;
  battRollingSum += rawMV;
  battRollingIdx = (battRollingIdx + 1) % BATT_ROLLING_N;
  if (battRollingIdx == 0) battRollingFull = true;

  return rawMV;
}

float adcToBatteryPct(float mv) {
  // Piecewise linear: Li-ion discharge curve
  // 4200mV=100%, 3900mV=80%, 3700mV=50%, 3500mV=20%, 3000mV=0%
  if (mv >= 4200) return 100.0f;
  if (mv >= 3900) return 80.0f + (mv - 3900.0f) / 300.0f * 20.0f;
  if (mv >= 3700) return 50.0f + (mv - 3700.0f) / 200.0f * 30.0f;
  if (mv >= 3500) return 20.0f + (mv - 3500.0f) / 200.0f * 30.0f;
  if (mv >= 3000) return (mv - 3000.0f) / 500.0f * 20.0f;
  return 0.0f;
}

void evaluatePowerMode() {
  float mv = readBatteryMV();
  batteryPct = adcToBatteryPct(mv);

  PowerMode newMode = currentPowerMode;

  // With hysteresis
  switch (currentPowerMode) {
    case PWR_MODE_A:
      if (batteryPct < BATT_THRESH_AB - BATT_HYST)
        newMode = PWR_MODE_B;
      break;
    case PWR_MODE_B:
      if (batteryPct > BATT_THRESH_AB + BATT_HYST)
        newMode = PWR_MODE_A;
      else if (batteryPct < BATT_THRESH_BC - BATT_HYST)
        newMode = PWR_MODE_C;
      break;
    case PWR_MODE_C:
      if (batteryPct > BATT_THRESH_BC + BATT_HYST)
        newMode = PWR_MODE_B;
      break;
  }

  if (newMode != currentPowerMode) {
    transitionToMode(newMode);
  }
}

void transitionToMode(PowerMode newMode) {
  // v24 FIX [B]: enforce minimum dwell time between transitions
  // prevents A→B→C oscillation from WiFi TX voltage sags
  unsigned long now = millis();
  if (now - lastModeTransitionMs < BATT_DWELL_MS) {
    Serial.printf("[PWR] Transition blocked (dwell %lums < %dms)\n",
      now - lastModeTransitionMs, BATT_DWELL_MS);
    return;
  }
  lastModeTransitionMs = now;

  PowerMode oldMode = currentPowerMode;
  currentPowerMode = newMode;

  Serial.printf("[PWR] %c -> %c (batt=%.0f%%)\n",
    'A' + (int)oldMode, 'A' + (int)newMode, batteryPct);

  switch (newMode) {
    case PWR_MODE_A:
      // Full power: MQ-135 on, full expf computation
      digitalWrite(MQ135_PWR_PIN, HIGH);
      break;
    case PWR_MODE_B:
      // Medium: MQ-135 on, use 2D LUT instead of expf
      digitalWrite(MQ135_PWR_PIN, HIGH);
      precompute_lut2D(selectedProduce);
      break;
    case PWR_MODE_C:
      // Low power: MQ-135 off, 1D LUT, Ea=Ea_base only
      digitalWrite(MQ135_PWR_PIN, LOW);
      precompute_lut1D(selectedProduce);
      break;
  }
}
#endif  // USE_BATTERY

// ═══════════════════════════════════════════════════════
//  LUT PRECOMPUTATION — v22: eaMaxFrac removed
// ═══════════════════════════════════════════════════════
void precompute_lut2D(int idx) {
  const Produce& p = DB[idx];
  float Ea_J_base = p.Ea * 1000.0f;
  lut2D_Ea_min = p.eaMinFrac * Ea_J_base;
  // v22: Ea_max = Ea_base (eaMaxFrac removed — F ≤ 1.0 always)
  float Ea_max = Ea_J_base;
  lut2D_Ea_step = (Ea_max - lut2D_Ea_min) / (LUT2D_EA_STEPS - 1);
  lut2D_Ea_inv = (lut2D_Ea_step > 0) ? 1.0f / lut2D_Ea_step : 0.0f;
  lut2D_T_inv = 1.0f / lut2D_T_step;

  for (int ei = 0; ei < LUT2D_EA_STEPS; ei++) {
    float Ea_eff = lut2D_Ea_min + ei * lut2D_Ea_step;
    for (int ti = 0; ti < LUT2D_T_STEPS; ti++) {
      float T_C = lut2D_T_min + ti * lut2D_T_step;
      float T_K = T_C + 273.15f;
      lut2D[ei * LUT2D_T_STEPS + ti] = p.k0 * expf(-Ea_eff / (R_GAS * T_K));
    }
  }
  Serial.printf("[LUT2D] Precomputed for %s: Ea=[%.0f..%.0f]J\n",
    p.name, lut2D_Ea_min, Ea_max);
}

void precompute_lut1D(int idx) {
  const Produce& p = DB[idx];
  float Ea_J = p.Ea * 1000.0f;  // base Ea only
  for (int ti = 0; ti < LUT1D_T_STEPS; ti++) {
    float T_C = ti * 2.0f;  // 0, 2, 4, ... 60°C
    float T_K = T_C + 273.15f;
    lut1D[ti] = p.k0 * expf(-Ea_J / (R_GAS * T_K));
  }
  Serial.printf("[LUT1D] Precomputed for %s: Ea=%.0fJ\n", p.name, Ea_J);
}

float lookup_k_2D(float Ea_eff_J, float tempC) {
  // Bilinear interpolation in the 2D LUT
  float ei_f = (Ea_eff_J - lut2D_Ea_min) * lut2D_Ea_inv;
  float ti_f = (tempC - lut2D_T_min) * lut2D_T_inv;
  ei_f = fmaxf(0.0f, fminf(ei_f, (float)(LUT2D_EA_STEPS - 1)));
  ti_f = fmaxf(0.0f, fminf(ti_f, (float)(LUT2D_T_STEPS - 1)));
  int ei0 = (int)ei_f, ti0 = (int)ti_f;
  int ei1 = min(ei0 + 1, LUT2D_EA_STEPS - 1);
  int ti1 = min(ti0 + 1, LUT2D_T_STEPS - 1);
  float fe = ei_f - ei0, ft = ti_f - ti0;
  float v00 = lut2D[ei0 * LUT2D_T_STEPS + ti0];
  float v01 = lut2D[ei0 * LUT2D_T_STEPS + ti1];
  float v10 = lut2D[ei1 * LUT2D_T_STEPS + ti0];
  float v11 = lut2D[ei1 * LUT2D_T_STEPS + ti1];
  float v0 = v00 + ft * (v01 - v00);
  float v1 = v10 + ft * (v11 - v10);
  return v0 + fe * (v1 - v0);
}

float lookup_k_1D(float tempC) {
  float ti_f = tempC / 2.0f;
  ti_f = fmaxf(0.0f, fminf(ti_f, (float)(LUT1D_T_STEPS - 1)));
  int ti0 = (int)ti_f;
  int ti1 = min(ti0 + 1, LUT1D_T_STEPS - 1);
  float ft = ti_f - ti0;
  return lut1D[ti0] + ft * (lut1D[ti1] - lut1D[ti0]);
}

// ═══════════════════════════════════════════════════════
//  CORE PHYSICS — v22: Patent-Grade Corrected Model
//
//  CRITICAL FIX: G(VOC) and H(RH) REMOVED from Ea.
//  In v21, Ea_eff = Ea × G × H × F caused exponential
//  amplification (Fish: 5264× at 92% RH).
//
//  v22 model:
//  STEP 1: u_t = max(0, (T_K - thermalStressK)/10)
//          EMA = λ×EMA + (1-λ)×u_t
//          F = max(fMin, 1 - γ×EMA)
//  STEP 2: Ea_eff = Ea_base × F  (ONLY F acts on Ea)
//          Clamped to [eaMinFrac×Ea_base, Ea_base]
//  STEP 3: k_now = k0 × exp(-Ea_eff/(R×T_K))
//          base_rate = k_now / k_ref(25°C, Ea_base)
//  STEP 4: hum_mult = 1 + β_rate × max(0, (RH-rhRef)/sRh)
//  STEP 5: voc_mult = 1 + α_rate × max(0, tanh((VOC-vocRef)/sVoc))
//  STEP 6: degradationRate = base_rate × hum_mult × voc_mult
//  STEP 7: Leafy veg bidirectional humidity (desicc at RH<60%)
//  STEP 8: Accumulator update
// ═══════════════════════════════════════════════════════

// Reference k at 25°C with base Ea (for rate normalization)
float calcKBase25(int idx) {
  float T_K = 298.15f;
  float Ea_J = DB[idx].Ea * 1000.0f;
  return DB[idx].k0 * expf(-Ea_J / (R_GAS * T_K));
}

// ─── MODE A: Fixed Ea (simplified — no modifiers) ─────
void updateDegradationFixed(float dt) {
  const Produce& p = DB[selectedProduce];
  float T_K = currentTemp + 273.15f;
  float Ea_J = p.Ea * 1000.0f;

  float k_now = p.k0 * expf(-Ea_J / (R_GAS * T_K));
  float k_ref = calcKBase25(selectedProduce);
  degradationRate = k_now / k_ref;

  adp_Ea_eff  = p.Ea;
  adp_G_voc   = 1.0f;
  adp_H_rh    = 1.0f;
  adp_F_hist  = 1.0f;
  gasMultiplier = 1.0f;

  float spd = demoMode ? demoSpeeds[demoSpeedIdx] : 1.0f;
  cumulativeDeg += spd * degradationRate * dt
                 / (p.shelfLifeDays * 24.0f);
}

// ─── MODE B: Adaptive Ea — v22 corrected physics ──────
//  G(VOC) and H(RH) are POST-MULTIPLIERS on rate.
//  Only F(thermal history) modulates Ea.
//  Physical basis: enzyme conformational changes post heat-exposure
//  (Gram & Huss 1996; Peleg 2006; Zwietering 1991).
void updateDegradationAdaptive(float dt) {
  const Produce& p = DB[selectedProduce];

  // STEP 1: Thermal history EMA → F(hist) → modulates Ea
  //   u_t uses per-produce thermalStressK (not global 303.15)
  float T_K = currentTemp + 273.15f;
  float u_t = fmaxf(0.0f, (T_K - p.thermalStressK) / 10.0f);
  adp_thermalEMA = p.lambda * adp_thermalEMA
                 + (1.0f - p.lambda) * u_t;
  adp_F_hist = fmaxf(p.fMin, 1.0f - p.gamma_ * adp_thermalEMA);

  // STEP 2: Ea_eff = Ea_base × F (ONLY F acts on Ea)
  float Ea_J = p.Ea * 1000.0f;
  float Ea_eff = Ea_J * adp_F_hist;
  float Ea_min = p.eaMinFrac * Ea_J;
  Ea_eff = fmaxf(Ea_min, fminf(Ea_J, Ea_eff));  // clamp [eaMinFrac*Ea, Ea]
  adp_Ea_eff = Ea_eff / 1000.0f;  // store as kJ for display

  // STEP 3: Compute Arrhenius rate (mode-aware)
  float k_now;
  switch (currentPowerMode) {
    case PWR_MODE_B:
      k_now = lookup_k_2D(Ea_eff, currentTemp);
      break;
    case PWR_MODE_C:
      // Mode C: Ea = Ea_base only (F=1, no VOC/hum)
      k_now = lookup_k_1D(currentTemp);
      adp_Ea_eff = p.Ea;  // override display
      break;
    default: // PWR_MODE_A
      k_now = p.k0 * expf(-Ea_eff / (R_GAS * T_K));
      break;
  }
  float k_ref = calcKBase25(selectedProduce);
  float baseRate = k_now / k_ref;

  // STEP 4: H(RH) — humidity POST-MULTIPLIER on rate
  //   Physical: water activity for microbial growth (pre-exponential)
  //   hum_mult = 1 + beta_rate × max(0, (RH - rhRef) / sRh)
  //   Capped at 1 + beta_rate
  float rh_excess = fmaxf(0.0f, (currentHumidity - p.rhRef) / p.sRh);
  adp_H_rh = 1.0f + p.beta_rate * rh_excess;
  adp_H_rh = fminf(adp_H_rh, 1.0f + p.beta_rate);  // cap

  // STEP 5: G(VOC) — VOC POST-MULTIPLIER on rate
  //   Physical: VOC = biological state indicator, not Ea modifier
  //   voc_mult = 1 + alpha_rate × max(0, tanh((VOC - vocRef) / sVoc))
  //   Capped at 1 + alpha_rate
  adp_G_voc = 1.0f;
  if (mq135Ready && currentPowerMode != PWR_MODE_C) {
    float voc_sigmoid = tanhf((currentVOC - p.vocRef) / p.sVoc);
    adp_G_voc = 1.0f + p.alpha_rate * fmaxf(0.0f, voc_sigmoid);
    adp_G_voc = fminf(adp_G_voc, 1.0f + p.alpha_rate);  // cap
  }

  // STEP 6: Combined rate
  degradationRate = baseRate * adp_H_rh * adp_G_voc;
  gasMultiplier = adp_G_voc;  // for display compatibility

  // STEP 7: Leafy veg bidirectional humidity (desiccation at RH<60%)
  //   Physical: stomatal water loss at low RH accelerates wilting
  if (selectedProduce == 3 && currentHumidity < 60.0f) {
    float desicc = 1.0f + 0.30f * (60.0f - currentHumidity) / 20.0f;
    if (desicc > adp_H_rh) {
      adp_H_rh = desicc;
      degradationRate = baseRate * adp_H_rh * adp_G_voc;
    }
  }

  // STEP 8: Update degradation accumulator
  float spd = demoMode ? demoSpeeds[demoSpeedIdx] : 1.0f;
  cumulativeDeg += spd * degradationRate * dt
                 / (p.shelfLifeDays * 24.0f);

  Serial.printf("[ADAP] EMA=%.3f Vm=%.3f Hm=%.3f F=%.3f "
                "Ea=%.1f/%.0f Rt=%.3f PM=%c\n",
    adp_thermalEMA, adp_G_voc, adp_H_rh, adp_F_hist,
    adp_Ea_eff, p.Ea, degradationRate,
    'A' + (int)currentPowerMode);
}

// ═══════════════════════════════════════════════════════
//  DEGRADATION DISPATCHER
// ═══════════════════════════════════════════════════════
void updateDegradation() {
  if (isExpired) return;

  // v25 OPUS-IDENTIFIED: guard the Arrhenius formula against NaN / out-of-range
  // sensor values. A single NaN propagating into expf() poisons cumulativeDeg
  // permanently (NaN + anything = NaN), causing freshness to read "nan%" forever.
  // DHT22 can return NaN on CRC error; MQ-135 ADC can glitch. Skip this cycle if so.
  if (isnan(currentTemp) || currentTemp < -40.0f || currentTemp > 125.0f) {
    Serial.printf("[PHYS] Skipped: bad temp %.1f\n", currentTemp);
    lastDegTime = millis();  // reset dt so next cycle doesn't double-count
    return;
  }
  if (isnan(currentHumidity) || currentHumidity < 0.0f || currentHumidity > 100.0f) {
    currentHumidity = DB[selectedProduce].rhRef;  // neutral fallback (H→1.0)
  }
  if (isnan(currentVOC) || currentVOC < 0.0f) {
    currentVOC = DB[selectedProduce].vocRef;      // neutral fallback (G→1.0)
  }

  unsigned long now = millis();
  float dt = (now - lastDegTime) / 1000.0f / 3600.0f;
  // v24 FIX [C]: cap dt at 60s — prevents millis() rollover (~49.7d)
  // causing massive cumulativeDeg spike and instant false expiry
  dt = fminf(dt, 60.0f / 3600.0f);
  lastDegTime = now;

  cumulativeDeg = constrain(cumulativeDeg, 0.0f, 1.0f);

  if (useAdaptiveEa)
    updateDegradationAdaptive(dt);
  else
    updateDegradationFixed(dt);

  cumulativeDeg      = constrain(cumulativeDeg, 0.0f, 1.0f);
  currentFreshness   = (1.0f - cumulativeDeg) * 100.0f;
  shelfLifeRemaining = (1.0f - cumulativeDeg)
                     * DB[selectedProduce].shelfLifeDays * 24.0f;

  if (currentFreshness <= 0.0f) {
    currentFreshness = 0.0f;
    isExpired        = true;
    currentPrice     = 0.0f;
    Serial.println("[!] EXPIRED");
    writeDailySummary();
    saveLastState();   // v25: persist expiry — must survive power cycle
    return;
  }

  // 5-tier pricing (unchanged)
  float f = currentFreshness;
  if      (f > 80) currentPrice = DB[selectedProduce].basePrice;
  else if (f > 60) currentPrice = DB[selectedProduce].basePrice * 0.85f;
  else if (f > 40) currentPrice = DB[selectedProduce].basePrice * 0.65f;
  else if (f > 20) currentPrice = DB[selectedProduce].basePrice * 0.40f;
  else             currentPrice = DB[selectedProduce].basePrice * 0.15f;
}

// ═══════════════════════════════════════════════════════
//  BUZZER
// ═══════════════════════════════════════════════════════
void buzzerBeep(int freq = BUZZER_FREQ) {
  ledcAttach(BUZZER_PIN, freq, BUZZER_RES);
  ledcWrite(BUZZER_PIN, 128);
}
void buzzerStop() {
  ledcWrite(BUZZER_PIN, 0);
  ledcDetach(BUZZER_PIN);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}
void confirmBeep() {
  ledcAttach(BUZZER_PIN, 1500, BUZZER_RES);
  ledcWrite(BUZZER_PIN, 128); delay(100);
  ledcWrite(BUZZER_PIN, 0);   delay(80);
  ledcAttach(BUZZER_PIN, 2000, BUZZER_RES);
  ledcWrite(BUZZER_PIN, 128); delay(100);
  buzzerStop();
}
void spikeBeep() {
  for (int i = 0; i < 3; i++) {
    ledcAttach(BUZZER_PIN, 1600, BUZZER_RES);
    ledcWrite(BUZZER_PIN, 128); delay(70);
    ledcWrite(BUZZER_PIN, 0);   delay(70);
  }
  ledcDetach(BUZZER_PIN);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}
void handleBuzzer() {
  unsigned long now = millis();
  if (isExpired) {
    if (!buzzerOn && now - lastBuzzTime >= BUZZ_EXP_OFF_MS) {
      buzzerBeep(1200); buzzerOn = true; lastBuzzTime = now;
    } else if (buzzerOn && now - lastBuzzTime >= BUZZ_EXP_ON_MS) {
      buzzerStop(); buzzerOn = false; lastBuzzTime = now;
    }
    return;
  }
  if (currentFreshness >= 15.0) {
    if (buzzerOn) { buzzerStop(); buzzerOn = false; }
    return;
  }
  if (!buzzerOn && now - lastBuzzTime >= BUZZ_OFF_MS) {
    buzzerBeep(); buzzerOn = true; lastBuzzTime = now;
  } else if (buzzerOn && now - lastBuzzTime >= BUZZ_ON_MS) {
    buzzerStop(); buzzerOn = false; lastBuzzTime = now;
  }
}

// ═══════════════════════════════════════════════════════
//  RGB LED
// ═══════════════════════════════════════════════════════
void updateLEDs() {
  unsigned long now = millis();

  if (isExpired) {
    if (now - lastLEDBlink >= LED_BLINK_MS) {
      lastLEDBlink  = now;
      ledBlinkState = !ledBlinkState;
    }
    rgbWrite(RGB_R, true);
    rgbWrite(RGB_G, ledBlinkState ? false : true);
    rgbWrite(RGB_B, false);
    return;
  }

  if (currentFreshness > 60) {
    rgbWrite(RGB_R, false); rgbWrite(RGB_G, true);  rgbWrite(RGB_B, false);
  } else if (currentFreshness > 30) {
    rgbWrite(RGB_R, true);  rgbWrite(RGB_G, true);  rgbWrite(RGB_B, false);
  } else {
    rgbWrite(RGB_R, true);  rgbWrite(RGB_G, false); rgbWrite(RGB_B, false);
  }
}

// ═══════════════════════════════════════════════════════
//  DRAW HELPERS
// ═══════════════════════════════════════════════════════
void drawBorder() {
  display.drawRect(0, 0, 128, 64, SH110X_WHITE);
}

void drawTitleBar(const char* left, const char* right = nullptr) {
  display.fillRect(0, 0, 128, 12, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setTextSize(1);
  display.setCursor(2, 2);
  display.print(left);
  if (right) {
    display.setCursor(126 - strlen(right) * 6, 2);
    display.print(right);
  }
  display.setTextColor(SH110X_WHITE);
}

void drawHLine(int y) {
  display.drawLine(1, y, 126, y, SH110X_WHITE);
}

void getElapsedStr(char* buf, int len) {
  unsigned long e = (millis() - produceSetTime) / 1000;
  unsigned long h = e / 3600, m = (e % 3600) / 60, s = e % 60;
  if (h > 0) snprintf(buf, len, "%luh%02lum", h, m);
  else        snprintf(buf, len, "%lum%02lus", m, s);
}

const char* tier(float f) {
  if (isExpired) return "EXPD";
  if (f > 80) return "FULL";
  if (f > 60) return "-15%";
  if (f > 40) return "-35%";
  if (f > 20) return "-60%";
  return "-85%";
}

const char* freshLabel(float f) {
  if (isExpired) return "EXPIRED";
  if (f > 60) return "FRESH";
  if (f > 30) return "MOD";
  if (f > 15) return "LOW";
  return "CRIT";
}

bool btnPressed(int pin) {
  if (digitalRead(pin) == LOW && millis() - lastBtnTime > DEBOUNCE_MS) {
    lastBtnTime = millis();
    return true;
  }
  return false;
}

const char* modeShortLabel() {
  return useAdaptiveEa ? "ADP" : "FIX";
}

const char* powerModeLabel() {
  switch (currentPowerMode) {
    case PWR_MODE_A: return "A";
    case PWR_MODE_B: return "B";
    case PWR_MODE_C: return "C";
  }
  return "?";
}

// v25 UI: freshness trend glyph — shows how FAST freshness is dropping,
// from the live degradation rate. Drawn at (x,y), ~7px square.
//   ▸ slow/stable (rate<1.25)   ▾ dropping (1.25–3)   ▼▼ fast (>3)
void drawTrendGlyph(int x, int y) {
  float r = degradationRate;
  if (r < 1.25f) {
    display.fillTriangle(x, y, x, y + 6, x + 5, y + 3, SH110X_WHITE); // right
  } else if (r < 3.0f) {
    display.fillTriangle(x, y, x + 6, y, x + 3, y + 5, SH110X_WHITE); // down
  } else {
    display.fillTriangle(x, y,     x + 6, y,     x + 3, y + 3, SH110X_WHITE);
    display.fillTriangle(x, y + 3, x + 6, y + 3, x + 3, y + 6, SH110X_WHITE); // double
  }
}

// v25 UI: burn-in protection — dim after idle, wake on activity.
void updateOledDim() {
  #if OLED_DIM_IDLE_MS > 0
  if (!oledDimmed && millis() - lastButtonActivity > OLED_DIM_IDLE_MS) {
    display.setContrast(OLED_DIM_LEVEL);
    oledDimmed = true;
  }
  #endif
}
void wakeOled() {
  if (oledDimmed) {
    display.setContrast(OLED_FULL_LEVEL);
    oledDimmed = false;
  }
  lastButtonActivity = millis();
}

void drawMLNotification() {
  if (!mlDetected) return;
  if (millis() - mlTime > ML_DISPLAY_MS) { mlDetected = false; return; }
  display.fillRect(0, 44, 128, 20, SH110X_BLACK);
  display.drawRect(0, 44, 128, 20, SH110X_WHITE);
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(3, 47);
  display.print("ML: ");
  display.print(mlLabel);
  display.setCursor(3, 56);
  display.print("Conf:");
  display.print(mlConf, 0);
  display.print("% Auto-sel!");
}

// ═══════════════════════════════════════════════════════
//  SELL COUNTER
// ═══════════════════════════════════════════════════════
void recordSell() {
  if (isExpired) return;
  totalUnitsSold++;
  sellRecord.totalRevenue += currentPrice;
  float f = currentFreshness;
  if      (f > 80) sellRecord.atFull++;
  else if (f > 60) sellRecord.at15++;
  else if (f > 40) sellRecord.at35++;
  else if (f > 20) sellRecord.at60++;
  else             sellRecord.at85++;
  if (stockQty > 0) stockQty--;
  ledcAttach(BUZZER_PIN, 1800, BUZZER_RES);
  ledcWrite(BUZZER_PIN, 80); delay(60);
  ledcWrite(BUZZER_PIN, 0);
  ledcDetach(BUZZER_PIN);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}

// ═══════════════════════════════════════════════════════
//  FRESHNESS PREDICTION
// ═══════════════════════════════════════════════════════
float minutesUntilNextTier() {
  if (isExpired || currentFreshness <= 0) return 0;
  float nt;
  if      (currentFreshness > 80) nt = 80.0;
  else if (currentFreshness > 60) nt = 60.0;
  else if (currentFreshness > 40) nt = 40.0;
  else if (currentFreshness > 20) nt = 20.0;
  else if (currentFreshness > 15) nt = 15.0;
  else                             nt = 0.0;
  float degNeeded = (1.0-nt/100.0) - (1.0-currentFreshness/100.0);
  if (degNeeded <= 0) return 0;
  float spd = demoMode ? demoSpeeds[demoSpeedIdx] : 1.0;
  float degPerHour = spd * degradationRate
                   / (DB[selectedProduce].shelfLifeDays * 24.0);
  if (degPerHour <= 0) return 9999;
  return (degNeeded / degPerHour) * 60.0;
}

const char* nextTierLabel() {
  if      (currentFreshness > 80) return "-15%";
  else if (currentFreshness > 60) return "-35%";
  else if (currentFreshness > 40) return "-60%";
  else if (currentFreshness > 20) return "-85%";
  else                             return "EXPD";
}

// hoursUntilFreshness() removed in v24 — was declared but never called (dead code)

// ═══════════════════════════════════════════════════════
//  SAFE RTC READ — v24: prevents garbage dates on SD card
//  DS1307 with dead CR2032 can return garbage mid-session.
//  This validates every rtc.now() call before use.
//  If invalid: force-reset to compile time and retry once.
//  If still invalid: return a safe fallback (2024-01-01).
// ═══════════════════════════════════════════════════════
DateTime safeRTCNow() {
  DateTime now = rtc.now();
  if (now.year() >= 2024 && now.year() <= 2030 &&
      now.month() >= 1 && now.month() <= 12 &&
      now.day() >= 1 && now.day() <= 31) {
    return now;  // valid
  }
  // Garbage detected mid-session — attempt reset
  Serial.printf("[RTC] Garbage mid-session: %04d-%02d-%02d — resetting\n",
    now.year(), now.month(), now.day());
  rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  now = rtc.now();
  if (now.year() >= 2024 && now.year() <= 2030) {
    return now;  // recovered
  }
  // RTC unrecoverable — return safe fallback to avoid FAT32 corruption
  Serial.println("[RTC] Unrecoverable — using fallback date");
  return DateTime(2024, 1, 1, 0, 0, 0);
}

// ═══════════════════════════════════════════════════════
//  SD LOGGING
// ═══════════════════════════════════════════════════════
void writeDailySummary() {
  if (!sdOk) return;
  DateTime now = safeRTCNow();
  File f = SD.open(summaryFilename, FILE_APPEND);
  if (!f) return;
  if (f.size() == 0)
    f.println("Date,Produce,UnitsSold,Revenue,Full,-15,-35,-60,-85");
  char d[12];
  snprintf(d, sizeof(d), "%04d-%02d-%02d", now.year(), now.month(), now.day());
  f.printf("%s,%s,%d,%.1f,%d,%d,%d,%d,%d\n", d,
    DB[selectedProduce].name, totalUnitsSold, sellRecord.totalRevenue,
    sellRecord.atFull, sellRecord.at15, sellRecord.at35,
    sellRecord.at60, sellRecord.at85);
  f.close();
}

void checkDailySummary() {
  if (!sdOk) return;
  DateTime now = safeRTCNow();
  if (now.day() != lastSummaryDay && now.hour()==0 && now.minute()==0) {
    writeDailySummary();
    lastSummaryDay = now.day();
    sellRecord = {0,0,0,0,0, 0.0};
    totalUnitsSold = 0;
  }
}

void createLogFile() {
  if (!sdOk) return;
  for (int i = 1; i <= 999; i++) {
    snprintf(logFilename, sizeof(logFilename), "/PPSC_%03d.csv", i);
    if (!SD.exists(logFilename)) break;
  }
  File f = SD.open(logFilename, FILE_WRITE);
  if (f) {
    f.println("Date,Time,Produce,Mode,PwrMode,Temp,Hum,VOC,"
              "EaEff,G,H,F,EMA,Rate,Fresh,Price,Status,Src,Batt");
    f.close();
    Serial.printf("[SD] Created: %s\n", logFilename);
  } else {
    Serial.printf("[SD] FAILED to create: %s\n", logFilename);
    sdOk = false;  // prevent logToSD from trying repeatedly
  }
}

void logToSD() {
  if (!sdOk) return;
  File f = SD.open(logFilename, FILE_APPEND);
  if (!f) {
    Serial.printf("[SD] Failed to open %s for append\n", logFilename);
    return;
  }
  DateTime now = safeRTCNow();
  f.printf("%04d-%02d-%02d,%02d:%02d:%02d,%s,%s,%c,%.1f,%.1f,%.1f,"
           "%.2f,%.3f,%.3f,%.3f,%.3f,%.3f,%.1f,%.1f,%s,%s,%.0f\n",
    now.year(), now.month(), now.day(),
    now.hour(), now.minute(), now.second(),
    DB[selectedProduce].name,
    useAdaptiveEa ? "ADP" : "FIX",
    'A' + (int)currentPowerMode,
    currentTemp, currentHumidity, currentVOC,
    adp_Ea_eff, adp_G_voc, adp_H_rh, adp_F_hist,
    adp_thermalEMA, degradationRate,
    currentFreshness, currentPrice,
    isExpired ? "EXPIRED" : freshLabel(currentFreshness),
    mlDetected ? "ML" : "Man",
    batteryPct);
  f.close();
  totalLogs++;
  if (totalLogs % 30 == 1) {  // every ~60s (30 × 2s interval)
    Serial.printf("[SD] %lu entries written to %s\n", totalLogs, logFilename);
  }
}

// ═══════════════════════════════════════════════════════
//  PERSISTENT STATE — v25: resume freshness after power cycle
//  Without this, every power blip resets freshness to 100%,
//  which is dangerous for a food-safety device: a vendor's
//  half-spoiled stock would falsely read as fresh after a
//  battery swap or brownout.
//
//  Format: produce,cumulativeDeg,EMA,adaptive,expired,checksum
//  A checksum (sum of fields × 1000) detects corruption from
//  power loss during the write (partial/torn file).
// ═══════════════════════════════════════════════════════
void saveLastState() {
  if (!sdOk) return;
  // Compute simple integrity checksum
  long chk = selectedProduce
           + (long)(cumulativeDeg * 100000.0f)
           + (long)(adp_thermalEMA * 100000.0f)
           + (useAdaptiveEa ? 7 : 0)
           + (isExpired ? 13 : 0);
  File f = SD.open(STATE_FILE, FILE_WRITE);  // FILE_WRITE truncates → atomic-ish
  if (!f) return;
  f.printf("%d,%.6f,%.6f,%d,%d,%ld\n",
    selectedProduce, cumulativeDeg, adp_thermalEMA,
    useAdaptiveEa ? 1 : 0, isExpired ? 1 : 0, chk);
  f.close();
}

void loadLastState() {
  if (!sdOk) return;
  if (!SD.exists(STATE_FILE)) {
    Serial.println("[STATE] No saved state — fresh start");
    return;
  }
  File f = SD.open(STATE_FILE, FILE_READ);
  if (!f) return;
  String line = f.readStringUntil('\n');
  f.close();

  // Parse CSV: produce,cumulativeDeg,EMA,adaptive,expired,checksum
  int p; float cd, ema; int adp, exp; long chk;
  int n = sscanf(line.c_str(), "%d,%f,%f,%d,%d,%ld",
                 &p, &cd, &ema, &adp, &exp, &chk);
  if (n != 6) {
    Serial.println("[STATE] Corrupt (parse fail) — ignoring");
    return;
  }

  // Verify checksum
  long expectChk = p + (long)(cd * 100000.0f) + (long)(ema * 100000.0f)
                 + (adp ? 7 : 0) + (exp ? 13 : 0);
  if (chk != expectChk) {
    Serial.printf("[STATE] Checksum mismatch (got %ld, want %ld) — ignoring\n",
      chk, expectChk);
    return;
  }
  // Range-validate before applying (defense against valid-checksum garbage)
  if (p < 0 || p >= PRODUCE_COUNT || cd < 0.0f || cd > 1.0f ||
      ema < 0.0f || ema > 10.0f) {
    Serial.println("[STATE] Values out of range — ignoring");
    return;
  }

  // Apply restored state
  selectedProduce  = p;
  cumulativeDeg    = cd;
  adp_thermalEMA   = ema;
  useAdaptiveEa    = (adp == 1);
  isExpired        = (exp == 1);
  currentFreshness = (1.0f - cumulativeDeg) * 100.0f;
  shelfLifeRemaining = (1.0f - cumulativeDeg) * DB[p].shelfLifeDays * 24.0f;
  currentPrice     = isExpired ? 0.0f : DB[p].basePrice;
  stateRestored    = true;  // v25: signal setup() to skip fresh-start resets

  Serial.printf("[STATE] Resumed: %s fresh=%.1f%% EMA=%.3f %s%s\n",
    DB[p].name, currentFreshness, adp_thermalEMA,
    useAdaptiveEa ? "ADP" : "FIX", isExpired ? " EXPIRED" : "");
}

// ═══════════════════════════════════════════════════════
//  PRODUCE HISTORY
// ═══════════════════════════════════════════════════════
void saveProdHistory() {
  strncpy(prodHist[prodHistNext].name, DB[selectedProduce].name, 11);
  prodHist[prodHistNext].name[11] = '\0';
  prodHist[prodHistNext].finalFreshness = currentFreshness;
  prodHist[prodHistNext].valid = true;
  prodHistNext = (prodHistNext + 1) % PROD_HIST_MAX;
  if (prodHistCount < PROD_HIST_MAX) prodHistCount++;
}

// ═══════════════════════════════════════════════════════
//  RESET — v21: EMA reset to 0, LUT recomputation
// ═══════════════════════════════════════════════════════
void resetProduce() {
  saveProdHistory();
  cumulativeDeg = 0.0;
  currentFreshness = 100.0;
  isExpired = false;
  tempSpikeActive = false;
  tempSpikeWarned = false;
  gasMultiplier = 1.0;

  // v21: Reset thermal EMA to 0 (new formula)
  adp_thermalEMA = 0.0f;
  adp_Ea_eff = DB[selectedProduce].Ea;
  adp_G_voc = adp_H_rh = adp_F_hist = 1.0f;

  // v21: Recompute LUTs for new produce
  if (currentPowerMode == PWR_MODE_B)
    precompute_lut2D(selectedProduce);
  else if (currentPowerMode == PWR_MODE_C)
    precompute_lut1D(selectedProduce);

  if (buzzerOn) { buzzerStop(); buzzerOn = false; }
  lastDegTime = produceSetTime = lastGraphLog = millis();
  historyIdx = historyCount = 0;
  for (int i = 0; i < GRAPH_POINTS; i++) {
    tempHistory[i] = currentTemp;
    freshHistory[i] = 100.0;
  }
  confirmBeep();
  saveLastState();  // v25: persist reset so it survives power cycle
}

// ═══════════════════════════════════════════════════════
//  SENSOR READ
// ═══════════════════════════════════════════════════════
void readSensors() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) {
    float rise = t - prevTemp;
    if (rise >= TEMP_SPIKE_THRESH && !isExpired) {
      tempSpikeActive = true;
      tempSpikeTime = millis();
      if (!tempSpikeWarned) {
        tempSpikeWarned = true;
        spikeBeep();
        Serial.printf("[SPIKE] +%.1fC\n", rise);
      }
    } else { tempSpikeWarned = false; }
    prevTemp = t;
    currentTemp = t;
  }
  if (!isnan(h)) currentHumidity = h;
  if (tempSpikeActive && millis()-tempSpikeTime > TEMP_SPIKE_SHOW_MS)
    tempSpikeActive = false;

  // MQ-135: only read if powered (Mode A or B)
  if (currentPowerMode != PWR_MODE_C) {
    mq135Ready = (millis() > MQ135_WARMUP_MS);
    currentVOC = readMQ135ppm();
  } else {
    mq135Ready = false;
    currentVOC = 0.0f;
  }

  Serial.printf("[SENS] T=%.1f H=%.0f VOC=%.0f raw=%d %s PM=%c Rt=%.3f\n",
    currentTemp, currentHumidity, currentVOC, mq135RawLast,
    useAdaptiveEa ? "ADP" : "FIX",
    'A' + (int)currentPowerMode, degradationRate);
}

void logGraphPoint() {
  tempHistory[historyIdx] = currentTemp;
  freshHistory[historyIdx] = currentFreshness;
  historyIdx = (historyIdx + 1) % GRAPH_POINTS;
  if (historyCount < GRAPH_POINTS) historyCount++;
}

// ═══════════════════════════════════════════════════════
//  ML SERIAL — NON-BLOCKING
// ═══════════════════════════════════════════════════════
void processMLCommand(const char* cmd) {
  String s = String(cmd); s.trim();
  if (s.length() == 0) return;

  // v24: PING/PONG for connection testing from Python script
  if (s == "PING") {
    Serial.println("[ML-PONG] PPSC v24 ready");
    return;
  }

  String name = s;
  float conf = 100.0;
  int ci = s.indexOf(',');
  if (ci > 0) {
    name = s.substring(0, ci);
    conf = s.substring(ci + 1).toFloat();
  }
  name.trim();

  // v24: Log what we received for debugging
  Serial.printf("[ML-RX] raw='%s' name='%s' conf=%.1f\n",
    cmd, name.c_str(), conf);

  if (ci > 0 && conf < ML_CONFIDENCE) {
    Serial.printf("[ML-LOW] %s (%.1f%% < %.0f%% threshold)\n",
      name.c_str(), conf, ML_CONFIDENCE);
    return;
  }
  for (int i = 0; i < PRODUCE_COUNT; i++) {
    String dbUp = String(DB[i].name); dbUp.toUpperCase(); dbUp.replace("_"," ");
    String nUp  = name;               nUp.toUpperCase();  nUp.replace("_"," ");
    if (nUp == dbUp || dbUp.indexOf(nUp)>=0 || nUp.indexOf(dbUp)>=0) {
      // v24 BUG FIX: save history for OLD produce BEFORE switching selectedProduce.
      // Previously: selectedProduce=i then resetProduce()→saveProdHistory() saved NEW name.
      // Now: save old produce history first, then switch, then reset without re-saving.
      int oldProduce = selectedProduce;
      if (oldProduce != i) {
        strncpy(prodHist[prodHistNext].name, DB[oldProduce].name, 11);
        prodHist[prodHistNext].name[11] = '\0';
        prodHist[prodHistNext].finalFreshness = currentFreshness;
        prodHist[prodHistNext].valid = true;
        prodHistNext = (prodHistNext + 1) % PROD_HIST_MAX;
        if (prodHistCount < PROD_HIST_MAX) prodHistCount++;
        Serial.printf("[ML] History saved: %s @ %.1f%%\n",
          DB[oldProduce].name, currentFreshness);
      }
      selectedProduce = i;
      mlDetected = true; mlConf = conf; mlTime = millis();
      strncpy(mlLabel, DB[i].name, sizeof(mlLabel)-1);
      // Reset state directly — do NOT call resetProduce() as it calls saveProdHistory() again
      cumulativeDeg = 0.0;
      currentFreshness = 100.0;
      currentPrice = DB[selectedProduce].basePrice;
      shelfLifeRemaining = DB[selectedProduce].shelfLifeDays * 24.0f;
      isExpired = false;
      tempSpikeActive = false;
      tempSpikeWarned = false;
      gasMultiplier = 1.0;
      adp_thermalEMA = 0.0f;
      adp_Ea_eff = DB[selectedProduce].Ea;
      adp_G_voc = adp_H_rh = adp_F_hist = 1.0f;
      if (currentPowerMode == PWR_MODE_B)
        precompute_lut2D(selectedProduce);
      else if (currentPowerMode == PWR_MODE_C)
        precompute_lut1D(selectedProduce);
      if (buzzerOn) { buzzerStop(); buzzerOn = false; }
      lastDegTime = produceSetTime = lastGraphLog = millis();
      historyIdx = historyCount = 0;
      for (int g = 0; g < GRAPH_POINTS; g++) {
        tempHistory[g] = currentTemp;
        freshHistory[g] = 100.0;
      }
      confirmBeep();
      currentScreen = SCR_HOME;
      Serial.printf("[ML-OK] %s (%.1f%%)\n", DB[i].name, conf);
      saveLastState();  // v25: persist ML switch immediately (resume accuracy)
      return;
    }
  }
  Serial.printf("[ML-ERR] No match for '%s'. Valid: ", name.c_str());
  for (int i = 0; i < PRODUCE_COUNT; i++) {
    Serial.print(DB[i].name);
    if (i < PRODUCE_COUNT - 1) Serial.print(", ");
  }
  Serial.println();
}

void handleMLSerial() {
  unsigned long now = millis();
  while (Serial.available()) {
    char c = Serial.read();
    mlLastChar = now;
    if (c == '\n' || c == '\r') {
      if (mlBufIdx > 0) {
        mlBuf[mlBufIdx] = '\0';
        processMLCommand(mlBuf);
        mlBufIdx = 0;
      }
      return;
    }
    if (mlBufIdx < ML_BUF_SIZE - 1) {
      mlBuf[mlBufIdx++] = c;
    }
  }
  if (mlBufIdx > 0 && now - mlLastChar > ML_TIMEOUT_MS) {
    mlBuf[mlBufIdx] = '\0';
    processMLCommand(mlBuf);
    mlBufIdx = 0;
  }
}

// ═══════════════════════════════════════════════════════
//  WIFI — JSON API  — v21: added powerMode, batteryPct, thermalEMA
// ═══════════════════════════════════════════════════════
void handleAPIData() {
  char uptimeBuf[16];
  getElapsedStr(uptimeBuf, sizeof(uptimeBuf));
  float mins = minutesUntilNextTier();
  char predBuf[30] = "N/A";
  if (!isExpired && mins > 0 && mins < 9990) {
    if (mins < 60)
      snprintf(predBuf, sizeof(predBuf), "%dm to %s", (int)mins, nextTierLabel());
    else
      snprintf(predBuf, sizeof(predBuf), "%dh%dm to %s",
               (int)(mins/60), (int)fmod(mins,60), nextTierLabel());
  }
  char json[1400];
  snprintf(json, sizeof(json),
    "{\"produce\":\"%s\",\"physicsMode\":\"%s\","
    "\"physModel\":\"%s\","
    "\"powerMode\":\"%s\",\"batteryPct\":%.0f,"
    "\"freshness\":%.1f,\"temp\":%.1f,\"humidity\":%.1f,"
    "\"vocPPM\":%.1f,\"vocRaw\":%d,\"mqReady\":%s,"
    "\"gasMult\":%.3f,\"humMult\":%.3f,\"vocMult\":%.3f,"
    "\"eaEff\":%.2f,\"eaBase\":%.1f,"
    "\"eaEffKJ\":%.2f,\"eaBaseKJ\":%.1f,"
    "\"gVoc\":%.3f,\"hRh\":%.3f,\"fHist\":%.3f,"
    "\"thermalEMA\":%.3f,"
    "\"thermalStressK\":%.1f,"
    "\"price\":%.1f,\"basePrice\":%.0f,"
    "\"tier\":\"%s\",\"status\":\"%s\","
    "\"stock\":%d,\"sold\":%d,\"revenue\":%.0f,"
    "\"uptime\":\"%s\",\"prediction\":\"%s\","
    "\"rate\":%.3f,\"baseRate\":%.3f,"
    "\"hoursRemaining\":%.1f,"
    "\"atFull\":%d,\"at15\":%d,\"at35\":%d,"
    "\"at60\":%d,\"at85\":%d,"
    "\"expired\":%s,\"spike\":%s,"
    "\"spoilRisk\":%s,\"demo\":%s}",
    DB[selectedProduce].name,
    useAdaptiveEa ? "ADAPTIVE" : "FIXED",
    MODEL_VERSION,
    powerModeLabel(), batteryPct,
    currentFreshness, currentTemp, currentHumidity,
    currentVOC, mq135RawLast,
    mq135Ready ? "true" : "false",
    gasMultiplier, adp_H_rh, adp_G_voc,
    adp_Ea_eff, DB[selectedProduce].Ea,
    adp_Ea_eff, DB[selectedProduce].Ea,
    adp_G_voc, adp_H_rh, adp_F_hist,
    adp_thermalEMA,
    DB[selectedProduce].thermalStressK,
    currentPrice, DB[selectedProduce].basePrice,
    tier(currentFreshness),
    freshLabel(currentFreshness),
    stockQty, totalUnitsSold, sellRecord.totalRevenue,
    uptimeBuf, predBuf, degradationRate,
    degradationRate / fmaxf(0.001f, adp_H_rh * adp_G_voc),
    shelfLifeRemaining,
    sellRecord.atFull, sellRecord.at15, sellRecord.at35,
    sellRecord.at60, sellRecord.at85,
    isExpired ? "true" : "false",
    tempSpikeActive ? "true" : "false",
    (currentTemp>35.0 && currentHumidity>80.0) ? "true":"false",
    demoMode ? "true" : "false");
  server.send(200, "application/json", json);
}

// ═══════════════════════════════════════════════════════
//  WIFI DASHBOARD HTML — v22: patent-grade physics labels
// ═══════════════════════════════════════════════════════
const char DASHBOARD_HTML[] PROGMEM = R"HTML(<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PPSC v24 Dashboard</title>
<style>
:root{--bg:#060a0f;--card:#101d2e;--border:#1e3048;--amber:#f59e0b;--green:#10b981;--red:#ef4444;--orange:#f97316;--blue:#38bdf8;--purple:#a78bfa;--text:#94a3b8;--bright:#e2e8f0;--dim:#3d5068}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--bright);font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh}
header{background:linear-gradient(180deg,#0d1a2a,transparent);padding:20px 16px 12px;text-align:center;border-bottom:1px solid var(--border)}
.hb{font-size:.65rem;letter-spacing:3px;color:var(--amber);text-transform:uppercase;margin-bottom:4px}
h1{font-size:2rem;font-weight:900;letter-spacing:8px;text-shadow:0 0 30px rgba(245,158,11,.3)}
.pn{font-size:.9rem;color:var(--amber);margin-top:2px;font-weight:600}
.hm{font-size:.65rem;color:var(--dim);margin-top:4px}
.ld{display:inline-flex;align-items:center;gap:5px;font-size:.65rem;color:var(--green);margin-top:6px}
.ld::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--green);animation:p 2s infinite}
@keyframes p{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.ab{margin:10px 12px 0;border-radius:8px;padding:10px 14px;font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:10px;animation:ap 1s ease infinite alternate}
.ab.exp{background:#1f0505;border:1px solid var(--red);color:var(--red)}
.ab.spk{background:#1f1005;border:1px solid var(--orange);color:var(--orange)}
@keyframes ap{from{opacity:1}to{opacity:.7}}
main{padding:12px;max-width:500px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.c{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;position:relative;overflow:hidden}
.c::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(245,158,11,.15),transparent)}
.cl{font-size:.6rem;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:8px;font-weight:600}
.cr{display:flex;gap:10px}.cr .c{flex:1}
.fc{display:flex;align-items:center;gap:20px}
.gw{position:relative;flex-shrink:0}.gw svg{display:block}
.gc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.gv{font-size:1.5rem;font-weight:800;font-family:'Courier New',monospace;line-height:1}
.gu{font-size:.7rem;color:var(--text)}
.fd{flex:1}
.fs{font-size:1.1rem;font-weight:700;margin-bottom:6px}
.tt{display:inline-block;padding:3px 10px;border-radius:4px;font-size:.7rem;font-weight:700;letter-spacing:1px;background:rgba(245,158,11,.12);border:1px solid var(--amber);color:var(--amber);margin-bottom:8px}
.pb{background:var(--border);border-radius:99px;height:6px;overflow:hidden;margin-top:8px}
.pf{height:100%;border-radius:99px;transition:width .8s,background .8s}
.dv{font-size:1.6rem;font-weight:700;font-family:'Courier New',monospace;line-height:1.1}
.du{font-size:.75rem;color:var(--text);font-weight:400}
.ds{font-size:.72rem;color:var(--text);margin-top:6px;display:flex;justify-content:space-between}.ds span:last-child{color:var(--bright);font-weight:600}
.er{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.pb2{font-size:2rem;font-weight:800;font-family:'Courier New',monospace;color:var(--amber)}
.sg{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px}
.sc{text-align:center}
.sb{background:var(--border);border-radius:4px;height:40px;display:flex;align-items:flex-end;overflow:hidden}
.sf{width:100%;border-radius:3px;transition:height .6s;min-height:2px}
.sl{font-size:.55rem;color:var(--dim);margin-top:4px}
.sn{font-size:.7rem;font-weight:700;color:var(--bright);font-family:'Courier New',monospace}
.pv{font-size:1.15rem;font-weight:700;color:var(--blue);font-family:'Courier New',monospace;margin-top:4px}
.snum{font-size:2rem;font-weight:800;font-family:'Courier New',monospace}
.ls{color:var(--red)!important;animation:p 1s infinite}
.rv{font-family:'Courier New',monospace}
footer{text-align:center;font-size:.6rem;color:var(--dim);padding:16px;border-top:1px solid var(--border);margin-top:4px}
.db{background:#7c3aed;color:#fff;font-size:.6rem;padding:2px 7px;border-radius:4px;margin-left:8px;font-weight:700;vertical-align:middle}
.mb{font-size:.6rem;padding:2px 8px;border-radius:4px;font-weight:700;vertical-align:middle}
.mb.fx{background:rgba(56,189,248,.12);border:1px solid var(--blue);color:var(--blue)}
.mb.ad{background:rgba(167,139,250,.12);border:1px solid var(--purple);color:var(--purple)}
.dv2{border:none;border-top:1px solid var(--border);margin:10px 0}
.lr{display:flex;justify-content:space-between;align-items:center}
.fr{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.fl{font-size:.65rem;color:var(--text);width:70px;flex-shrink:0}
.fb{flex:1;background:var(--border);border-radius:99px;height:5px;overflow:hidden}
.ff{height:100%;border-radius:99px;transition:width .8s}
.fv{font-size:.65rem;font-family:'Courier New',monospace;font-weight:700;width:48px;text-align:right;flex-shrink:0}
</style>
</head>
<body>
<header>
<div class="hb">Perishable Predictor Smart Cart</div>
<h1>PPSC</h1>
<div class="pn" id="pN">Milk</div>
<div class="hm">VIT Vellore &bull; BCSE305L &bull; v24 &bull; 192.168.4.1</div>
<div class="ld">LIVE <span id="lu">now</span></div>
</header>
<div class="ab exp" id="aB" style="display:none"><span>&#9888;</span><span id="aM">Alert</span></div>
<main>
<div class="c fc">
<div class="gw"><svg width="110" height="110" viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="none" stroke="#1e3048" stroke-width="10"/><circle id="gF" cx="60" cy="60" r="50" fill="none" stroke="#10b981" stroke-width="10" stroke-linecap="round" stroke-dasharray="314 314" stroke-dashoffset="31" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .8s,stroke .8s"/></svg><div class="gc"><div class="gv" id="fP" style="color:#10b981">100</div><div class="gu">%</div></div></div>
<div class="fd"><div class="cl">Freshness</div><div class="fs" id="fS">FRESH</div><div class="tt" id="tT">FULL PRICE</div><div class="pb"><div class="pf" id="fB" style="width:100%;background:#10b981"></div></div><div style="font-size:.68rem;color:var(--dim);margin-top:6px">Up: <span id="ut" style="color:var(--text)">0m00s</span> <span id="dT" class="db" style="display:none">DEMO</span></div></div>
</div>
<div class="er">
<div class="c"><div class="cl">Temperature</div><div class="dv" id="tV">25.0<span class="du">&deg;C</span></div><div id="tS" style="margin-top:6px;font-size:.65rem;color:var(--dim)">Normal</div></div>
<div class="c"><div class="cl">Humidity</div><div class="dv" id="hV">60<span class="du">%</span></div><div id="hS" style="margin-top:6px;font-size:.65rem;color:var(--dim)">Normal</div></div>
<div class="c"><div class="cl">Deg. Rate</div><div class="dv rv" id="rV">1.00<span class="du">x</span></div><div id="mS" style="font-size:.6rem;color:var(--dim);margin-top:6px">Fixed Ea</div></div>
</div>
<div class="c"><div class="lr"><div class="cl">Physics Engine</div><span id="mB" class="mb fx">FIXED Ea</span></div>
<div style="margin-top:6px">
<div class="fr"><div class="fl">Vm(VOC)</div><div class="fb"><div class="ff" id="b0" style="width:2%;background:#f97316"></div></div><div class="fv" id="v0" style="color:#f97316">1.000</div></div>
<div class="fr"><div class="fl">Hm(RH)</div><div class="fb"><div class="ff" id="b1" style="width:2%;background:#a78bfa"></div></div><div class="fv" id="v1" style="color:#a78bfa">1.000</div></div>
<div class="fr"><div class="fl">F(hist)</div><div class="fb"><div class="ff" id="b2" style="width:2%;background:#38bdf8"></div></div><div class="fv" id="v2" style="color:#38bdf8">1.000</div></div>
<div class="fr"><div class="fl">Ea_eff</div><div class="fb"><div class="ff" id="b3" style="width:50%;background:#f59e0b"></div></div><div class="fv" id="v3" style="color:#f59e0b">50.0kJ</div></div>
</div>
<div style="font-size:.6rem;color:var(--dim);margin-top:8px">VOC: <span id="vV" style="font-family:'Courier New',monospace">&mdash;</span> ppm | raw: <span id="vR" style="font-family:'Courier New',monospace">&mdash;</span> | <span id="mQ">&#9203; warming&hellip;</span></div>
</div>
<!-- v21: Power/Battery card -->
<div class="cr">
<div class="c"><div class="cl">Power Mode</div><div class="dv" id="pmV">A<span class="du"> full</span></div><div class="ds"><span>Battery</span><span id="btV">100%</span></div></div>
<div class="c"><div class="cl">Thermal EMA</div><div class="dv rv" id="emV">0.000</div><div class="ds"><span>Vm&times;Hm</span><span id="ghfV">1.000</span></div></div>
</div>
<div class="cr">
<div class="c"><div class="cl">Price</div><div class="pb2" id="pV">Rs.25</div><div class="ds"><span>Base</span><span id="bP">Rs.25</span></div><div class="ds"><span>Discount</span><span id="dV" style="color:var(--green)">0%</span></div></div>
<div class="c"><div class="cl">Stock</div><div class="snum" id="sN">10<span class="du">u</span></div><div class="ds"><span>Est.Rev</span><span id="eR">Rs.250</span></div><div class="ds"><span>Actual</span><span id="aR">Rs.0</span></div></div>
</div>
<div class="c"><div class="lr"><div class="cl">Next Price Drop</div><div style="font-size:.6rem;color:var(--dim)" id="lR">--</div></div><div class="pv" id="pD">--</div><hr class="dv2"><div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text)"><span>Sold</span><span style="font-weight:700;font-family:'Courier New',monospace" id="sC">0</span></div><div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text);margin-top:4px"><span>Revenue</span><span style="font-weight:700;color:var(--amber);font-family:'Courier New',monospace" id="rT">Rs.0</span></div></div>
<div class="c"><div class="cl">Sales by Tier</div><div class="sg">
<div class="sc"><div class="sb"><div class="sf" id="t0" style="height:0%;background:#10b981"></div></div><div class="sn" id="c0">0</div><div class="sl">FULL</div></div>
<div class="sc"><div class="sb"><div class="sf" id="t1" style="height:0%;background:#84cc16"></div></div><div class="sn" id="c1">0</div><div class="sl">-15%</div></div>
<div class="sc"><div class="sb"><div class="sf" id="t2" style="height:0%;background:#eab308"></div></div><div class="sn" id="c2">0</div><div class="sl">-35%</div></div>
<div class="sc"><div class="sb"><div class="sf" id="t3" style="height:0%;background:#f97316"></div></div><div class="sn" id="c3">0</div><div class="sl">-60%</div></div>
<div class="sc"><div class="sb"><div class="sf" id="t4" style="height:0%;background:#ef4444"></div></div><div class="sn" id="c4">0</div><div class="sl">-85%</div></div>
</div></div>
</main>
<footer>3s refresh &bull; PPSC v24 &bull; BCSE305L &bull; VIT Vellore</footer>
<script>
const C=2*Math.PI*50;
function fc(f,e){if(e)return'#ef4444';if(f>60)return'#10b981';if(f>30)return'#eab308';if(f>15)return'#f97316';return'#ef4444'}
function pc(v,m){return Math.min(100,Math.max(2,(v/m)*100))+'%'}
function u(d){
document.getElementById('pN').textContent=d.produce;
document.getElementById('dT').style.display=d.demo?'inline':'none';
const c=fc(d.freshness,d.expired),o=C-(Math.min(100,Math.max(0,d.freshness))/100)*C;
document.getElementById('gF').style.strokeDashoffset=o;
document.getElementById('gF').style.stroke=c;
document.getElementById('fP').textContent=d.freshness.toFixed(1);
document.getElementById('fP').style.color=c;
document.getElementById('fS').textContent=d.status;
document.getElementById('tT').textContent=d.tier+' PRICE';
document.getElementById('fB').style.width=d.freshness+'%';
document.getElementById('fB').style.background=c;
document.getElementById('ut').textContent=d.uptime;
document.getElementById('tV').innerHTML=d.temp.toFixed(1)+'<span class="du">&deg;C</span>';
document.getElementById('hV').innerHTML=d.humidity.toFixed(0)+'<span class="du">%</span>';
document.getElementById('rV').innerHTML=d.rate.toFixed(2)+'<span class="du">x</span>';
document.getElementById('tS').textContent=d.spike?'SPIKE!':d.temp>35?'HIGH':'Normal';
document.getElementById('tS').style.color=d.spike?'#f97316':d.temp>35?'#f97316':'var(--dim)';
document.getElementById('hS').textContent=d.humidity>80?'HIGH':'Normal';
document.getElementById('hS').style.color=d.humidity>80?'#f97316':'var(--dim)';
document.getElementById('mS').textContent=d.physicsMode==='ADAPTIVE'?'Adaptive Ea':'Fixed Ea';
const a=d.physicsMode==='ADAPTIVE',b=document.getElementById('mB');
b.textContent=a?'ADAPTIVE Ea':'FIXED Ea';b.className='mb '+(a?'ad':'fx');
// Physics bars — v21: always show G,H,F,Ea
document.getElementById('v0').textContent=d.gVoc.toFixed(3);
document.getElementById('v1').textContent=d.hRh.toFixed(3);
document.getElementById('v2').textContent=d.fHist.toFixed(3);
document.getElementById('v3').textContent=d.eaEff.toFixed(1)+'kJ';
document.getElementById('b0').style.width=pc(Math.abs(1-d.gVoc),0.5);
document.getElementById('b1').style.width=pc(Math.abs(1-d.hRh),0.5);
document.getElementById('b2').style.width=pc(Math.abs(1-d.fHist),0.5);
document.getElementById('b3').style.width=pc(Math.abs(d.eaEff-d.eaBase),d.eaBase*0.35+1);
// v21: Power/Battery
const pmLabels={A:'A full',B:'B lut2d',C:'C low'};
document.getElementById('pmV').innerHTML=d.powerMode+'<span class="du"> '+(pmLabels[d.powerMode]||'')+'</span>';
document.getElementById('btV').textContent=d.batteryPct.toFixed(0)+'%';
document.getElementById('btV').style.color=d.batteryPct<25?'#ef4444':d.batteryPct<60?'#f59e0b':'#10b981';
document.getElementById('emV').textContent=(d.thermalEMA||0).toFixed(3);
document.getElementById('ghfV').textContent=(d.gVoc*d.hRh).toFixed(3);
document.getElementById('vV').textContent=d.vocPPM.toFixed(1);document.getElementById('vR').textContent=d.vocRaw;
document.getElementById('mQ').textContent=d.mqReady?'ready':'warming';document.getElementById('mQ').style.color=d.mqReady?'#10b981':'#f59e0b';
document.getElementById('pV').textContent='Rs.'+d.price.toFixed(1);document.getElementById('bP').textContent='Rs.'+d.basePrice;
const dc=Math.round((1-d.price/d.basePrice)*100);document.getElementById('dV').textContent=dc>0?'-'+dc+'%':'None';document.getElementById('dV').style.color=dc>0?'#ef4444':'#10b981';
const s=document.getElementById('sN');s.innerHTML=d.stock+'<span class="du">u</span>';s.className='snum'+(d.stock<=3?' ls':'');
document.getElementById('eR').textContent='Rs.'+(d.price*d.stock).toFixed(0);document.getElementById('aR').textContent='Rs.'+d.revenue;
document.getElementById('pD').textContent=d.expired?'EXPIRED':d.prediction;
document.getElementById('sC').textContent=d.sold;document.getElementById('rT').textContent='Rs.'+d.revenue;
const ts=[d.atFull,d.at15,d.at35,d.at60,d.at85],mx=Math.max(1,...ts);
ts.forEach((v,i)=>{document.getElementById('t'+i).style.height=Math.max(2,(v/mx)*100)+'%';document.getElementById('c'+i).textContent=v;});
const ab=document.getElementById('aB'),am=document.getElementById('aM');
if(d.expired){ab.style.display='flex';ab.className='ab exp';am.textContent=d.produce+' EXPIRED';}
else if(d.spike){ab.style.display='flex';ab.className='ab spk';am.textContent='Temp spike! '+d.temp.toFixed(1)+'C';}
else if(d.spoilRisk){ab.style.display='flex';ab.className='ab spk';am.textContent='High spoil risk';}
else ab.style.display='none';
const n=new Date();document.getElementById('lR').textContent=n.toLocaleTimeString();document.getElementById('lu').textContent=n.toLocaleTimeString();
}
async function r(){try{u(await(await fetch('/api/data')).json())}catch(e){}}
r();setInterval(r,3000);
</script>
</body>
</html>)HTML";

void handleRoot() { server.send_P(200, "text/html", DASHBOARD_HTML); }

void setupWiFi() {
  WiFi.softAP(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] AP: "); Serial.print(WIFI_SSID);
  Serial.print(" IP: "); Serial.println(WiFi.softAPIP());
  server.on("/", handleRoot);
  server.on("/api/data", handleAPIData);
  server.begin();
  Serial.println("[WiFi] HTTP server ready");
}

// ═══════════════════════════════════════════════════════
//  SPLASH SCREEN
// ═══════════════════════════════════════════════════════
void drawSplash() {
  display.clearDisplay();
  display.drawRect(0,0,128,64,SH110X_WHITE);
  display.drawRect(2,2,124,60,SH110X_WHITE);
  display.display(); delay(200);
  display.setTextSize(2);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(18,8); display.print("P P S C");
  display.display(); delay(400);
  display.setTextSize(1);
  display.setCursor(14,30); display.print("Smart Vendor Cart");
  display.display(); delay(300);
  display.drawLine(10,40,118,40,SH110X_WHITE);
  display.setCursor(22,44); display.print("VIT Vellore");
  display.display(); delay(250);
  display.setCursor(4,54); display.print("BCSE305L v24");
  display.display(); delay(150);
  for (int d=0;d<4;d++) {
    display.fillCircle(76+d*12,57,2,SH110X_WHITE);
    display.display(); delay(150);
  }
  delay(250);
  display.clearDisplay(); drawBorder();
  drawTitleBar("WiFi Dashboard");
  display.setCursor(2,16); display.print("SSID: PPSC_Cart");
  display.setCursor(2,26); display.print("Pass: 12345678");
  display.setCursor(2,36); display.print("URL: 192.168.4.1");
  drawHLine(48);
  display.setCursor(4,52); display.print("Open in browser");
  display.display(); delay(2500);
}

// ═══════════════════════════════════════════════════════
//  SCROLLABLE MENU
// ═══════════════════════════════════════════════════════
void drawScrollableMenu(const char* title, const char** items,
                         int count, int cursor, int& scroll) {
  if (cursor < scroll) scroll = cursor;
  if (cursor >= scroll+5) scroll = cursor-4;
  display.clearDisplay(); drawBorder(); drawTitleBar(title);
  for (int i=0; i<5 && (i+scroll)<count; i++) {
    int idx = i+scroll, y = 13+i*10;
    if (idx == cursor) {
      display.fillRect(1,y-1,121,10,SH110X_WHITE);
      display.setTextColor(SH110X_BLACK);
    }
    display.setCursor(4,y);
    display.print(idx+1); display.print(". ");
    display.print(items[idx]);
    display.setTextColor(SH110X_WHITE);
  }
  if (count > 5) {
    int barH = max(4,(5*50)/count);
    int barY = 13+(scroll*50)/count;
    display.drawRect(122,13,5,50,SH110X_WHITE);
    display.fillRect(122,barY,5,barH,SH110X_WHITE);
  }
  display.display();
}

// ═══════════════════════════════════════════════════════
//  HOME SCREEN — text audited for 21 chars max
// ═══════════════════════════════════════════════════════
void drawHomeScreen() {
  display.clearDisplay(); drawBorder();
  DateTime now = safeRTCNow();
  char tbuf[12];
  snprintf(tbuf, sizeof(tbuf), "%02d:%02d %s",
    now.hour(), now.minute(), modeShortLabel());
  char lt[22];
  snprintf(lt, sizeof(lt), "PPSC|%s", DB[selectedProduce].name);
  if (demoMode) strncat(lt," D", sizeof(lt)-strlen(lt)-1);
  drawTitleBar(lt, tbuf);

  display.setTextSize(1);
  if (isExpired) {
    if ((millis()/500)%2==0) {
      display.setTextSize(2);
      display.setCursor(14,20); display.print("EXPIRED!");
      display.setTextSize(1);
    }
    display.setCursor(2,40);
    display.print(DB[selectedProduce].name);
    display.print(" UNSELLABLE");
    drawHLine(54);
    char el[12]; getElapsedStr(el,sizeof(el));
    display.setCursor(2,56); display.print("Up:");
    display.print(el);
    display.setCursor(82,56); display.print("SEL=Menu");
    display.display(); return;
  }

  display.setCursor(2,14);
  display.print(currentFreshness,1); display.print("% ");
  display.print(freshLabel(currentFreshness));
  display.print(" "); display.print(tier(currentFreshness));

  int barW = (int)(currentFreshness * 124.0 / 100.0);
  display.drawRect(2,23,124,8,SH110X_WHITE);
  if (barW > 2) display.fillRect(3,24,barW-2,6,SH110X_WHITE);

  // v25 UI: tier tick marks at the 80/60/40/20% price-drop thresholds.
  // Drawn as black notches — visible as gaps in the white fill, so the
  // vendor sees exactly how close freshness is to the next markdown.
  const float tierPcts[4] = {80.0f, 60.0f, 40.0f, 20.0f};
  for (int i = 0; i < 4; i++) {
    int tx = 2 + (int)(tierPcts[i] * 124.0f / 100.0f);
    display.drawFastVLine(tx, 24, 6, SH110X_BLACK);
  }

  // v25 UI: freshness trend glyph (top-right of freshness row).
  // Free space there: text maxes at ~104px, glyph sits at x=117.
  drawTrendGlyph(117, 14);

  if (mlDetected && millis()-mlTime < ML_DISPLAY_MS) {
    drawMLNotification(); display.display(); return;
  }

  if (tempSpikeActive) {
    if ((millis()/400)%2==0) {
      display.fillRect(1,32,126,11,SH110X_WHITE);
      display.setTextColor(SH110X_BLACK);
      display.setCursor(14,34); display.print("!! TEMP SPIKE !!");
      display.setTextColor(SH110X_WHITE);
    } else {
      display.setCursor(8,34);
      display.print("T:"); display.print(currentTemp,1);
      display.print("C DEG ACCEL!");
    }
    display.setCursor(2,45);
    display.print("Rs."); display.print(currentPrice,1);
    display.setCursor(68,45);
    display.print("H:"); display.print((int)currentHumidity);
    display.print("%");
  }
  else if (currentTemp>35.0 && currentHumidity>80.0) {
    if ((millis()/600)%2==0) {
      display.fillRect(1,32,126,11,SH110X_WHITE);
      display.setTextColor(SH110X_BLACK);
      display.setCursor(8,34);
      display.print("! HIGH SPOIL RISK");
      display.setTextColor(SH110X_WHITE);
    } else {
      display.setCursor(8,34);
      display.print("T>35C & H>80%");
    }
    display.setCursor(2,45);
    display.print("Rs."); display.print(currentPrice,1);
    display.setCursor(68,45);
    display.print("T:"); display.print(currentTemp,1);
    display.print("C");
  }
  else {
    display.setCursor(2,34);
    display.print("T:"); display.print(currentTemp,1);
    display.print("C");
    display.setCursor(68,34);
    display.print("H:"); display.print((int)currentHumidity);
    display.print("%");
    display.setCursor(2,44);
    display.print("Rs."); display.print(currentPrice,1);
    if (stockQty<=3 && (millis()/500)%2==0) {
      display.setCursor(68,44);
      display.print("STK:"); display.print(stockQty);
    } else if (!mq135Ready) {
      // v25 UI: MQ-135 still warming (120s) — show progress, not stale VOC
      unsigned long pct = millis() * 100UL / MQ135_WARMUP_MS;
      if (pct > 99) pct = 99;
      display.setCursor(68,44);
      display.print("MQ:"); display.print((int)pct); display.print("%");
    } else {
      display.setCursor(68,44);
      display.print("V:"); display.print((int)currentVOC);
      display.print(" "); display.print(modeShortLabel());
    }
  }

  drawHLine(54);
  float mins = minutesUntilNextTier();
  char el[12]; getElapsedStr(el,sizeof(el));
  display.setCursor(2,56);
  if (mins>0 && mins<9990) {
    char pb[20];
    if (mins<60)
      snprintf(pb,sizeof(pb),">%s %dm",nextTierLabel(),(int)mins);
    else
      snprintf(pb,sizeof(pb),">%s %dh%dm",nextTierLabel(),
        (int)(mins/60),(int)fmod(mins,60));
    display.print(pb);
  } else {
    display.print("Up:"); display.print(el);
  }
  display.setCursor(94,56); display.print("S=Menu");
  display.display();
}

// ═══════════════════════════════════════════════════════
//  STATUS SCREEN — v21: show power mode
// ═══════════════════════════════════════════════════════
void drawStatusScreen() {
  display.clearDisplay(); drawBorder();
  char t[22];
  snprintf(t,sizeof(t),"STS|%s",DB[selectedProduce].name);
  drawTitleBar(t, modeShortLabel());
  drawHLine(12);
  display.setTextSize(1);

  display.setCursor(2,15);
  display.print("Frsh: ");
  if (isExpired) display.print("EXPIRED");
  else {
    display.print(currentFreshness,1); display.print("% ");
    display.print(freshLabel(currentFreshness));
  }

  display.setCursor(2,24);
  display.print("Temp: ");
  display.print(currentTemp,1); display.print("C");
  if (tempSpikeActive) display.print(" SPK!");

  display.setCursor(2,33);
  display.print("Hum : ");
  display.print(currentHumidity,0); display.print("%");

  display.setCursor(2,42);
  display.print("VOC : ");
  display.print((int)currentVOC); display.print("ppm");
  if (!mq135Ready) display.print(" wrm");

  // v21: show power mode + rate
  display.setCursor(2,51);
  display.print("Md:");
  display.print(modeShortLabel());
  display.print(" PM:");
  display.print(powerModeLabel());
  display.print(" Rt=");
  display.print(degradationRate,2);

  display.display();
}

// ═══════════════════════════════════════════════════════
//  PRICE SCREEN
// ═══════════════════════════════════════════════════════
void drawPriceScreen() {
  display.clearDisplay(); drawBorder();
  char t[22];
  snprintf(t,sizeof(t),"PRC|%s",DB[selectedProduce].name);
  drawTitleBar(t); drawHLine(12);
  display.setTextSize(1);
  float disc = isExpired ? 100.0
    : (1.0 - currentPrice/DB[selectedProduce].basePrice)*100.0;
  display.setCursor(2,15);
  display.print("Base: Rs.");
  display.print(DB[selectedProduce].basePrice,0);
  display.setCursor(2,24);
  display.print("Now : ");
  if (isExpired) display.print("Rs.0 EXPD");
  else {
    display.print("Rs."); display.print(currentPrice,1);
    display.print(" -"); display.print((int)disc);
    display.print("%");
  }
  display.setCursor(2,33);
  display.print("Stk:"); display.print(stockQty);
  display.print(" ^v=adj");
  display.setCursor(2,42);
  display.print("Est: Rs.");
  display.print(currentPrice * stockQty, 0);
  drawHLine(51);
  display.setCursor(2,54);
  display.print("Sold:"); display.print(totalUnitsSold);
  display.print(" Rev:Rs.");
  display.print(sellRecord.totalRevenue,0);
  display.display();
}

// ═══════════════════════════════════════════════════════
//  ARRHENIUS SCREEN — v21: updated for new physics
// ═══════════════════════════════════════════════════════
void drawArrheniusScreen() {
  display.clearDisplay(); drawBorder();
  display.setTextSize(1);

  if (!useAdaptiveEa) {
    drawTitleBar("PHY|FIXED Ea"); drawHLine(12);
    display.setCursor(2,15);
    display.print("Ea : ");
    display.print(DB[selectedProduce].Ea,0);
    display.print(" kJ/mol");
    display.setCursor(2,24);
    display.print("Rate: ");
    display.print(degradationRate,3); display.print("x");
    display.setCursor(2,33);
    display.print("k0: ");
    { char k0buf[14]; snprintf(k0buf, sizeof(k0buf), "%.2e", DB[selectedProduce].k0); display.print(k0buf); }
    display.setCursor(2,42);
    display.print("PM:"); display.print(powerModeLabel());
    display.print(" Bat:"); display.print((int)batteryPct);
    display.print("%");
    drawHLine(51);
    display.setCursor(2,54);
    display.print("Life@25:");
    display.print(DB[selectedProduce].shelfLifeDays,0);
    display.print("d ");
    if (isExpired) display.print("EXPD");
    else if (shelfLifeRemaining>=24) {
      display.print(shelfLifeRemaining/24.0,1);
      display.print("d");
    } else {
      display.print(shelfLifeRemaining,1);
      display.print("h");
    }
  } else {
    drawTitleBar("PHY|ADAPT Ea"); drawHLine(12);
    display.setCursor(2,15);
    display.print("Ea: "); display.print(adp_Ea_eff,1);
    display.print("/"); display.print(DB[selectedProduce].Ea,0);
    display.print("kJ");
    display.setCursor(2,24);
    display.print("Vm(V): "); display.print(adp_G_voc,3);
    display.print(" V="); display.print((int)currentVOC);
    display.print("p");
    display.setCursor(2,33);
    display.print("Hm(R): "); display.print(adp_H_rh,3);
    display.print(" RH="); display.print((int)currentHumidity);
    display.print("%");
    display.setCursor(2,42);
    display.print("F(T): "); display.print(adp_F_hist,3);
    display.print(" EMA="); display.print(adp_thermalEMA,2);
    drawHLine(51);
    display.setCursor(2,54);
    display.print("Rt="); display.print(degradationRate,3);
    display.print("x PM:"); display.print(powerModeLabel());
  }
  display.display();
}

// ═══════════════════════════════════════════════════════
//  SELL LOG
// ═══════════════════════════════════════════════════════
void drawSellLogScreen() {
  display.clearDisplay(); drawBorder();
  char t[22];
  snprintf(t,sizeof(t),"SELL|%s",DB[selectedProduce].name);
  drawTitleBar(t); drawHLine(12);
  display.setTextSize(1);
  display.setCursor(2,15);
  display.print("Sold: "); display.print(totalUnitsSold);
  display.setCursor(2,25);
  display.print("Rev : Rs.");
  display.print(sellRecord.totalRevenue,0);
  drawHLine(33);
  display.setCursor(2,36); display.print("FUL:"); display.print(sellRecord.atFull);
  display.setCursor(42,36); display.print("-15:"); display.print(sellRecord.at15);
  display.setCursor(82,36); display.print("-35:"); display.print(sellRecord.at35);
  display.setCursor(2,46); display.print("-60:"); display.print(sellRecord.at60);
  display.setCursor(42,46); display.print("-85:"); display.print(sellRecord.at85);
  drawHLine(54);
  display.setCursor(2,56);
  display.print("UP=Sell BK=Back");
  display.display();
}

// ═══════════════════════════════════════════════════════
//  PRODUCE HISTORY
// ═══════════════════════════════════════════════════════
void drawProdHistoryScreen() {
  display.clearDisplay(); drawBorder();
  drawTitleBar("PROD HISTORY"); drawHLine(12);
  display.setTextSize(1);
  if (prodHistCount == 0) {
    display.setCursor(16,26); display.print("No history yet.");
    display.setCursor(4,38); display.print("Reset produce first.");
    drawHLine(54);
    display.setCursor(2,56); display.print("BK=Back");
    display.display(); return;
  }
  for (int i=0; i<min(prodHistCount,5); i++) {
    int idx = (prodHistNext-1-i+PROD_HIST_MAX) % PROD_HIST_MAX;
    if (!prodHist[idx].valid) continue;
    int y = 14+i*9;
    display.setCursor(2,y);
    display.print("#"); display.print(i+1); display.print(" ");
    display.print(prodHist[idx].name);
    display.print(" "); display.print(prodHist[idx].finalFreshness,0);
    display.print("%");
  }
  drawHLine(58);
  display.setCursor(2,60); display.print("Newest first BK=Back");
  display.display();
}

// ═══════════════════════════════════════════════════════
//  DAY REPORT
// ═══════════════════════════════════════════════════════
void drawDayReportScreen() {
  display.clearDisplay(); drawBorder();
  drawTitleBar("DAY REPORT"); drawHLine(12);
  display.setTextSize(1);
  DateTime now = safeRTCNow();
  char d[12];
  snprintf(d,sizeof(d),"%02d/%02d/%04d",now.day(),now.month(),now.year());
  display.setCursor(2,15); display.print(d);
  display.setCursor(80,15); display.print(DB[selectedProduce].name);
  drawHLine(23);
  display.setCursor(2,26); display.print("Sold: ");
  display.print(totalUnitsSold);
  display.setCursor(2,35); display.print("Rev : Rs.");
  display.print(sellRecord.totalRevenue,0);
  display.setCursor(2,44); display.print("Best: ");
  int best=sellRecord.atFull; const char* bn="FUL";
  if(sellRecord.at15>best){best=sellRecord.at15;bn="-15";}
  if(sellRecord.at35>best){best=sellRecord.at35;bn="-35";}
  if(sellRecord.at60>best){best=sellRecord.at60;bn="-60";}
  if(sellRecord.at85>best){best=sellRecord.at85;bn="-85";}
  if(best==0) display.print("N/A");
  else { display.print(bn); display.print("(");
         display.print(best); display.print("u)"); }
  drawHLine(54);
  display.setCursor(2,56);
  display.print("Logs:"); display.print(totalLogs);
  display.setCursor(64,56); display.print("BK=Back");
  display.display();
}

// ═══════════════════════════════════════════════════════
//  RESET CONFIRM
// ═══════════════════════════════════════════════════════
void drawResetConfirm() {
  display.clearDisplay();
  display.drawRect(0,0,128,64,SH110X_WHITE);
  display.drawRect(2,2,124,60,SH110X_WHITE);
  display.fillRect(3,3,122,11,SH110X_WHITE);
  display.setTextColor(SH110X_BLACK); display.setTextSize(1);
  display.setCursor(26,5); display.print("!! RESET ??");
  display.setTextColor(SH110X_WHITE);
  display.setCursor(4,18); display.print("Item: ");
  display.print(DB[selectedProduce].name);
  display.setCursor(4,29); display.print("Saves hist + clears");
  drawHLine(40);
  display.setCursor(4,44); display.print("[SEL] = Confirm");
  display.setCursor(4,54); display.print("[BACK] = Cancel");
  display.display();
}

// ═══════════════════════════════════════════════════════
//  DEMO SCREEN
// ═══════════════════════════════════════════════════════
void drawDemoScreen() {
  display.clearDisplay();
  display.drawRect(0,0,128,64,SH110X_WHITE);
  display.drawRect(2,2,124,60,SH110X_WHITE);
  display.fillRect(3,3,122,11,SH110X_WHITE);
  display.setTextColor(SH110X_BLACK); display.setTextSize(1);
  display.setCursor(32,5); display.print("DEMO MODE");
  display.setTextColor(SH110X_WHITE); drawHLine(14);
  display.setCursor(4,17);
  display.print("Speed: ");
  display.print(demoSpeedFull[demoSpeedIdx]);
  display.print("x");
  for (int i=0; i<DEMO_SPEED_COUNT; i++) {
    int cx = 4 + i*20;
    bool active = (i == demoSpeedIdx);
    if (active) {
      display.fillRect(cx,26,19,11,SH110X_WHITE);
      display.setTextColor(SH110X_BLACK);
    } else {
      display.drawRect(cx,26,19,11,SH110X_WHITE);
    }
    int lw = strlen(demoSpeedShort[i])*6;
    display.setCursor(cx+(19-lw)/2, 28);
    display.print(demoSpeedShort[i]);
    display.setTextColor(SH110X_WHITE);
  }
  drawHLine(38);
  display.setCursor(4,41); display.print("Status: ");
  if (demoMode) {
    display.print("RUNNING");
    if ((millis()/400)%2==0)
      display.fillRect(120,40,5,5,SH110X_WHITE);
  } else display.print("STOPPED");
  display.setCursor(4,51);
  display.print("F:"); display.print(currentFreshness,1);
  display.print("% "); display.print(DB[selectedProduce].name);
  drawHLine(60);
  display.setCursor(4,60);
  display.print(demoMode ? "^v=spd SEL=Stop" : "^v=spd SEL=Start");
  display.display();
}

// ═══════════════════════════════════════════════════════
//  PHYSICS MODE SELECTION
// ═══════════════════════════════════════════════════════
void drawPhysicsModeScreen() {
  display.clearDisplay(); drawBorder();
  drawTitleBar("PHYSICS MODE", modeShortLabel());
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(4,15); display.print("Select engine:");

  if (physicsCursor==0) {
    display.fillRect(1,24,126,10,SH110X_WHITE);
    display.setTextColor(SH110X_BLACK);
  }
  display.setCursor(4,26);
  display.print(physicsCursor==0 ? "> A: Fixed Ea" : "  A: Fixed Ea");
  if (!useAdaptiveEa) display.print(" *");
  display.setTextColor(SH110X_WHITE);
  display.setCursor(12,35);
  display.print("k=k0*exp(-Ea/RT)");

  if (physicsCursor==1) {
    display.fillRect(1,44,126,10,SH110X_WHITE);
    display.setTextColor(SH110X_BLACK);
  }
  display.setCursor(4,46);
  display.print(physicsCursor==1 ? "> B: Adaptive Ea" : "  B: Adaptive Ea");
  if (useAdaptiveEa) display.print(" *");
  display.setTextColor(SH110X_WHITE);
  display.setCursor(12,55);
  display.print("Ea*F, Hm*Vm on rate");
  display.display();
}

// ═══════════════════════════════════════════════════════
//  GRAPH
// ═══════════════════════════════════════════════════════
void drawGraph(float* data, const char* title,
               float minV, float maxV, const char* unit) {
  display.clearDisplay(); drawBorder(); drawTitleBar(title);
  int gX=22, gY=13, gW=104, gH=49;
  display.drawRect(gX,gY,gW,gH,SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0,gY); display.print((int)maxV);
  display.setCursor(0,gY+gH/2-3); display.print((int)((maxV+minV)/2));
  display.setCursor(0,gY+gH-7); display.print((int)minV);
  int midY=gY+gH/2;
  for (int x=gX+2;x<gX+gW-1;x+=4) display.drawPixel(x,midY,SH110X_WHITE);
  int pts = min(historyCount, GRAPH_POINTS);
  if (pts>1) {
    for (int i=0;i<pts-1;i++) {
      int i1=(historyIdx-pts+i+GRAPH_POINTS)%GRAPH_POINTS;
      int i2=(historyIdx-pts+i+1+GRAPH_POINTS)%GRAPH_POINTS;
      float v1=constrain(data[i1],minV,maxV);
      float v2=constrain(data[i2],minV,maxV);
      int x1=gX+1+(i*(gW-2))/(pts-1);
      int x2=gX+1+((i+1)*(gW-2))/(pts-1);
      int y1=gY+gH-1-(int)((v1-minV)/(maxV-minV)*(gH-2));
      int y2=gY+gH-1-(int)((v2-minV)/(maxV-minV)*(gH-2));
      display.drawLine(x1,y1,x2,y2,SH110X_WHITE);
    }
  }
  float latest=data[(historyIdx-1+GRAPH_POINTS)%GRAPH_POINTS];
  display.setCursor(gX+2,gY+2);
  display.print(latest,1); display.print(unit);
  if (demoMode) { display.setCursor(gX+gW-30,gY+2); display.print("*D"); }
  display.display();
}

// ═══════════════════════════════════════════════════════
//  INPUT HANDLER
// ═══════════════════════════════════════════════════════
void handleInput() {
  bool up   = btnPressed(BTN_UP);
  bool down = btnPressed(BTN_DOWN);
  bool sel  = btnPressed(BTN_SEL);
  bool back = btnPressed(BTN_BACK);

  // v25: any button wakes the display from dim (burn-in protection)
  if (up || down || sel || back) wakeOled();

  switch (currentScreen) {
    case SCR_HOME:
      if (sel) {
        currentScreen=SCR_PRODUCE_LIST;
        menuCursor=selectedProduce;
        menuScroll=max(0,menuCursor-2);
      } break;
    case SCR_PRODUCE_LIST:
      if (up)  {menuCursor--;if(menuCursor<0)menuCursor=PRODUCE_COUNT-1;}
      if (down){menuCursor++;if(menuCursor>=PRODUCE_COUNT)menuCursor=0;}
      if (sel) {
        int oldProduce = selectedProduce;
        // v24 FIX [D]: save history BEFORE selectedProduce changes.
        // In v23, resetProduce() called saveProdHistory() after the switch,
        // recording the NEW produce name in history (wrong).
        // Fix: save old produce state here, then switch, then reset.
        if (menuCursor != oldProduce) {
          // Save current produce to history before abandoning it
          strncpy(prodHist[prodHistNext].name, DB[oldProduce].name, 11);
          prodHist[prodHistNext].name[11] = '\0';
          prodHist[prodHistNext].finalFreshness = currentFreshness;
          prodHist[prodHistNext].valid = true;
          prodHistNext = (prodHistNext + 1) % PROD_HIST_MAX;
          if (prodHistCount < PROD_HIST_MAX) prodHistCount++;
          Serial.printf("[v24] History saved: %s @ %.1f%%\n",
            DB[oldProduce].name, currentFreshness);
        }
        selectedProduce = menuCursor; mlDetected = false;
        // v23 FIX: auto-reset on produce CHANGE to prevent state carryover
        // v24: resetProduce() no longer calls saveProdHistory() (already done above)
        if (oldProduce != selectedProduce) {
          // Reset without saving history again (already saved above)
          cumulativeDeg = 0.0;
          currentFreshness = 100.0;
          isExpired = false;
          tempSpikeActive = false;
          tempSpikeWarned = false;
          gasMultiplier = 1.0;
          adp_thermalEMA = 0.0f;
          adp_Ea_eff = DB[selectedProduce].Ea;
          adp_G_voc = adp_H_rh = adp_F_hist = 1.0f;
          // v24 FIX: init price/shelf so home screen doesn't show stale values
          // for ~2s until first updateDegradation() call
          currentPrice = DB[selectedProduce].basePrice;
          shelfLifeRemaining = DB[selectedProduce].shelfLifeDays * 24.0f;
          if (currentPowerMode == PWR_MODE_B)
            precompute_lut2D(selectedProduce);
          else if (currentPowerMode == PWR_MODE_C)
            precompute_lut1D(selectedProduce);
          if (buzzerOn) { buzzerStop(); buzzerOn = false; }
          lastDegTime = produceSetTime = lastGraphLog = millis();
          historyIdx = historyCount = 0;
          for (int i = 0; i < GRAPH_POINTS; i++) {
            tempHistory[i] = currentTemp;
            freshHistory[i] = 100.0;
          }
          confirmBeep();
          Serial.printf("[v24] Auto-reset: %s -> %s\n",
            DB[oldProduce].name, DB[selectedProduce].name);
          saveLastState();  // v25: persist switch immediately (resume accuracy)
        }
        detailCursor=detailScroll=0;
        currentScreen=SCR_PRODUCE_DETAIL;
      }
      if (back) currentScreen=SCR_HOME;
      break;
    case SCR_PRODUCE_DETAIL:
      if (up)  {detailCursor--;if(detailCursor<0)detailCursor=DETAIL_COUNT-1;}
      if (down){detailCursor++;if(detailCursor>=DETAIL_COUNT)detailCursor=0;}
      if (sel) {
        switch(detailCursor) {
          case 0: currentScreen=SCR_STATUS; break;
          case 1: currentScreen=SCR_PRICE; break;
          case 2: currentScreen=SCR_ARRHENIUS; break;
          case 3: currentScreen=SCR_TEMP_GRAPH; break;
          case 4: currentScreen=SCR_FRESH_GRAPH; break;
          case 5: currentScreen=SCR_SELL_LOG; break;
          case 6: currentScreen=SCR_PROD_HISTORY; break;
          case 7: currentScreen=SCR_DAY_REPORT; break;
          case 8: currentScreen=SCR_DEMO; break;
          case 9: physicsCursor=useAdaptiveEa?1:0;
                  currentScreen=SCR_PHYSICS_MODE; break;
          case 10:currentScreen=SCR_RESET_CONFIRM; break;
          case 11:currentScreen=SCR_HOME; break;
        }
      }
      if (back) currentScreen=SCR_PRODUCE_LIST;
      break;
    case SCR_SELL_LOG:
      if (up) recordSell();
      if (back||sel) currentScreen=SCR_PRODUCE_DETAIL;
      break;
    case SCR_PRICE:
      if (up)  {stockQty++;if(stockQty>STOCK_MAX)stockQty=STOCK_MAX;}
      if (down){stockQty--;if(stockQty<STOCK_MIN)stockQty=STOCK_MIN;}
      if (back||sel) currentScreen=SCR_PRODUCE_DETAIL;
      break;
    case SCR_PROD_HISTORY: case SCR_DAY_REPORT:
      if (back||sel) currentScreen=SCR_PRODUCE_DETAIL;
      break;
    case SCR_DEMO:
      if (up)  {demoSpeedIdx--;if(demoSpeedIdx<0)demoSpeedIdx=DEMO_SPEED_COUNT-1;}
      if (down){demoSpeedIdx++;if(demoSpeedIdx>=DEMO_SPEED_COUNT)demoSpeedIdx=0;}
      if (sel) demoMode=!demoMode;
      if (back) currentScreen=SCR_PRODUCE_DETAIL;
      break;
    case SCR_RESET_CONFIRM:
      if (sel) {resetProduce(); currentScreen=SCR_HOME;}
      if (back) currentScreen=SCR_PRODUCE_DETAIL;
      break;
    case SCR_STATUS: case SCR_ARRHENIUS:
    case SCR_TEMP_GRAPH: case SCR_FRESH_GRAPH:
      if (back||sel) currentScreen=SCR_PRODUCE_DETAIL;
      break;
    case SCR_PHYSICS_MODE:
      if (up||down) physicsCursor=(physicsCursor==0)?1:0;
      if (sel) {
        bool newMode=(physicsCursor==1);
        if (newMode!=useAdaptiveEa) {
          useAdaptiveEa=newMode;
          if (useAdaptiveEa) {
            adp_thermalEMA = 0.0f;  // v21: new EMA init
            adp_Ea_eff=DB[selectedProduce].Ea;
            adp_G_voc=adp_H_rh=adp_F_hist=1.0f;
          }
          confirmBeep();
          Serial.printf("[MODE] -> %s Ea\n",
            useAdaptiveEa?"ADAPTIVE":"FIXED");
        }
        currentScreen=SCR_PRODUCE_DETAIL;
      }
      if (back) currentScreen=SCR_PRODUCE_DETAIL;
      break;
  }
}

// ═══════════════════════════════════════════════════════
//  RENDER DISPATCHER
// ═══════════════════════════════════════════════════════
void drawCurrentScreen() {
  switch (currentScreen) {
    case SCR_HOME:          drawHomeScreen(); break;
    case SCR_PRODUCE_LIST:  drawScrollableMenu("Select Produce",produceNames,PRODUCE_COUNT,menuCursor,menuScroll); break;
    case SCR_PRODUCE_DETAIL:drawScrollableMenu(DB[selectedProduce].name,detailItems,DETAIL_COUNT,detailCursor,detailScroll); break;
    case SCR_STATUS:        drawStatusScreen(); break;
    case SCR_PRICE:         drawPriceScreen(); break;
    case SCR_ARRHENIUS:     drawArrheniusScreen(); break;
    case SCR_TEMP_GRAPH:    drawGraph(tempHistory,"Temp History",0,50,"C"); break;
    case SCR_FRESH_GRAPH:   drawGraph(freshHistory,"Freshness %",0,100,"%"); break;
    case SCR_SELL_LOG:      drawSellLogScreen(); break;
    case SCR_PROD_HISTORY:  drawProdHistoryScreen(); break;
    case SCR_DAY_REPORT:    drawDayReportScreen(); break;
    case SCR_RESET_CONFIRM: drawResetConfirm(); break;
    case SCR_DEMO:          drawDemoScreen(); break;
    case SCR_PHYSICS_MODE:  drawPhysicsModeScreen(); break;
  }
}

// ═══════════════════════════════════════════════════════
//  SETUP — v24: enhanced self-test + derived λ/γ params
// ═══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("PPSC v25 | Final Patent-Ready Firmware");
  Serial.println("  [v25] Hardware watchdog (30s) — auto-recover from hangs");
  Serial.println("  [v25] Persistent state — freshness survives power cycle");
  Serial.println("  [v25] NaN guards — bad sensor reads can't poison physics");
  Serial.println("  [v24] lambda: exp(-2.9957*2/tau_bio) — 20-40min EMA persistence");
  Serial.println("  [v24] gamma: R*T*ln(A_target)/Ea_base — 2-5% Ea depression");
  Serial.println("  [v24] eaMinFrac updated to F_ss per-produce (0.95-0.98)");
  Serial.println("  [v24] WiFi ADC debounce — rolling avg + outlier rejection");
  Serial.println("  [v24] dt cap at 60s — millis() rollover protection");
  Serial.println("  [v24] saveProdHistory() bug fix — saves OLD produce correctly");

  // v25: Initialize hardware watchdog. If loop() stalls >30s (I2C lockup,
  // SD card stall, infinite sensor wait), the chip reboots and resumes
  // from saved state. Essential for unattended vendor-cart deployment.
  // NOTE: ESP32 Arduino core 3.x already inits the Task WDT at boot (5s,
  // idle tasks subscribed), so we RECONFIGURE rather than deinit/init —
  // deinit() would fail (ESP_ERR_INVALID_STATE) with idle tasks attached.
  #if ESP_ARDUINO_VERSION_MAJOR >= 3
    esp_task_wdt_config_t wdt_cfg = {
      .timeout_ms = (uint32_t)(WDT_TIMEOUT_S * 1000),
      .idle_core_mask = 0,        // don't watch idle tasks, only our loop
      .trigger_panic = true       // reboot on timeout
    };
    esp_task_wdt_reconfigure(&wdt_cfg);
  #else
    esp_task_wdt_init(WDT_TIMEOUT_S, true);
  #endif
  esp_task_wdt_add(NULL);           // subscribe this (loop) task
  Serial.printf("[WDT] Watchdog armed: %ds timeout\n", WDT_TIMEOUT_S);
  Serial.println("  [v23] Auto-reset on produce switch (state carryover fix)");
  Serial.println("  [v23] USB power mode — battery disabled, locked Mode A");
  Serial.println("  [v22] G(VOC) & H(RH) = rate post-multipliers");
  Serial.println("  [v22] Only F(hist) modulates Ea");
  Serial.println("  [v22] Per-produce thermalStressK + recalibrated Ea");

  pinMode(BTN_UP,INPUT_PULLUP); pinMode(BTN_DOWN,INPUT_PULLUP);
  pinMode(BTN_SEL,INPUT_PULLUP); pinMode(BTN_BACK,INPUT_PULLUP);

  // RGB LED setup
  pinMode(RGB_R,OUTPUT); pinMode(RGB_G,OUTPUT); pinMode(RGB_B,OUTPUT);
  rgbWrite(RGB_R,false); rgbWrite(RGB_G,false); rgbWrite(RGB_B,false);

  // Startup RGB self-test
  Serial.printf("[RGB] Mode=%s  R=GPIO%d G=GPIO%d B=GPIO%d\n",
    RGB_COMMON_ANODE ? "Common Anode" : "Common Cathode",
    RGB_R, RGB_G, RGB_B);
  Serial.println("[RGB] Testing: Red...");
  rgbWrite(RGB_R,true); delay(300);
  rgbWrite(RGB_R,false);
  Serial.println("[RGB] Testing: Green...");
  rgbWrite(RGB_G,true); delay(300);
  rgbWrite(RGB_G,false);
  Serial.println("[RGB] Testing: Blue...");
  rgbWrite(RGB_B,true); delay(300);
  rgbWrite(RGB_B,false);
  Serial.println("[RGB] Testing: White (all on)...");
  rgbWrite(RGB_R,true); rgbWrite(RGB_G,true); rgbWrite(RGB_B,true);
  delay(300);
  rgbWrite(RGB_R,false); rgbWrite(RGB_G,false); rgbWrite(RGB_B,false);
  Serial.println("[RGB] Test done.");

  pinMode(BUZZER_PIN,OUTPUT); digitalWrite(BUZZER_PIN,LOW);

  // v21: MQ-135 power gate (only when battery mode active)
  #if USE_BATTERY
  pinMode(MQ135_PWR_PIN, OUTPUT);
  digitalWrite(MQ135_PWR_PIN, HIGH);  // power on by default
  #endif

  // ADC config (always needed for MQ-135)
  analogReadResolution(12);
  // v24: ADC_11db renamed to ADC_ATTEN_DB_11 in ESP32 core 3.x
  #if defined(ADC_ATTEN_DB_11)
    analogSetAttenuation(ADC_ATTEN_DB_11);
  #else
    analogSetAttenuation(ADC_11db);
  #endif
  Serial.printf("[MQ135] GPIO%d Warmup=%lus Offset=%d\n",
    MQ135_PIN, MQ135_WARMUP_MS/1000UL, MQ135_OFFSET);

  // v21: Initial battery check
  #if USE_BATTERY
  batteryPct = adcToBatteryPct(readBatteryMV());
  Serial.printf("[BATT] Initial: %.0f%%\n", batteryPct);
  #else
  Serial.println("[PWR] USB mode — battery disabled, locked PWR_MODE_A");
  #endif
  // Start in Mode A (full power)
  currentPowerMode = PWR_MODE_A;
  lastBattCheck = millis();

  for (int i=0;i<PROD_HIST_MAX;i++) prodHist[i].valid=false;

  setupWiFi();

  Wire.begin(21,22);
  if (!display.begin(0x3C,true)) {
    Serial.println("[ERR] OLED init failed");
    Serial.println("[ERR] Try addr 0x3D or check wiring");
    while(true);
  }
  display.setTextColor(SH110X_WHITE);
  display.setContrast(OLED_FULL_LEVEL);  // v25: start at full brightness
  lastButtonActivity = millis();         // v25: arm burn-in idle timer
  drawSplash();

  dht.begin();
  if (!rtc.begin()) Serial.println("[WARN] RTC not found");
  if (!rtc.isrunning()) rtc.adjust(DateTime(F(__DATE__),F(__TIME__)));

  // v24: DS1307 returns isrunning()==true even with dead CR2032 battery.
  // The oscillator keeps ticking with garbage register values, producing
  // dates like 2050, 2076, 2096 → corrupted FAT32 directory entries on SD.
  // Force-reset if year is outside a sane range.
  {
    DateTime rtcNow = rtc.now();
    if (rtcNow.year() < 2024 || rtcNow.year() > 2030) {
      Serial.printf("[RTC] Garbage date detected: %04d-%02d-%02d %02d:%02d:%02d\n",
        rtcNow.year(), rtcNow.month(), rtcNow.day(),
        rtcNow.hour(), rtcNow.minute(), rtcNow.second());
      Serial.println("[RTC] CR2032 likely dead — forcing reset to compile time");
      rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
      rtcNow = rtc.now();
      Serial.printf("[RTC] Set to: %04d-%02d-%02d %02d:%02d:%02d\n",
        rtcNow.year(), rtcNow.month(), rtcNow.day(),
        rtcNow.hour(), rtcNow.minute(), rtcNow.second());
    } else {
      Serial.printf("[RTC] OK: %04d-%02d-%02d %02d:%02d:%02d\n",
        rtcNow.year(), rtcNow.month(), rtcNow.day(),
        rtcNow.hour(), rtcNow.minute(), rtcNow.second());
    }
  }

  // v24: Explicit SPI init before SD — ESP32 core 3.x can fail without this
  SPI.begin(18, 19, 23, SD_CS);  // SCK, MISO, MOSI, CS

  sdOk = false;
  for (int attempt = 1; attempt <= 3; attempt++) {
    if (SD.begin(SD_CS, SPI, 4000000)) {  // 4MHz — safe for all SD cards
      sdOk = true;
      Serial.printf("[SD] Card found on attempt %d\n", attempt);
      break;
    }
    Serial.printf("[SD] Attempt %d failed — retrying...\n", attempt);
    delay(500);
  }

  if (!sdOk) {
    Serial.println("[SD] FAILED after 3 attempts. Check:");
    Serial.println("[SD]   1. Card inserted fully?");
    Serial.println("[SD]   2. Formatted as FAT32? (NOT exFAT/NTFS)");
    Serial.println("[SD]   3. Wiring: CS=5 SCK=18 MISO=19 MOSI=23");
  } else {
    // Verify we can actually write
    File test = SD.open("/PPSC_TEST.txt", FILE_WRITE);
    if (test) {
      test.println("PPSC v24 SD test OK");
      test.close();
      SD.remove("/PPSC_TEST.txt");
      Serial.println("[SD] Write test PASSED");
    } else {
      Serial.println("[SD] Write test FAILED — card may be read-only or corrupt");
      sdOk = false;
    }

    if (sdOk) {
      createLogFile();
      Serial.printf("[SD] Log file: %s\n", logFilename);
      lastSummaryDay = safeRTCNow().day();
      loadLastState();  // v25: resume freshness/EMA from before power cycle
    }
  }

  for (int i=0;i<GRAPH_POINTS;i++){tempHistory[i]=25.0;freshHistory[i]=100.0;}

  float bt=dht.readTemperature();
  if (!isnan(bt)) {prevTemp=bt; currentTemp=bt;}

  // v25: Only reset to fresh-start defaults if no valid state was restored.
  // After a power cycle, loadLastState() has already set EMA, cumulativeDeg,
  // freshness, and price from SD — clobbering them here would defeat resume.
  if (!stateRestored) {
    adp_thermalEMA = 0.0f;            // v21: EMA starts at 0 (new formula)
    gasMultiplier=1.0f; currentVOC=0.0f;
    adp_Ea_eff=DB[selectedProduce].Ea;
    adp_G_voc=adp_H_rh=adp_F_hist=1.0f;
    // v24 BUG FIX: initialize currentPrice and shelfLifeRemaining on startup.
    // Without this, both are 0.0 until the first updateDegradation() call (2s).
    currentPrice       = DB[selectedProduce].basePrice;
    shelfLifeRemaining = DB[selectedProduce].shelfLifeDays * 24.0f;
  } else {
    // Restored: still need transient display vars neutral until first read
    gasMultiplier=1.0f; currentVOC=0.0f;
    adp_Ea_eff=DB[selectedProduce].Ea;
    adp_G_voc=adp_H_rh=adp_F_hist=1.0f;
  }

  // v21: Precompute LUTs for initial produce
  precompute_lut2D(selectedProduce);
  precompute_lut1D(selectedProduce);

  // ═══ v24: ENHANCED STARTUP SELF-TEST ══════════════════
  // Test 1: Baseline rate at 25°C (same as v23)
  // Test 2: EMA persistence — verifies λ gives >20min window
  //   Simulates 1000 steps at T=T_stress+10K, then checks
  //   how many steps until EMA < 5% of peak (= persistence time)
  Serial.println("[SELFTEST] v24 parameter validation...");
  int passCount = 0;
  for (int i = 0; i < PRODUCE_COUNT; i++) {
    const Produce& p = DB[i];

    // Test 1: rate at 35°C — must show acceleration (>1.0)
    // v24 FIX: testing at 25°C trivially returns 1.0000 (k_now==k_ref).
    // 35°C verifies that Ea/k0 produce physically meaningful acceleration.
    float Ea_J = p.Ea * 1000.0f;
    float k_now = p.k0 * expf(-Ea_J / (R_GAS * 308.15f));  // 35°C
    float k_ref = p.k0 * expf(-Ea_J / (R_GAS * 298.15f));  // 25°C ref
    float rate = k_now / k_ref;
    bool passRate = (rate >= 1.2f && rate <= 15.0f);  // must accelerate

    // Test 2: EMA persistence — simulate heat then measure decay
    // Apply u=1.0 for 1000 steps (warm up EMA to near steady state)
    float ema_test = 0.0f;
    for (int s = 0; s < 1000; s++) {
      ema_test = p.lambda * ema_test + (1.0f - p.lambda) * 1.0f;
    }
    float peak = ema_test;
    // Now cool (u=0) and count steps until EMA < 5% of peak
    int stepsTo5pct = 0;
    float ema_decay = peak;
    while (ema_decay > peak * 0.05f && stepsTo5pct < 100000) {
      ema_decay = p.lambda * ema_decay;
      stepsTo5pct++;
    }
    float persistMinutes = stepsTo5pct * 2.0f / 60.0f; // Δt=2s per step
    bool passPersist = (persistMinutes >= 15.0f); // must be ≥15 min

    bool pass = passRate && passPersist;
    if (pass) passCount++;
    Serial.printf("[SELFTEST] %s: rate=%.4f %s | persist=%.1fmin %s\n",
      p.name, rate, passRate ? "OK" : "FAIL",
      persistMinutes, passPersist ? "OK" : "**FAIL**");
  }
  Serial.printf("[SELFTEST] %d/%d passed\n", passCount, PRODUCE_COUNT);
  if (passCount < PRODUCE_COUNT) {
    Serial.println("[SELFTEST] WARNING: Check lambda/gamma values!");
  } else {
    Serial.println("[SELFTEST] All produce: baseline + persistence PASS");
  }

  produceSetTime=lastDegTime=lastSensorRead=lastGraphLog=millis();
  lastBuzzTime=lastDemoUpdate=millis();
  mlBufIdx=0;

  Serial.println("[READY] v25 — watchdog + state resume + NaN guards");
  Serial.printf("[READY] Model: %s\n", MODEL_VERSION);
  Serial.printf("[READY] Physics: %s\n", PHYSICS_MODEL);
  Serial.printf("[READY] Battery: %s\n", USE_BATTERY ? "ENABLED (GPIO35)" : "DISABLED (USB)");
}

// ═══════════════════════════════════════════════════════
//  LOOP — v24
// ═══════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();

  esp_task_wdt_reset();   // v25: feed watchdog — proves loop is alive

  server.handleClient();
  handleMLSerial();

  // Sensor read + degradation (normal mode: every 2s)
  if (now - lastSensorRead > SENSOR_INTERVAL) {
    lastSensorRead = now;
    readSensors();
    if (!demoMode) {
      updateDegradation();
    }
    logToSD();
    checkDailySummary();
    // v25: persist state every ~30s (15 × 2s) — balances resume accuracy
    // against SD flash wear. Not every cycle (would burn the card).
    if (totalLogs % 15 == 0) saveLastState();
  }

  // Demo mode: fast degradation updates every 300ms
  if (demoMode && now - lastDemoUpdate > DEMO_UPDATE_MS) {
    lastDemoUpdate = now;
    updateDegradation();
  }

  // v21: Battery check every 10s
  if (now - lastBattCheck > BATT_CHECK_MS) {
    lastBattCheck = now;
    evaluatePowerMode();
  }

  unsigned long logInt = demoMode ? GRAPH_LOG_DEMO_MS : GRAPH_LOG_REAL_MS;
  if (now - lastGraphLog > logInt) {
    lastGraphLog = now;
    logGraphPoint();
  }

  updateLEDs();
  handleBuzzer();
  handleInput();
  updateOledDim();   // v25: dim OLED after idle (burn-in protection)
  drawCurrentScreen();
  delay(40);
}
