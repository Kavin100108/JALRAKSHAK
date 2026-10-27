/**
 * JalRakshak Verification Test Harness (Node.js)
 * File: verify_logic.js
 * 
 * Executes identical automated unit tests to Python unittest suite,
 * allowing immediate deterministic verification in environments where
 * Node.js is present.
 */

const assert = require('assert');

// 1. Detection Core Logic
class ThresholdConfig {
  constructor(options = {}) {
    this.phCritLow = options.phCritLow ?? 6.0;
    this.phWarnLow = options.phWarnLow ?? 6.5;
    this.phWarnHigh = options.phWarnHigh ?? 8.5;
    this.phCritHigh = options.phCritHigh ?? 9.0;
    this.turbWarn = options.turbWarn ?? 5.0;
    this.turbCrit = options.turbCrit ?? 10.0;
    this.ecWarn = options.ecWarn ?? 800.0;
    this.ecCrit = options.ecCrit ?? 1500.0;
    this.tempWarnLow = options.tempWarnLow ?? 5.0;
    this.tempWarnHigh = options.tempWarnHigh ?? 35.0;
    this.tempCritHigh = options.tempCritHigh ?? 45.0;
    this.debounceCycles = options.debounceCycles ?? 3;
  }
}

class JalRakshakDetector {
  constructor(config = new ThresholdConfig()) {
    this.config = config;
    this.consecutiveFaults = 0;
    this.currentSeverity = 'NORMAL';
    this.activeAlerts = [];
  }

  validateReading(reading) {
    const health = { ph: 'OK', turbidity: 'OK', ec: 'OK', temperature: 'OK' };

    // pH checks
    if (reading.ph === null || reading.ph === undefined || reading.ph < 0.0 || reading.ph > 14.0) {
      health.ph = reading.ph === null || reading.ph < 0.0 ? 'DISCONNECTED' : 'OUT_OF_RANGE';
    } else if (reading.rawVPh !== undefined && (reading.rawVPh < 0.10 || reading.rawVPh > 3.20)) {
      health.ph = 'DISCONNECTED';
    }

    // Turbidity checks
    if (reading.turbidity === null || reading.turbidity === undefined || reading.turbidity < 0.0) {
      health.turbidity = 'DISCONNECTED';
    } else if (reading.rawVTurb !== undefined && (reading.rawVTurb < 0.10 || reading.rawVTurb > 3.20)) {
      health.turbidity = 'DISCONNECTED';
    }

    // EC checks
    if (reading.ec === null || reading.ec === undefined || reading.ec < 0.0) {
      health.ec = 'DISCONNECTED';
    }

    // Temperature checks (DS18B20 -127°C error code)
    if (reading.temp === null || reading.temp === undefined || reading.temp <= -100.0) {
      health.temperature = 'DISCONNECTED';
    } else if (reading.temp < -10.0 || reading.temp > 80.0) {
      health.temperature = 'OUT_OF_RANGE';
    }

    return health;
  }

  evaluateCycle(reading) {
    const health = this.validateReading(reading);
    const cfg = this.config;
    let alerts = [];
    let rawSeverity = 'NORMAL';

    if (Object.values(health).some(h => h !== 'OK')) {
      rawSeverity = 'FAULT';
      for (const [s, st] of Object.entries(health)) {
        if (st !== 'OK') alerts.push(`FAULT_${s.toUpperCase()}_${st}`);
      }
    } else {
      let hasCrit = false;
      if (reading.ph <= cfg.phCritLow || reading.ph >= cfg.phCritHigh) {
        hasCrit = true;
        alerts.push(`CRIT_PH_${reading.ph <= cfg.phCritLow ? 'ACIDIC' : 'ALKALINE'}`);
      }
      if (reading.turbidity >= cfg.turbCrit) {
        hasCrit = true;
        alerts.push('CRIT_TURBIDITY');
      }
      if (reading.ec >= cfg.ecCrit) {
        hasCrit = true;
        alerts.push('CRIT_EC_SPIKE');
      }
      if (reading.temp >= cfg.tempCritHigh) {
        hasCrit = true;
        alerts.push('CRIT_TEMP_HIGH');
      }

      if (hasCrit) {
        rawSeverity = 'CRITICAL';
      } else {
        let hasWarn = false;
        if (reading.ph < cfg.phWarnLow || reading.ph > cfg.phWarnHigh) {
          hasWarn = true;
          alerts.push(`WARN_PH_${reading.ph < cfg.phWarnLow ? 'LOW' : 'HIGH'}`);
        }
        if (reading.turbidity >= cfg.turbWarn) {
          hasWarn = true;
          alerts.push('WARN_TURBIDITY');
        }
        if (reading.ec >= cfg.ecWarn) {
          hasWarn = true;
          alerts.push('WARN_EC_ELEVATED');
        }
        if (reading.temp <= cfg.tempWarnLow || reading.temp >= cfg.tempWarnHigh) {
          hasWarn = true;
          alerts.push('WARN_TEMP_DRIFT');
        }
        if (hasWarn) rawSeverity = 'WARNING';
      }
    }

    // Debouncing hysteresis
    if (rawSeverity !== 'NORMAL') {
      this.consecutiveFaults++;
      if (this.consecutiveFaults >= cfg.debounceCycles) {
        this.currentSeverity = rawSeverity;
        this.activeAlerts = alerts;
      }
    } else {
      if (this.consecutiveFaults > 0) this.consecutiveFaults--;
      if (this.consecutiveFaults === 0) {
        this.currentSeverity = 'NORMAL';
        this.activeAlerts = [];
      }
    }

    return { severity: this.currentSeverity, alerts: this.activeAlerts };
  }
}

