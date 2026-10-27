# JalRakshak Automated Test Suite

This directory contains deterministic software unit tests for the **JalRakshak** sensing pipeline, anomaly detection algorithms, hardware fault trapping, CSV data exchange, and incident remediation workflows.

All tests are designed to execute **headlessly without requiring physical hardware**.

---

## 1. Test Suite Structure

```
tests/
├── jalrakshak_core.py        # Python algorithmic reference implementation
├── test_anomaly_detection.py # Tests for thresholds, debounce, recovery, compound faults
├── test_data_validation.py   # Tests for disconnected probes, ADC saturation, CSV, deduplication
├── verify_logic.js           # Companion Node.js test harness (zero-dependency executable)
└── README.md                 # Test execution documentation
```

---

## 2. Running Tests on Windows

### Option A: Using Python `unittest` (Standard Library)
No virtual environment or third-party packages required:
```powershell
# Open repository directory
cd JalRakshak

# Discover and run all unit tests
python -m unittest discover -s tests -v
```

### Option B: Using `pytest`
If you have `pytest` installed:
```powershell
pytest tests/ -v
```

### Option C: Using Node.js Test Harness
If Python is not installed or not in your system `PATH`, run the equivalent Node.js verification suite:
```powershell
node tests/verify_logic.js
```

---

## 3. Test Cases Covered

### Suite 1: Anomaly Detection (`test_anomaly_detection.py`)
1. **Nominal Baseline:** Verifies clean drinking-water readings produce `NORMAL` status with zero active alerts.
2. **pH Warning Bounds:** Tests warning triggers for pH $< 6.5$ (low) and pH $> 8.5$ (high).
3. **Turbidity Critical:** Tests critical trigger for turbidity $\ge 10.0\text{ NTU}$.
4. **Conductivity Spike:** Tests critical alert for EC $\ge 1500\ \mu\text{S/cm}$.
5. **Hysteresis Debouncing:** Validates that transient 1-cycle and 2-cycle noise spikes are suppressed, and that alarms require 3 sustained abnormal cycles.
6. **Baseline Recovery:** Validates that as readings return to nominal range, the hysteresis counter clears to 0 and severity returns to `NORMAL`.
7. **Compound Influx:** Verifies multiple simultaneous parameter breaches (e.g. acidic pH + high turbidity).

### Suite 2: Data Validation & Lifecycle (`test_data_validation.py`)
1. **Disconnected Temperature Sensor:** Validates that DS18B20 `-127.0°C` and `-999.0°C` errors are categorized as `DISCONNECTED` hardware faults rather than freezing water.
2. **ADC Rail Saturation & Open-Circuit:** Validates that voltages below $0.10\text{V}$ (broken lead) or above $3.20\text{V}$ (rail short) are trapped.
3. **Out-of-Range Sensor Values:** Validates rejection of implausible physical values (e.g., pH $> 14.0$).
4. **Missing Timestamps:** Validates fallback to system ISO-8601 UTC timestamp.
5. **Incident Response Workflow:** Validates strict progression: `OPEN` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `VERIFIED` $\rightarrow$ `CLOSED`. Ensures incidents cannot be closed without operator name, reference verification method, and action notes.
6. **Offline Deduplication:** Validates that duplicate telemetry records sharing identical `(device_id, timestamp)` keys are rejected during offline data synchronization.
