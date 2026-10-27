# JalRakshak
### Intelligent Water Quality Monitoring & Early Warning System

> **A low-cost, offline-first open-source monitoring node for community water sources.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: ESP32](https://img.shields.io/badge/Platform-ESP32-red.svg)](https://www.espressif.com/)
[![Framework: Arduino](https://img.shields.io/badge/Framework-Arduino-teal.svg)](https://www.arduino.cc/)
[![Tests: Passing](https://img.shields.io/badge/Tests-11%2F11%20Passed-brightgreen.svg)](tests/)

---

> [!CAUTION]
> **IMPORTANT SCIENTIFIC & HEALTH DISCLAIMER**  
> **JalRakshak is an educational, research, and early-warning monitoring prototype.** It is **NOT** a certified drinking-water safety or potability instrument.
> - It **cannot detect microbiological pathogens** (such as *E. coli*, coliform bacteria, *Vibrio cholerae*, cysts, or viruses).
> - It **cannot detect trace toxic heavy metals** (such as arsenic, lead, cadmium, mercury) or organic pesticides at regulatory thresholds.
> - Sensor data provides gross indicative screening only. **Readings must always be validated against certified laboratory reference assays or field test kits before declaring water safe for human consumption.**

---

## 1. Project Overview & Problem Statement

Over 160 million people across rural and semi-urban India depend on community overhead water tanks (OHTs), public borewells, schools, and local distribution reservoirs. Formal laboratory water quality tests are typically conducted only once every 6 to 12 months. During the intervening months, upstream pipeline ruptures, monsoon silt runoff, industrial effluent leaks, or sewage seepage can contaminate drinking supplies unnoticed for days before waterborne illness breaks out.

Commercial online water quality stations cost between ₹1,50,000 and ₹5,00,000+, depend on continuous cloud/cellular internet, and require skilled engineers.

**JalRakshak** solves this gap by providing an affordable (**₹5,000–₹10,000 BOM**), completely **offline-first** monitoring node that continuously tracks:
1. **pH** (Acidity / Alkalinity)
2. **Turbidity** (Suspended solids, clarity, silt)
3. **Electrical Conductivity (EC / TDS)** (Dissolved ions, mineral ingress, salinity)
4. **Water Temperature** (Compensation baseline)

When readings deviate from configurable baselines, JalRakshak triggers **immediate local audiovisual alarms** (LEDs and buzzer), logs records locally to **MicroSD / flash storage**, and streams real-time data to a **browser dashboard** via USB Web Serial.

---

## 2. Key Features

- **Continuous 4-Parameter Sensing:** Multi-sampled analog reading with 1-Wire digital temperature compensation ($2.0\%/^\circ\text{C}$).
- **Offline-First Resilience:** Zero cloud dependence; operates indefinitely without internet.
- **Fail-Safe Fault Detection:** Distinguishes physical probe failures (disconnected cables, rail shorts, DS18B20 -127°C) from genuine chemical water anomalies.
- **Debounced Anomaly Engine:** Configurable hysteresis filter suppresses transient noise spikes and prevents alert flapping.
- **Zero-Dependency Web Dashboard:** Single-page HTML5/Canvas application running entirely in the browser; supports direct ESP32 Web Serial, synthetic simulation, and CSV replay.
- **Auditable Incident Workflow:** Built-in **SENSE $\rightarrow$ ALERT $\rightarrow$ ACKNOWLEDGE $\rightarrow$ VERIFY $\rightarrow$ ACT $\rightarrow$ CLOSE** operator remediation workflow.
- **Dual Offline Storage:** MicroSD FAT32 logging with automatic fallback to internal ESP32 SPIFFS flash.

---

## 3. System Architecture & Pipeline

```
+---------------+     +-----------------------+     +-------------------+
| WATER PROBES  | --> | ESP32 CONTROLLER      | --> | OPERATOR & UI     |
| - pH Electrode|     | 1. SENSE (Filter ADC) |     | - Local LEDs/Alert|
| - Turbidity   |     | 2. VALIDATE (Faults)  |     | - Piezo Buzzer    |
| - EC Probe    |     | 3. COMPARE (Hysteresis|     | - 0.96" OLED      |
| - DS18B20 Temp|     | 4. ALERT (Actuators)  |     | - MicroSD Logging |
|               |     | 5. LOG (Serial/Flash) |     | - Web Serial UI   |
+---------------+     +-----------------------+     +-------------------+
```

---

## 4. Hardware Bill of Materials (BOM) & Indicative Pricing

Designed for a single-node assembly within an accessible **₹5,000 to ₹15,000** budget:

| Component | Specification | Qty | Indicative Price (INR) |
| :--- | :--- | :---: | :---: |
| **ESP32 DevKit Board** | ESP-WROOM-32 (30-pin or 38-pin), Micro-USB | 1 | ₹450 – ₹650 |
| **pH Sensor Module** | Analog pH-4502C signal board + BNC glass probe | 1 | ₹1,600 – ₹2,400 |
| **Turbidity Sensor** | Optical turbidity module (TS-300B / Gravity type) | 1 | ₹800 – ₹1,400 |
| **EC / TDS Sensor** | Analog Electrical Conductivity meter module & probe | 1 | ₹900 – ₹1,800 |
| **Temperature Sensor** | DS18B20 waterproof stainless probe (1m cable) | 1 | ₹180 – ₹350 |
| **OLED Display** | 0.96" SSD1306 I2C 128x64 display | 1 | ₹250 – ₹450 |
| **MicroSD Module** | SPI MicroSD breakout board + 8GB/16GB card | 1 | ₹280 – ₹500 |
| **Status LEDs & Buzzers**| Green, Yellow, Red 5mm LEDs, 330Ω resistors, buzzer | 1 set | ₹70 – ₹150 |
| **Passives & Dividers**| 4.7kΩ, 10kΩ, 20kΩ resistors, 100nF, 10µF capacitors | 1 set | ₹50 – ₹100 |
| **Power Supply** | 5V 2.0A Micro-USB power adapter / DC buck | 1 | ₹250 – ₹500 |
| **Weatherproof Box** | IP65 enclosure with PG7/PG9 nylon cable glands | 1 | ₹400 – ₹800 |
| **Total Indicative Cost**| **Complete Single-Node Hardware Package** | | **₹5,230 – ₹9,600** |

---

## 5. Wiring & Suggested Pin Mapping

> [!IMPORTANT]
> **ADC1 CONFLICT SAFETY:** All analog sensors are mapped strictly to **ADC1** pins (`GPIO 34`, `GPIO 35`, `GPIO 32`). The ESP32's ADC2 peripheral conflicts with Wi-Fi/Bluetooth hardware and cannot be used reliably when wireless features are enabled.

```
ESP32 DevKit Pin  Connected Peripheral
----------------  -------------------------------------------------------------
GPIO 34 (ADC1)    pH Sensor Analog Output (via 10k/20k voltage divider to 3.3V)
GPIO 35 (ADC1)    Turbidity Sensor Analog Output (via 10k/20k divider to 3.3V)
GPIO 32 (ADC1)    EC / TDS Sensor Analog Output (0 - 2.3V safe)
GPIO 4            DS18B20 1-Wire Data (requires 4.7kΩ pull-up to 3.3V)
GPIO 25           Green LED (Normal Status) via 330Ω resistor
GPIO 26           Yellow LED (Warning Status) via 330Ω resistor
GPIO 27           Red LED (Critical Alert / Fault) via 330Ω resistor
GPIO 14           Active Piezo Buzzer (+)
GPIO 21           I2C SDA (OLED Display)
GPIO 22           I2C SCL (OLED Display)
GPIO 5            MicroSD Chip Select (CS)
GPIO 18           MicroSD SPI SCK
GPIO 19           MicroSD SPI MISO
GPIO 23           MicroSD SPI MOSI
3.3V Rail         Power for OLED, DS18B20, MicroSD
VIN (5V Rail)     Power for pH-4502C and Turbidity optical modules
GND               Common Single-Point Star Ground
```

*For comprehensive wiring instructions, probe separation distances, and galvanic isolation notes, see [docs/hardware_setup.md](docs/hardware_setup.md).*

---

## 6. Arduino IDE & ESP32 Firmware Configuration

1. Install **Arduino IDE 2.x** and add ESP32 board support via Boards Manager (`esp32` by Espressif Systems).
2. Install the required libraries via **Library Manager**:
   - `OneWire`
   - `DallasTemperature`
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
3. Copy the configuration template:
   ```powershell
   cd firmware
   Copy-Item config.example.h config.h
   ```
4. Open `firmware/JalRakshak.ino` in Arduino IDE.
5. Select your board under **Tools > Board > esp32 > ESP32 Dev Module**.
6. Select the active COM port under **Tools > Port**.
7. Click **Upload**. Open **Serial Monitor** at **115200 baud** to view real-time JSON frames.

---

## 7. Sensor Calibration

Before field deployment, sensors must be calibrated against verified reference solutions:
- **pH:** Two-point calibration using standard **pH 7.00** and **pH 4.01** buffer solutions. Record voltages and update `PH_CALIBRATION_SLOPE` and `PH_CALIBRATION_INTERCEPT` in `config.h`.
- **Turbidity:** Zero-point calibration in pure distilled water ($0\text{ NTU}$) and span check against reference standard.
- **Conductivity (EC):** Submerge in **$1413\ \mu\text{S/cm}$ KCl reference solution** with temperature normalization at $25.0^\circ\text{C}$.
- **Temperature:** Validation in an ice water bath ($0.0^\circ\text{C}$).

*Detailed calibration formulas and step-by-step procedures are documented in [docs/calibration.md](docs/calibration.md).*

---

## 8. Dashboard Launch & Demonstration

The JalRakshak Dashboard requires **zero compilation or backend servers**.

### Quick Launch:
Open `dashboard/index.html` in your web browser:
```powershell
Start-Process "dashboard\index.html"
```

### Operational Modes:
1. **Mode: Synthetic Live Simulation (Default):**
   - Click the interactive test bench buttons (e.g., *Turbidity Silt Spike*, *Acidic Influx*, *Disconnect Probe*) to inject real-world faults and observe immediate card transitions, canvas charts, and debounced alert triggers.
2. **Mode: Live ESP32 Web Serial:**
   - Plug the ESP32 into your computer via USB (using Chrome or Edge).
   - Select `Live ESP32 Web Serial` and click **Connect ESP32**.
   - Live sensor telemetry populates directly into the browser in real time!
3. **Mode: CSV File Playback:**
   - Select `CSV File Playback`, click **Upload CSV**, and load `data/sample_readings.csv` to review historical contamination events.

---

## 9. Automated Testing & Verification

The repository includes a comprehensive, deterministic unit test suite testing threshold breaches, debouncing, recovery, fault handling, CSV round-tripping, and offline deduplication.

### Running with Python (Standard Library):
```powershell
python -m unittest discover -s tests -v
```

### Running with Node.js (Verified in Current Environment):
```powershell
node tests/verify_logic.js
```
**Outcome:** `11 Passed, 0 Failed` (100% pass rate).

---

## 10. Publishing to GitHub (Windows PowerShell Instructions)

To publish this project to your own GitHub account:

### Step 1: Verify Git Installation
```powershell
git --version
```
*If Git is not installed, download and install it from [git-scm.com](https://git-scm.com/download/win).*

### Step 2: Open Project Directory
```powershell
cd c:\Users\Kavin\Downloads\HSC\JalRakshak
```

### Step 3: Initialize Repository & Commit Files
```powershell
git init
git add .
git commit -m "feat: initial commit of JalRakshak prototype repository"
```

### Step 4: Link Your GitHub Repository & Push
1. Go to [github.com/new](https://github.com/new) and create a new empty repository named `JalRakshak` (do not initialize with README or license).
2. Run the following commands (replace `<YOUR_GITHUB_USERNAME>` with your actual GitHub username):
```powershell
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/JalRakshak.git
git push -u origin main
```

---

## 11. Troubleshooting Common Issues

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **ESP32 upload fails (`Connecting...___`)** | Bootloader pin not pulled low | Press and hold the physical **BOOT** button on the ESP32 while uploading until the percentage progress appears. |
| **Web Serial button says unsupported** | Incompatible browser | Use **Google Chrome** or **Microsoft Edge** on desktop; Web Serial is not supported in Firefox or Safari. |
| **pH reads erratic voltage spikes** | EC and pH probe ground loop | Separate EC and pH probes by $\ge 10\text{cm}$ in water; ensure single-point star grounding. |
| **Temperature displays -999°C / ERR** | DS18B20 missing pull-up resistor | Connect a **4.7kΩ resistor between GPIO 4 and 3.3V**; verify 1-Wire pin wiring. |
| **Turbidity shows high NTU in clean water** | Bubbles on optical lens | Tap probe gently to release bubbles; clean lenses with isopropyl alcohol. |

---

## 12. Roadmap

- [x] v1.0: 4-parameter sensing, local audiovisual alerts, offline SD/flash logging, Web Serial dashboard, test bench.
- [ ] v1.1: Automatic pH glass bulb impedance diagnostic for early biofouling detection.
- [ ] v2.0: Long-range low-power **LoRaWAN** telemetry node for remote village clusters.
- [ ] v2.1: Integrated solar MPPT battery management board with LiFePO4 cells.

---

## 13. License & Contributing

- **License:** Open-source under the [MIT License](LICENSE).
- **Contributions:** Contributions, issue reports, and field trial feedback are warmly welcomed. Please open an issue or pull request following standard GitHub flow.