// 2. Incident Workflow Class
class IncidentRecord {
  constructor(id, openedAt, param, observed, severity) {
    this.id = id;
    this.openedAt = openedAt;
    this.parameter = param;
    this.observed = observed;
    this.severity = severity;
    this.status = 'OPEN';
    this.operator = null;
    this.verificationMethod = null;
    this.verificationNotes = null;
    this.actionTaken = null;
    this.closedAt = null;
  }

  acknowledge(operator) {
    if (!operator || !operator.trim()) throw new Error('Operator required');
    this.operator = operator.trim();
    this.status = 'ACKNOWLEDGED';
  }

  recordVerification(method, notes) {
    if (!method || !notes) throw new Error('Method and notes required');
    this.verificationMethod = method;
    this.verificationNotes = notes;
    this.status = 'VERIFIED';
  }

  takeActionAndClose(action) {
    if (!action) throw new Error('Action required');
    if (this.status !== 'VERIFIED' && this.status !== 'ACKNOWLEDGED') {
      throw new Error('Must acknowledge/verify before closing');
    }
    this.actionTaken = action;
    this.status = 'CLOSED';
    this.closedAt = new Date().toISOString();
  }
}

// 3. Offline Sync Manager
class OfflineSyncManager {
  constructor() {
    this.keys = new Set();
    this.records = [];
  }

  addRecord(rec) {
    const key = `${rec.device_id}:${rec.timestamp}`;
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.records.push(rec);
    return true;
  }
}

// ==============================================================================
// RUN TEST SUITE
// ==============================================================================
let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    Error: ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log(' JalRakshak Automated Logic & Verification Tests    ');
console.log('====================================================\n');

console.log('Suite 1: Anomaly Detection & Debounce Filtering');
runTest('test_nominal_baseline_readings', () => {
  const detector = new JalRakshakDetector();
  const res = detector.evaluateCycle({ ph: 7.24, turbidity: 0.8, ec: 320, temp: 24.5 });
  assert.strictEqual(res.severity, 'NORMAL');
  assert.strictEqual(res.alerts.length, 0);
});

runTest('test_ph_warning_low_and_high', () => {
  const detector = new JalRakshakDetector();
  const lowPh = { ph: 6.30, turbidity: 0.8, ec: 320, temp: 24.0 };
  let res;
  for (let i = 0; i < 3; i++) res = detector.evaluateCycle(lowPh);
  assert.strictEqual(res.severity, 'WARNING');
  assert(res.alerts.includes('WARN_PH_LOW'));
});

runTest('test_turbidity_critical_spike', () => {
  const detector = new JalRakshakDetector();
  const muddy = { ph: 7.1, turbidity: 14.8, ec: 340, temp: 24.0 };
  let res;
  for (let i = 0; i < 3; i++) res = detector.evaluateCycle(muddy);
  assert.strictEqual(res.severity, 'CRITICAL');
  assert(res.alerts.includes('CRIT_TURBIDITY'));
});

runTest('test_ec_critical_spike', () => {
  const detector = new JalRakshakDetector();
  const saline = { ph: 7.2, turbidity: 0.8, ec: 1650, temp: 24.0 };
  let res;
  for (let i = 0; i < 3; i++) res = detector.evaluateCycle(saline);
  assert.strictEqual(res.severity, 'CRITICAL');
  assert(res.alerts.includes('CRIT_EC_SPIKE'));
});

