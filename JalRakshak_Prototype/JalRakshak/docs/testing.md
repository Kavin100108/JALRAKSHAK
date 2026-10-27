# JalRakshak Testing & Quality Assurance Plan

This document outlines the testing strategy, test coverage, and execution instructions for the **JalRakshak** water-quality monitoring system.

---

## 1. Testing Philosophy & Tiers

The project adheres to a 3-tier testing hierarchy to guarantee deterministic software logic while acknowledging physical hardware realities:

```
+--------------------------------------------------------------+
| Tier 3: Hardware-in-the-Loop (HIL) Physical Validation        |
| - Potentiometer simulation, buffer solutions, salt injection  |
| - Requires: Physical ESP32, breadboard, probes, USB cable    |
+--------------------------------------------------------------+
                               ▲
+--------------------------------------------------------------+
| Tier 2: Dashboard End-to-End Simulation Bench                |
| - Interactive fault injection in browser (Canvas/DOM)        |
| - CSV playback of synthetic failure datasets                 |
| - Requires: Any modern web browser                           |
+--------------------------------------------------------------+
                               ▲
+--------------------------------------------------------------+
| Tier 1: Automated Algorithmic & Validation Unit Tests        |
| - Range checks, debouncing (hysteresis), fault detection    |
| - CSV parsing/export, incident lifecycle transitions         |
| - Deterministic, zero-dependency, headless                   |
| - Requires: Python standard library (unittest) or Node.js    |
+--------------------------------------------------------------+
```

---

## 2. Automated Software Unit Tests

The automated test suite is housed in the `tests/` directory:
- `test_anomaly_detection.py`: Tests threshold violations, multi-parameter alerts, consecutive reading debounce logic, and baseline recovery.
- `test_data_validation.py`: Tests malformed data handling, disconnected sensor signatures (DS18B20 -127°C, open-circuit ADC rails), timestamp integrity, incident lifecycle progression, and offline deduplication.

### 2.1 Running Tests on Windows via Python
The Python test suite uses the standard library `unittest` module, so **no external packages or virtual environment are required**:

```powershell
# Run the complete test suite using Python unittest
python -m unittest discover -s tests -v
```

If you have `pytest` installed:
```powershell
pytest tests/ -v
```

### 2.2 Running Tests on Windows via Node.js (Alternative)
For environments where Python is not in the system PATH, we provide an equivalent Node.js test harness (`tests/verify_logic.js`) that validates the exact same algorithmic rules:
```powershell
node tests/verify_logic.js
```

---

## 3. Test Cases & Coverage Matrix

| Test Suite | Test Case Identifier | Objective | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **Anomaly Detection** | `test_nominal_baseline_readings` | Nominal values (pH 7.2, Turb 0.8, EC 320, Temp 24°C) | Severity: `NORMAL`, Alerts: `NONE` |
| **Anomaly Detection** | `test_ph_warning_low_and_high` | pH 6.4 (Warn Low) and pH 8.6 (Warn High) | Severity: `WARNING`, Flag: `WARN_PH` |
| **Anomaly Detection** | `test_turbidity_critical_spike` | Turbidity $\ge 10.0\text{ NTU}$ | Severity: `CRITICAL`, Flag: `CRIT_TURBIDITY` |
| **Anomaly Detection** | `test_ec_surge_and_temperature_compensation` | EC surge to $1600\ \mu\text{S/cm}$ | Severity: `CRITICAL`, Flag: `CRIT_EC_SPIKE` |
| **Anomaly Detection** | `test_hysteresis_debouncing` | Single transient electrical spike (1 cycle) vs sustained spike (3 cycles) | 1 cycle: Filtered (remains `NORMAL`); 3 cycles: Triggers `WARNING`/`CRITICAL` |
| **Anomaly Detection** | `test_recovery_to_baseline` | Abnormal state returns to normal baseline | Hysteresis counter decrements to 0; Severity clears back to `NORMAL` |
| **Data Validation** | `test_disconnected_temperature_sensor` | DS18B20 returns $-127.0^\circ\text{C}$ or $-999.0^\circ\text{C}$ | Health: `DISCONNECTED`, Overall: `FAULT` (Not misclassified as freezing water) |
| **Data Validation** | `test_saturated_adc_rail_fault` | Analog voltage $< 0.10\text{V}$ or $> 3.20\text{V}$ | Health: `DISCONNECTED` or `OUT_OF_RANGE` |
| **Data Validation** | `test_csv_parsing_and_schema_validation` | Parses `sample_readings.csv` with missing or corrupt fields | Gracefully skips comments, validates types, catches corrupt rows |
| **Data Validation** | `test_incident_lifecycle_transitions` | State transitions: `OPEN` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `VERIFIED` $\rightarrow$ `CLOSED` | Strict progression enforced; operator notes required before closing |
| **Data Validation** | `test_offline_deduplication` | Duplicate telemetry packets with identical timestamp & device ID | Cache catches duplicate record and rejects re-insertion |

---

## 4. Hardware-in-the-Loop (HIL) Physical Validation

When deploying physical hardware, perform the following verification procedures:

### Test HIL-1: Open-Circuit Sensor Detection
1. Power the ESP32 node via USB and open the Serial Monitor (115200 baud).
2. Unplug the pH BNC cable from the 4502C board.
3. **Pass Criteria:** Firmware must report `"health":{"ph":"DISCONNECTED"}` or `"OUT_OF_RANGE"`, illuminate the Red LED, and emit a double chirp.

### Test HIL-2: DS18B20 Disconnect Fault
1. Disconnect the yellow signal jumper wire from GPIO 4.
2. **Pass Criteria:** Temperature must register `-999.0` (fault trapped), health must show `"DISCONNECTED"`, and no negative temperature alert is triggered.

### Test HIL-3: Turbidity Optical Blockage
1. Place a strip of opaque dark paper inside the turbidity sensor optical gap.
2. **Pass Criteria:** Analog voltage drops below $1.5\text{V}$; turbidity value rises above $10\text{ NTU}$; after 3 cycles (6 seconds), Red LED blinks and buzzer sounds urgent pulse.

### Test HIL-4: Saline Solution Injection (EC Check)
1. Immerse the EC probe in a cup of tap water (reads $\approx 250 - 400\ \mu\text{S/cm}$).
2. Dissolve 1/4 teaspoon of table salt (NaCl) and stir.
3. **Pass Criteria:** EC reading surges past $1500\ \mu\text{S/cm}$; Yellow $\rightarrow$ Red LED transitions; alert is logged on MicroSD.

---

## 5. Software Verification Results in Current Environment

Because Git and Python are not registered in the system environment PATH on the host machine at invocation time, algorithmic verification is provided both as standard Python `unittest` scripts (for systems with Python installed) and executable Node.js validation scripts.

See `tests/verify_logic.js` for immediate execution and pass/fail reporting.
