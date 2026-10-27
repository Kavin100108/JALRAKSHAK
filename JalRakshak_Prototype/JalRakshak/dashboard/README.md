# JalRakshak Dashboard User Guide

The **JalRakshak Dashboard** is a zero-dependency, single-page web application designed for real-time telemetry visualization, sensor calibration inspection, and incident remediation workflows.

---

## 1. Quick Launch Instructions

### Option A: Direct Browser Launch (Recommended for Demonstration)
Simply double-click `index.html` or open it directly in any modern desktop web browser:
```powershell
Start-Process "dashboard\index.html"
```
No Node.js, npm, Python server, or build step is required!

### Option B: Local Static HTTP Server
If you prefer running through a local web server:
```powershell
# Using Python (if installed):
python -m http.server 8000 --directory dashboard

# Or using Node.js npx:
npx serve dashboard
```
Then navigate to `http://localhost:8000` in your browser.

---

## 2. Operational Modes

The dropdown at the top right enables three distinct operating modes:

### 1. Mode: Synthetic Live Simulation (Default)
- Continuously generates realistic water-quality readings every 2 seconds with minor natural stochastic drift.
- Features an **Interactive Test Bench** with buttons to inject real-world failure modes:
  - 🌊 **Turbidity Silt Spike (14.5 NTU)**: Simulates monsoon stormwater sediment ingress.
  - 🧪 **Acidic Influx (pH 5.8)**: Simulates industrial effluent or pipeline corrosion.
  - ⚡ **Saline / EC Surge (1450 µS/cm)**: Simulates brackish water layer intrusion in deep borewells.
  - ⚠️ **Disconnect Temperature Probe**: Simulates loose 1-Wire wiring (-127°C error code).
  - ✅ **Return to Baseline**: Restores nominal drinking-water conditions.

### 2. Mode: Live ESP32 Web Serial
- Connects your browser directly to the physical ESP32 node via USB at **115200 baud**.
- Utilizes the standardized **W3C Web Serial API** (`navigator.serial`).
- **Browser Compatibility:**
  - ✅ Supported: Google Chrome (version 89+), Microsoft Edge (version 89+), Opera.
  - ❌ Not Supported: Mozilla Firefox, Apple Safari (Web Serial API is not implemented by these vendors).
- **Connection Steps:**
  1. Plug your ESP32 board into a USB port.
  2. Select `Mode: Live ESP32 Web Serial` in the dropdown.
  3. Click **Connect ESP32**.
  4. In the browser security prompt, choose the COM port (e.g., `Silicon Labs CP210x` or `CH340`) and click **Connect**.
  5. Live JSON frames from the ESP32 will immediately populate the cards and canvas chart.

### 3. Mode: CSV File Playback
- Allows historical inspection of logged test datasets.
- Click **Upload CSV** and select `data/sample_readings.csv`.
- The dashboard parses the timestamps, physical units, health flags, and renders the historical trajectory on the time-series canvas.

---

## 3. Incident Remediation & Verification Workflow

JalRakshak enforces an auditable human-in-the-loop workflow:
$$\text{SENSE} \longrightarrow \text{VALIDATE} \longrightarrow \text{COMPARE} \longrightarrow \text{ALERT} \longrightarrow \text{LOG} \longrightarrow \text{VERIFY} \longrightarrow \text{ACT}$$

When an anomaly is sustained past the debounce filter (default: 3 consecutive cycles):
1. **System Alert:** Visual badge transitions to `WARNING`, `CRITICAL`, or `FAULT`.
2. **Incident Entry:** A new record is registered in the **Incident Response & Verification Workflow** table.
3. **Operator Review:** Click **Review** on the incident row to open the remediation modal:
   - **Operator ID:** Record the reviewer name or badge number.
   - **Verification Reference Method:** Choose between Physical Inspection, Chemical Field Test Strip, Benchtop Calibrated Meter, or Laboratory Sample Assay.
   - **Verification Notes:** Document reference readings or visual observations.
   - **Corrective Action Taken:** Document field remediation (e.g., throttling inlet, backwashing sand filter, switching recharge well).
   - **Update Status:** Advance from `ACKNOWLEDGED` $\rightarrow$ `VERIFIED` $\rightarrow$ `CLOSED`.

---

## 4. Configurable Thresholds

Click **⚙️ Thresholds** in the top metadata bar to adjust illustrative warning and critical boundaries for:
- pH (Critical Low, Warning Low, Warning High, Critical High)
- Turbidity (Warning High, Critical High in NTU)
- Electrical Conductivity (Warning High, Critical High in µS/cm)

Threshold changes take effect immediately on incoming telemetry.

---

## 5. Data Export

Click **⬇️ Export** to download:
- **Export Readings (CSV):** Dumps the in-memory telemetry buffer.
- **Export Incidents (CSV):** Dumps the audit trail of logged incidents and human verifications.