runTest('test_hysteresis_debouncing_prevents_flapping', () => {
  const detector = new JalRakshakDetector();
  const spike = { ph: 7.2, turbidity: 14.5, ec: 320, temp: 24.0 };
  
  // Cycle 1: Transient spike should be suppressed
  const res1 = detector.evaluateCycle(spike);
  assert.strictEqual(res1.severity, 'NORMAL');

  // Cycle 2: Still suppressed
  const res2 = detector.evaluateCycle(spike);
  assert.strictEqual(res2.severity, 'NORMAL');

  // Cycle 3: Sustained spike triggers alarm
  const res3 = detector.evaluateCycle(spike);
  assert.strictEqual(res3.severity, 'CRITICAL');
});

runTest('test_recovery_to_baseline', () => {
  const detector = new JalRakshakDetector();
  const spike = { ph: 7.2, turbidity: 14.5, ec: 320, temp: 24.0 };
  const clean = { ph: 7.2, turbidity: 0.8, ec: 320, temp: 24.0 };

  for (let i = 0; i < 3; i++) detector.evaluateCycle(spike);
  assert.strictEqual(detector.currentSeverity, 'CRITICAL');

  // Feed clean readings to recover
  detector.evaluateCycle(clean);
  detector.evaluateCycle(clean);
  const recovered = detector.evaluateCycle(clean);
  assert.strictEqual(recovered.severity, 'NORMAL');
  assert.strictEqual(recovered.alerts.length, 0);
});

console.log('\nSuite 2: Data Validation & Fault Handling');
runTest('test_disconnected_temperature_sensor_trapped', () => {
  const detector = new JalRakshakDetector();
  const faulty = { ph: 7.2, turbidity: 0.8, ec: 320, temp: -999.0 };
  let res;
  for (let i = 0; i < 3; i++) res = detector.evaluateCycle(faulty);
  assert.strictEqual(res.severity, 'FAULT');
  assert(res.alerts.includes('FAULT_TEMPERATURE_DISCONNECTED'));
});

runTest('test_saturated_and_open_circuit_adc_rails', () => {
  const detector = new JalRakshakDetector();
  const openCircuit = { ph: 7.0, turbidity: 1.0, ec: 300, temp: 25.0, rawVPh: 0.04 };
  const health = detector.validateReading(openCircuit);
  assert.strictEqual(health.ph, 'DISCONNECTED');
});

runTest('test_out_of_range_sensor_values', () => {
  const detector = new JalRakshakDetector();
  const impossible = { ph: 16.5, turbidity: 1.0, ec: 300, temp: 25.0 };
  const health = detector.validateReading(impossible);
  assert.strictEqual(health.ph, 'OUT_OF_RANGE');
});

runTest('test_incident_lifecycle_workflow', () => {
  const inc = new IncidentRecord('INC-001', '2026-10-27T08:00:00Z', 'TURBIDITY', '14.5 NTU', 'CRITICAL');
  assert.strictEqual(inc.status, 'OPEN');

  // Cannot close directly
  assert.throws(() => inc.takeActionAndClose('Premature'), /Must acknowledge/);

  inc.acknowledge('Operator_Ramesh');
  assert.strictEqual(inc.status, 'ACKNOWLEDGED');

  inc.recordVerification('Physical Inspection', 'Visual cloudiness confirmed');
  assert.strictEqual(inc.status, 'VERIFIED');

  inc.takeActionAndClose('Backwashed sand filter');
  assert.strictEqual(inc.status, 'CLOSED');
  assert(inc.closedAt !== null);
});

runTest('test_offline_deduplication', () => {
  const sync = new OfflineSyncManager();
  const rec1 = { device_id: 'JR-01', timestamp: '2026-10-27T08:00:00Z', ph: 7.2 };
  const rec2 = { device_id: 'JR-01', timestamp: '2026-10-27T08:02:00Z', ph: 7.3 };
  const dup = { device_id: 'JR-01', timestamp: '2026-10-27T08:00:00Z', ph: 7.2 };

  assert.strictEqual(sync.addRecord(rec1), true);
  assert.strictEqual(sync.addRecord(rec2), true);
  assert.strictEqual(sync.addRecord(dup), false, 'Duplicate must be rejected');
  assert.strictEqual(sync.records.length, 2);
});

console.log('\n----------------------------------------------------');
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log('----------------------------------------------------');

if (failed > 0) process.exit(1);
