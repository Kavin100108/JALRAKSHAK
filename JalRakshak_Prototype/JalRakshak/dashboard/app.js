/**
 * ==============================================================================
 * JalRakshak: Intelligent Water Quality Monitoring Dashboard
 * File: app.js
 * Description: Client-side logic for real-time visualization, Web Serial link,
 * synthetic simulation bench, CSV import/export, and incident verification workflow.
 * ==============================================================================
 */

// Application State
const state = {
  mode: 'simulated', // 'simulated' | 'serial' | 'csv'
  deviceId: 'JR-NODE-01',
  sampleCount: 0,
  
  // Current Live / Simulated Readings
  current: {
    ph: 7.22,
    turbidity: 0.85,
    ec: 325.0,
    temp: 24.50,
    health: { ph: 'OK', turbidity: 'OK', ec: 'OK', temp: 'OK' },
    status: 'NORMAL',
    alerts: 'NONE',
    timestamp: new Date().toISOString()
  },

  // Active Simulation State
  simInjection: null,
  simTimer: null,

  // Historical Ring Buffer for Charting (Max 40 points)
  history: [],
  maxHistoryPoints: 40,

  // Configurable Illustrative Thresholds
  thresholds: {
    phCritLow: 6.0,
    phWarnLow: 6.5,
    phWarnHigh: 8.5,
    phCritHigh: 9.0,
    turbWarn: 5.0,
    turbCrit: 10.0,
    ecWarn: 800.0,
    ecCrit: 1500.0,
    tempWarnLow: 5.0,
    tempWarnHigh: 35.0,
    tempCritHigh: 45.0,
    debounceCount: 3
  },

  // Fault debouncing counter
  consecutiveAnomalies: 0,
  lastTriggeredParam: null,

  // Incidents Store
  incidents: [
    {
      id: 'INC-2026-001',
      openedAt: '2026-10-27T08:45:00Z',
      deviceId: 'JR-NODE-01',
      parameter: 'TURBIDITY',
      observed: '15.40 NTU',
      severity: 'CRITICAL',
      status: 'CLOSED',
      operator: 'Ramesh_Operator',
      verifiedAt: '2026-10-27T09:05:00Z',
      verificationMethod: 'Physical Inspection',
      verificationNotes: 'Visual cloudiness confirmed from construction runoff',
      actionTaken: 'Inlet throttled; gravity settling basin engaged',
      closedAt: '2026-10-27T11:30:00Z'
    }
  ],

  // Web Serial Port Handle
  serialPort: null,
  serialReader: null,
  serialKeepReading: false
};

// ==============================================================================
// DOM ELEMENT REFERENCES
// ==============================================================================
const elements = {
  modeSelect: document.getElementById('operatingModeSelect'),
  btnConnectSerial: document.getElementById('btnConnectSerial'),
  csvUploadWrapper: document.getElementById('csvUploadWrapper'),
  csvFileInput: document.getElementById('csvFileInput'),
  connectionStatusBadge: document.getElementById('connectionStatusBadge'),
  connectionStatusText: document.getElementById('connectionStatusText'),
  simControlsPanel: document.getElementById('simControlsPanel'),

  lblDeviceId: document.getElementById('lblDeviceId'),
  lblLastTimestamp: document.getElementById('lblLastTimestamp'),
  lblOverallStatus: document.getElementById('lblOverallStatus'),
  lblActiveAlerts: document.getElementById('lblActiveAlerts'),
  lblOpenIncidentCount: document.getElementById('lblOpenIncidentCount'),

  cardPh: document.getElementById('cardPh'),
  valPh: document.getElementById('valPh'),
  badgePhStatus: document.getElementById('badgePhStatus'),
  healthPh: document.getElementById('healthPh'),

  cardTurbidity: document.getElementById('cardTurbidity'),
  valTurbidity: document.getElementById('valTurbidity'),
  badgeTurbStatus: document.getElementById('badgeTurbStatus'),
  healthTurb: document.getElementById('healthTurb'),

  cardEc: document.getElementById('cardEc'),
  valEc: document.getElementById('valEc'),
  badgeEcStatus: document.getElementById('badgeEcStatus'),
  healthEc: document.getElementById('healthEc'),

  cardTemp: document.getElementById('cardTemp'),
  valTemp: document.getElementById('valTemp'),
  badgeTempStatus: document.getElementById('badgeTempStatus'),
  healthTemp: document.getElementById('healthTemp'),

  trendChartCanvas: document.getElementById('trendChartCanvas'),
  chkShowPh: document.getElementById('chkShowPh'),
  chkShowTurb: document.getElementById('chkShowTurb'),
  chkShowEc: document.getElementById('chkShowEc'),
  chkShowTemp: document.getElementById('chkShowTemp'),

  incidentsTableBody: document.getElementById('incidentsTableBody'),
  incidentModal: document.getElementById('incidentModal'),
  incidentForm: document.getElementById('incidentForm'),
  modalIncidentTitle: document.getElementById('modalIncidentTitle'),
  modalIncidentSummary: document.getElementById('modalIncidentSummary'),
  modalIncidentId: document.getElementById('modalIncidentId'),
  inputOperatorName: document.getElementById('inputOperatorName'),
  selectVerificationMethod: document.getElementById('selectVerificationMethod'),
  inputVerificationNotes: document.getElementById('inputVerificationNotes'),
  inputActionTaken: document.getElementById('inputActionTaken'),
  selectIncidentStatus: document.getElementById('selectIncidentStatus'),
  btnModalClose: document.getElementById('btnModalClose'),
  btnCancelModal: document.getElementById('btnCancelModal'),

  thresholdsModal: document.getElementById('thresholdsModal'),
  thresholdsForm: document.getElementById('thresholdsForm'),
  btnOpenThresholds: document.getElementById('btnOpenThresholds'),
  btnThresholdsClose: document.getElementById('btnThresholdsClose'),
  btnCancelThresholds: document.getElementById('btnCancelThresholds'),

  btnResetSimulation: document.getElementById('btnResetSimulation'),
  btnExportMenu: document.getElementById('btnExportMenu'),
  exportDropdownMenu: document.getElementById('exportDropdownMenu'),
  btnExportReadingsCsv: document.getElementById('btnExportReadingsCsv'),
  btnExportIncidentsCsv: document.getElementById('btnExportIncidentsCsv')
};

// ==============================================================================
// INITIALIZATION
// ==============================================================================
function initApp() {
  setupEventListeners();
  renderIncidentsTable();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Prepopulate initial history points for smooth initial trend rendering
  const now = Date.now();
  for (let i = 20; i >= 1; i--) {
    const t = new Date(now - i * 2000).toISOString();
    state.history.push({
      timestamp: t,
      ph: 7.2 + (Math.random() * 0.06 - 0.03),
      turbidity: 0.82 + (Math.random() * 0.08 - 0.04),
      ec: 324 + (Math.random() * 6 - 3),
      temp: 24.5 + (Math.random() * 0.2 - 0.1),
      status: 'NORMAL'
    });
  }

  // Start in default simulated mode
  switchMode('simulated');
  renderDashboard();
}

// ==============================================================================
// EVENT LISTENERS & MODE SWITCHING
// ==============================================================================
function setupEventListeners() {
  // Mode Selection
  elements.modeSelect.addEventListener('change', (e) => {
    switchMode(e.target.value);
  });

  // Web Serial
  elements.btnConnectSerial.addEventListener('click', toggleSerialConnection);

  // CSV Upload
  elements.csvFileInput.addEventListener('change', handleCsvUpload);

  // Thresholds Modal
  elements.btnOpenThresholds.addEventListener('click', () => {
    populateThresholdForm();
    elements.thresholdsModal.classList.remove('hidden');
  });
  elements.btnThresholdsClose.addEventListener('click', () => elements.thresholdsModal.classList.add('hidden'));
  elements.btnCancelThresholds.addEventListener('click', () => elements.thresholdsModal.classList.add('hidden'));
  elements.thresholdsForm.addEventListener('submit', handleThresholdsSubmit);

  // Incident Modal
  elements.btnModalClose.addEventListener('click', () => elements.incidentModal.classList.add('hidden'));
  elements.btnCancelModal.addEventListener('click', () => elements.incidentModal.classList.add('hidden'));
  elements.incidentForm.addEventListener('submit', handleIncidentFormSubmit);

  // Simulation Fault Injection Buttons
  document.querySelectorAll('.btn-sim').forEach((btn) => {
    btn.addEventListener('click', () => {
      const injection = btn.getAttribute('data-inject');
      injectSimulationFault(injection);
    });
  });

  elements.btnResetSimulation.addEventListener('click', () => {
    injectSimulationFault('restore_normal');
  });

  // Chart Visibility Toggles
  [elements.chkShowPh, elements.chkShowTurb, elements.chkShowEc, elements.chkShowTemp].forEach((chk) => {
    chk.addEventListener('change', drawChart);
  });

  // Export Menu
  elements.btnExportMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.exportDropdownMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    elements.exportDropdownMenu.classList.add('hidden');
  });

  elements.btnExportReadingsCsv.addEventListener('click', exportReadingsToCsv);
  elements.btnExportIncidentsCsv.addEventListener('click', exportIncidentsToCsv);
}

function switchMode(newMode) {
  state.mode = newMode;

  // Clear existing simulation timer if switching away
  if (state.simTimer) {
    clearInterval(state.simTimer);
    state.simTimer = null;
  }

  // Update UI control visibility
  elements.btnConnectSerial.classList.toggle('hidden', newMode !== 'serial');
  elements.csvUploadWrapper.classList.toggle('hidden', newMode !== 'csv');
  elements.simControlsPanel.classList.toggle('hidden', newMode !== 'simulated');

  if (newMode === 'simulated') {
    elements.connectionStatusBadge.className = 'status-pill status-simulated';
    elements.connectionStatusText.textContent = 'Simulated Data Stream (2s)';
    startSimulation();
  } else if (newMode === 'serial') {
    elements.connectionStatusBadge.className = 'status-pill status-disconnected';
    elements.connectionStatusText.textContent = 'ESP32 Disconnected';
  } else if (newMode === 'csv') {
    elements.connectionStatusBadge.className = 'status-pill status-simulated';
    elements.connectionStatusText.textContent = 'CSV Playback Mode';
  }
}

// ==============================================================================
// SIMULATION ENGINE (TEST BENCH)
// ==============================================================================
function startSimulation() {
  if (state.simTimer) clearInterval(state.simTimer);

  state.simTimer = setInterval(() => {
    generateSimulatedReading();
    processNewReading();
  }, 2000);
}

function injectSimulationFault(type) {
  state.simInjection = type === 'restore_normal' ? null : type;
  const note = type === 'restore_normal' ? 'Restored clean baseline.' : `Injected: ${type}`;
  console.log(`[SIMULATION] ${note}`);
}

function generateSimulatedReading() {
  state.sampleCount++;
  const t = new Date().toISOString();
  
  // Baseline random walk
  let ph = 7.22 + (Math.random() * 0.08 - 0.04);
  let turb = 0.84 + (Math.random() * 0.10 - 0.05);
  let ec = 328.0 + (Math.random() * 8.0 - 4.0);
  let temp = 24.50 + (Math.random() * 0.20 - 0.10);
  let health = { ph: 'OK', turbidity: 'OK', ec: 'OK', temp: 'OK' };

  // Apply Fault Injections
  if (state.simInjection === 'turbidity_spike') {
    turb = 14.8 + (Math.random() * 1.2 - 0.6);
  } else if (state.simInjection === 'ph_acidic') {
    ph = 5.75 + (Math.random() * 0.1 - 0.05);
  } else if (state.simInjection === 'ec_surge') {
    ec = 1480.0 + (Math.random() * 40.0 - 20.0);
  } else if (state.simInjection === 'temp_fault') {
    temp = -999.0;
    health.temp = 'DISCONNECTED';
  }

  state.current = {
    ph: Number(ph.toFixed(2)),
    turbidity: Number(turb.toFixed(2)),
    ec: Number(ec.toFixed(1)),
    temp: Number(temp.toFixed(2)),
    health,
    timestamp: t
  };
}

// ==============================================================================
// WEB SERIAL API (DIRECT ESP32 HARDWARE LINK)
// ==============================================================================
async function toggleSerialConnection() {
  if (state.serialPort) {
    disconnectSerial();
    return;
  }

  // Check browser support
  if (!('serial' in navigator)) {
    alert('Web Serial API is not supported in this browser.\n\nPlease use Google Chrome, Microsoft Edge, or Opera (Desktop) to connect directly to the ESP32 via USB.');
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    state.serialPort = port;
    state.serialKeepReading = true;
    elements.btnConnectSerial.innerHTML = '<span class="btn-icon">🔌</span> Disconnect';
    elements.connectionStatusBadge.className = 'status-pill status-connected';
    elements.connectionStatusText.textContent = 'ESP32 Connected (115200)';

    readSerialStream(port);
  } catch (err) {
    console.error('Serial connection error:', err);
    alert('Failed to connect to serial port: ' + err.message);
  }
}

async function readSerialStream(port) {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();
  state.serialReader = reader;

  let buffer = '';

  try {
    while (state.serialKeepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete trailing fragment

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const json = JSON.parse(trimmed);
              handleSerialJson(json);
            } catch (jsonErr) {
              // Ignore corrupted lines
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Serial read loop interrupted:', err);
  } finally {
    reader.releaseLock();
  }
}

function handleSerialJson(json) {
  if (!json.readings) return;

  state.deviceId = json.deviceId || state.deviceId;
  state.current = {
    ph: json.readings.ph !== null ? json.readings.ph : -1.0,
    turbidity: json.readings.turbidity !== null ? json.readings.turbidity : -1.0,
    ec: json.readings.ec !== null ? json.readings.ec : -1.0,
    temp: json.readings.temperature !== null ? json.readings.temperature : -999.0,
    health: json.health || { ph: 'OK', turbidity: 'OK', ec: 'OK', temp: 'OK' },
    status: json.status?.overall || 'NORMAL',
    alerts: json.status?.alerts || 'NONE',
    timestamp: new Date().toISOString()
  };

  processNewReading();
}

async function disconnectSerial() {
  state.serialKeepReading = false;
  if (state.serialReader) {
    await state.serialReader.cancel();
  }
  if (state.serialPort) {
    await state.serialPort.close();
    state.serialPort = null;
  }
  elements.btnConnectSerial.innerHTML = '<span class="btn-icon">🔌</span> Connect ESP32';
  elements.connectionStatusBadge.className = 'status-pill status-disconnected';
  elements.connectionStatusText.textContent = 'ESP32 Disconnected';
}

// ==============================================================================
// CSV UPLOAD & PLAYBACK
// ==============================================================================
function handleCsvUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    parseAndLoadCsv(text);
  };
  reader.readAsText(file);
}

function parseAndLoadCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0 && !line.startsWith('#'));
  if (lines.length < 2) {
    alert('Invalid CSV file: Insufficient data rows.');
    return;
  }

  const header = lines[0].split(',').map(h => h.trim());
  const idxTs = header.indexOf('timestamp');
  const idxPh = header.indexOf('ph');
  const idxTurb = header.indexOf('turbidity_ntu');
  const idxEc = header.indexOf('ec_us_cm');
  const idxTemp = header.indexOf('temperature_c');

  if (idxPh === -1 || idxTurb === -1 || idxEc === -1 || idxTemp === -1) {
    alert('CSV missing required columns: ph, turbidity_ntu, ec_us_cm, temperature_c');
    return;
  }

  state.history = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < header.length) continue;

    const ts = idxTs !== -1 ? cols[idxTs] : new Date().toISOString();
    const ph = parseFloat(cols[idxPh]);
    const turb = parseFloat(cols[idxTurb]);
    const ec = parseFloat(cols[idxEc]);
    const temp = parseFloat(cols[idxTemp]);

    state.history.push({
      timestamp: ts,
      ph: isNaN(ph) ? 7.0 : ph,
      turbidity: isNaN(turb) ? 1.0 : turb,
      ec: isNaN(ec) ? 300.0 : ec,
      temp: isNaN(temp) ? 25.0 : temp,
      status: 'NORMAL'
    });
  }

  // Update current reading to the last line of CSV
  const last = state.history[state.history.length - 1];
  state.current = {
    ph: last.ph,
    turbidity: last.turbidity,
    ec: last.ec,
    temp: last.temp,
    health: {
      ph: last.ph < 0 ? 'DISCONNECTED' : 'OK',
      turbidity: last.turbidity < 0 ? 'DISCONNECTED' : 'OK',
      ec: last.ec < 0 ? 'DISCONNECTED' : 'OK',
      temp: last.temp <= -100 ? 'DISCONNECTED' : 'OK'
    },
    timestamp: last.timestamp
  };

  processNewReading();
  alert(`Loaded ${state.history.length} records from CSV successfully.`);
}

// ==============================================================================
// CORE LOGIC: VALIDATION & ANOMALY DETECTION
// ==============================================================================
function processNewReading() {
  const c = state.current;
  const th = state.thresholds;

  let overall = 'NORMAL';
  let alertMessages = [];
  let triggeredParam = null;

  // 1. Check Hardware Faults
  if (c.health.ph !== 'OK' || c.health.turbidity !== 'OK' || c.health.temp !== 'OK') {
    overall = 'FAULT';
    if (c.health.ph !== 'OK') alertMessages.push('pH Probe Disconnected');
    if (c.health.turbidity !== 'OK') alertMessages.push('Turbidity Sensor Fault');
    if (c.health.temp !== 'OK') alertMessages.push('Temperature Probe Disconnected');
    triggeredParam = 'HARDWARE';
  } else {
    // 2. Evaluate Critical Thresholds
    if (c.ph <= th.phCritLow) {
      overall = 'CRITICAL';
      alertMessages.push(`pH Critical Low (${c.ph} <= ${th.phCritLow})`);
      triggeredParam = 'PH';
    } else if (c.ph >= th.phCritHigh) {
      overall = 'CRITICAL';
      alertMessages.push(`pH Critical High (${c.ph} >= ${th.phCritHigh})`);
      triggeredParam = 'PH';
    }

    if (c.turbidity >= th.turbCrit) {
      overall = 'CRITICAL';
      alertMessages.push(`Turbidity Critical High (${c.turbidity} >= ${th.turbCrit} NTU)`);
      triggeredParam = 'TURBIDITY';
    }

    if (c.ec >= th.ecCrit) {
      overall = 'CRITICAL';
      alertMessages.push(`Conductivity Critical High (${c.ec} >= ${th.ecCrit} µS/cm)`);
      triggeredParam = 'EC';
    }

    if (c.temp >= th.tempCritHigh) {
      overall = 'CRITICAL';
      alertMessages.push(`Water Temp Critical High (${c.temp} >= ${th.tempCritHigh} °C)`);
      triggeredParam = 'TEMPERATURE';
    }

    // 3. Evaluate Warning Thresholds (if not already Critical)
    if (overall === 'NORMAL') {
      if (c.ph < th.phWarnLow || c.ph > th.phWarnHigh) {
        overall = 'WARNING';
        alertMessages.push(`pH Warning Deviation (${c.ph})`);
        triggeredParam = 'PH';
      } else if (c.turbidity >= th.turbWarn) {
        overall = 'WARNING';
        alertMessages.push(`Turbidity Warning (${c.turbidity} NTU)`);
        triggeredParam = 'TURBIDITY';
      } else if (c.ec >= th.ecWarn) {
        overall = 'WARNING';
        alertMessages.push(`Conductivity Warning (${c.ec} µS/cm)`);
        triggeredParam = 'EC';
      } else if (c.temp >= th.tempWarnHigh || c.temp <= th.tempWarnLow) {
        overall = 'WARNING';
        alertMessages.push(`Temperature Warning (${c.temp} °C)`);
        triggeredParam = 'TEMPERATURE';
      }
    }
  }

  // Anomaly Debouncing
  if (overall !== 'NORMAL') {
    state.consecutiveAnomalies++;
    if (state.consecutiveAnomalies >= th.debounceCount) {
      state.current.status = overall;
      state.current.alerts = alertMessages.join(' | ');

      // Trigger automatic incident creation if critical/fault and not duplicate
      if (overall === 'CRITICAL' || overall === 'FAULT') {
        registerIncident(triggeredParam, overall, alertMessages[0]);
      }
    }
  } else {
    state.consecutiveAnomalies = Math.max(0, state.consecutiveAnomalies - 1);
    if (state.consecutiveAnomalies === 0) {
      state.current.status = 'NORMAL';
      state.current.alerts = 'NONE';
    }
  }

  // Update Trend History (Keep last maxHistoryPoints)
  state.history.push({
    timestamp: c.timestamp,
    ph: c.ph,
    turbidity: c.turbidity,
    ec: c.ec,
    temp: c.temp,
    status: state.current.status
  });

  if (state.history.length > state.maxHistoryPoints) {
    state.history.shift();
  }

  renderDashboard();
}

// Automatically register incident in workflow table
function registerIncident(param, severity, summary) {
  // Check if active incident already open for this parameter to prevent flapping
  const hasOpen = state.incidents.some(inc => inc.parameter === param && inc.status !== 'CLOSED');
  if (hasOpen) return;

  const newId = `INC-${new Date().getFullYear()}-${String(state.incidents.length + 1).padStart(3, '0')}`;
  let observedVal = '';
  if (param === 'PH') observedVal = `${state.current.ph}`;
  else if (param === 'TURBIDITY') observedVal = `${state.current.turbidity} NTU`;
  else if (param === 'EC') observedVal = `${state.current.ec} µS/cm`;
  else if (param === 'TEMPERATURE') observedVal = `${state.current.temp} °C`;
  else observedVal = 'Sensor Fault';

  const incident = {
    id: newId,
    openedAt: state.current.timestamp,
    deviceId: state.deviceId,
    parameter: param,
    observed: observedVal,
    severity: severity,
    status: 'OPEN',
    operator: 'Unassigned',
    verifiedAt: null,
    verificationMethod: 'Pending Verification',
    verificationNotes: 'Pending field operator review',
    actionTaken: 'Pending corrective intervention',
    closedAt: null
  };

  state.incidents.unshift(incident);
  renderIncidentsTable();
}

// ==============================================================================
// RENDERING & UI UPDATES
// ==============================================================================
function renderDashboard() {
  const c = state.current;
  const th = state.thresholds;

  // Metadata
  elements.lblDeviceId.textContent = state.deviceId;
  const dateObj = new Date(c.timestamp);
  elements.lblLastTimestamp.textContent = isNaN(dateObj) ? c.timestamp : dateObj.toLocaleTimeString();

  // Overall Status Pill
  elements.lblOverallStatus.textContent = c.status;
  elements.lblOverallStatus.className = `badge badge-${c.status.toLowerCase()}`;
  elements.lblActiveAlerts.textContent = c.alerts;

  // 1. pH Card
  elements.valPh.textContent = c.health.ph === 'OK' ? c.ph.toFixed(2) : 'ERR';
  elements.healthPh.textContent = c.health.ph;
  elements.healthPh.className = c.health.ph === 'OK' ? 'text-success' : 'text-danger';
  let phCardStatus = 'NORMAL';
  if (c.health.ph !== 'OK') phCardStatus = 'FAULT';
  else if (c.ph <= th.phCritLow || c.ph >= th.phCritHigh) phCardStatus = 'CRITICAL';
  else if (c.ph < th.phWarnLow || c.ph > th.phWarnHigh) phCardStatus = 'WARNING';
  updateCardAppearance(elements.cardPh, elements.badgePhStatus, phCardStatus);

  // 2. Turbidity Card
  elements.valTurbidity.textContent = c.health.turbidity === 'OK' ? c.turbidity.toFixed(2) : 'ERR';
  elements.healthTurb.textContent = c.health.turbidity;
  elements.healthTurb.className = c.health.turbidity === 'OK' ? 'text-success' : 'text-danger';
  let turbCardStatus = 'NORMAL';
  if (c.health.turbidity !== 'OK') turbCardStatus = 'FAULT';
  else if (c.turbidity >= th.turbCrit) turbCardStatus = 'CRITICAL';
  else if (c.turbidity >= th.turbWarn) turbCardStatus = 'WARNING';
  updateCardAppearance(elements.cardTurbidity, elements.badgeTurbStatus, turbCardStatus);

  // 3. EC Card
  elements.valEc.textContent = c.health.ec === 'OK' ? c.ec.toFixed(1) : 'ERR';
  elements.healthEc.textContent = c.health.ec;
  elements.healthEc.className = c.health.ec === 'OK' ? 'text-success' : 'text-danger';
  let ecCardStatus = 'NORMAL';
  if (c.health.ec !== 'OK') ecCardStatus = 'FAULT';
  else if (c.ec >= th.ecCrit) ecCardStatus = 'CRITICAL';
  else if (c.ec >= th.ecWarn) ecCardStatus = 'WARNING';
  updateCardAppearance(elements.cardEc, elements.badgeEcStatus, ecCardStatus);

  // 4. Temperature Card
  elements.valTemp.textContent = c.health.temp === 'OK' ? c.temp.toFixed(1) : 'ERR';
  elements.healthTemp.textContent = c.health.temp;
  elements.healthTemp.className = c.health.temp === 'OK' ? 'text-success' : 'text-danger';
  let tempCardStatus = 'NORMAL';
  if (c.health.temp !== 'OK') tempCardStatus = 'FAULT';
  else if (c.temp >= th.tempCritHigh) tempCardStatus = 'CRITICAL';
  else if (c.temp >= th.tempWarnHigh || c.temp <= th.tempWarnLow) tempCardStatus = 'WARNING';
  updateCardAppearance(elements.cardTemp, elements.badgeTempStatus, tempCardStatus);

  // Redraw Canvas
  drawChart();
}

function updateCardAppearance(card, badge, status) {
  card.classList.remove('card-warning', 'card-critical', 'card-fault');
  if (status !== 'NORMAL') {
    card.classList.add(`card-${status.toLowerCase()}`);
  }
  badge.textContent = status;
  badge.className = `badge badge-${status.toLowerCase()}`;
}

// ==============================================================================
// CANVAS CHART ENGINE (ZERO DEPENDENCIES)
// ==============================================================================
function resizeCanvas() {
  const canvas = elements.trendChartCanvas;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = 280 * dpr;
  drawChart();
}

function drawChart() {
  const canvas = elements.trendChartCanvas;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 20, right: 30, bottom: 35, left: 45 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Background grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= 4; y++) {
    const yPos = padding.top + (plotHeight / 4) * y;
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(width - padding.right, yPos);
    ctx.stroke();
  }

  // Draw X Axis Baseline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#64748b';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('100%', padding.left - 8, padding.top + 5);
  ctx.fillText('50%', padding.left - 8, padding.top + plotHeight / 2 + 3);
  ctx.fillText('0%', padding.left - 8, height - padding.bottom);

  ctx.textAlign = 'center';
  ctx.fillText('Historical Monitoring Window (T-40 to Present)', padding.left + plotWidth / 2, height - 10);

  if (state.history.length < 2) {
    ctx.restore();
    return;
  }

  // Normalized bounds for multi-parameter overlay
  // pH: 4.0 - 10.0
  // Turbidity: 0.0 - 20.0 NTU
  // EC: 0.0 - 2000.0 µS/cm
  // Temp: 10.0 - 45.0 °C
  const bounds = {
    ph: { min: 4.0, max: 10.0 },
    turbidity: { min: 0.0, max: 20.0 },
    ec: { min: 0.0, max: 2000.0 },
    temp: { min: 10.0, max: 45.0 }
  };

  function getPoint(index, val, paramMin, paramMax) {
    const x = padding.left + (index / (state.history.length - 1)) * plotWidth;
    const clamped = Math.max(paramMin, Math.min(paramMax, val));
    const normalized = (clamped - paramMin) / (paramMax - paramMin);
    const y = height - padding.bottom - normalized * plotHeight;
    return { x, y };
  }

  function renderSeries(key, color, bound) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let started = false;
    state.history.forEach((pt, i) => {
      const val = pt[key];
      if (val === null || val <= -100) return; // Skip error/disconnected points

      const { x, y } = getPoint(i, val, bound.min, bound.max);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }

  if (elements.chkShowPh.checked) renderSeries('ph', '#38bdf8', bounds.ph);
  if (elements.chkShowTurb.checked) renderSeries('turbidity', '#f59e0b', bounds.turbidity);
  if (elements.chkShowEc.checked) renderSeries('ec', '#a855f7', bounds.ec);
  if (elements.chkShowTemp.checked) renderSeries('temp', '#10b981', bounds.temp);

  ctx.restore();
}

// ==============================================================================
// INCIDENT MANAGEMENT & WORKFLOW
// ==============================================================================
function renderIncidentsTable() {
  const tbody = elements.incidentsTableBody;
  tbody.innerHTML = '';

  let openCount = 0;

  state.incidents.forEach((inc) => {
    if (inc.status !== 'CLOSED') openCount++;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono"><strong>${inc.id}</strong></td>
      <td class="font-mono">${new Date(inc.openedAt).toLocaleTimeString()}</td>
      <td><strong>${inc.parameter}</strong></td>
      <td class="font-mono">${inc.observed}</td>
      <td><span class="badge badge-${inc.severity.toLowerCase()}">${inc.severity}</span></td>
      <td><span class="badge ${getStatusClass(inc.status)}">${inc.status}</span></td>
      <td title="${inc.verificationNotes || ''}">
        <em>${inc.verificationMethod || 'None'}</em>
      </td>
      <td title="${inc.actionTaken || ''}">
        ${truncateText(inc.actionTaken || 'None', 30)}
      </td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="openIncidentModal('${inc.id}')">
          ${inc.status === 'CLOSED' ? '👁️ View' : '✏️ Review'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  elements.lblOpenIncidentCount.textContent = openCount;
}

function getStatusClass(status) {
  if (status === 'CLOSED') return 'badge-normal';
  if (status === 'VERIFIED') return 'badge-warning';
  if (status === 'ACKNOWLEDGED') return 'badge-warning';
  return 'badge-critical';
}

function truncateText(str, max) {
  return str.length > max ? str.substring(0, max) + '…' : str;
}

// Window global helper for inline table button onclick
window.openIncidentModal = function(id) {
  const inc = state.incidents.find(i => i.id === id);
  if (!inc) return;

  elements.modalIncidentId.value = inc.id;
  elements.modalIncidentTitle.textContent = `Incident Remediation: ${inc.id}`;
  elements.modalIncidentSummary.innerHTML = `
    <strong>Parameter:</strong> ${inc.parameter} &bull; 
    <strong>Observed:</strong> ${inc.observed} &bull; 
    <strong>Severity:</strong> <span class="badge badge-${inc.severity.toLowerCase()}">${inc.severity}</span><br>
    <small>Triggered at ${new Date(inc.openedAt).toLocaleString()} on device ${inc.deviceId}</small>
  `;

  elements.inputOperatorName.value = inc.operator !== 'Unassigned' ? inc.operator : '';
  elements.selectVerificationMethod.value = inc.verificationMethod && inc.verificationMethod !== 'Pending Verification' ? inc.verificationMethod : 'Physical Inspection';
  elements.inputVerificationNotes.value = inc.verificationNotes && inc.verificationNotes !== 'Pending field operator review' ? inc.verificationNotes : '';
  elements.inputActionTaken.value = inc.actionTaken && inc.actionTaken !== 'Pending corrective intervention' ? inc.actionTaken : '';
  elements.selectIncidentStatus.value = inc.status !== 'OPEN' ? inc.status : 'ACKNOWLEDGED';

  elements.incidentModal.classList.remove('hidden');
};

function handleIncidentFormSubmit(e) {
  e.preventDefault();
  const id = elements.modalIncidentId.value;
  const inc = state.incidents.find(i => i.id === id);
  if (!inc) return;

  inc.operator = elements.inputOperatorName.value.trim();
  inc.verificationMethod = elements.selectVerificationMethod.value;
  inc.verificationNotes = elements.inputVerificationNotes.value.trim();
  inc.actionTaken = elements.inputActionTaken.value.trim();
  inc.status = elements.selectIncidentStatus.value;

  if (inc.status === 'CLOSED' && !inc.closedAt) {
    inc.closedAt = new Date().toISOString();
  }

  elements.incidentModal.classList.add('hidden');
  renderIncidentsTable();
}

// ==============================================================================
// THRESHOLDS CONFIGURATION
// ==============================================================================
function populateThresholdForm() {
  const th = state.thresholds;
  document.getElementById('thPhCritLow').value = th.phCritLow;
  document.getElementById('thPhWarnLow').value = th.phWarnLow;
  document.getElementById('thPhWarnHigh').value = th.phWarnHigh;
  document.getElementById('thPhCritHigh').value = th.phCritHigh;

  document.getElementById('thTurbWarn').value = th.turbWarn;
  document.getElementById('thTurbCrit').value = th.turbCrit;

  document.getElementById('thEcWarn').value = th.ecWarn;
  document.getElementById('thEcCrit').value = th.ecCrit;
}

function handleThresholdsSubmit(e) {
  e.preventDefault();
  const th = state.thresholds;

  th.phCritLow = parseFloat(document.getElementById('thPhCritLow').value);
  th.phWarnLow = parseFloat(document.getElementById('thPhWarnLow').value);
  th.phWarnHigh = parseFloat(document.getElementById('thPhWarnHigh').value);
  th.phCritHigh = parseFloat(document.getElementById('thPhCritHigh').value);

  th.turbWarn = parseFloat(document.getElementById('thTurbWarn').value);
  th.turbCrit = parseFloat(document.getElementById('thTurbCrit').value);

  th.ecWarn = parseFloat(document.getElementById('thEcWarn').value);
  th.ecCrit = parseFloat(document.getElementById('thEcCrit').value);

  elements.thresholdsModal.classList.add('hidden');
  processNewReading();
}

// ==============================================================================
// CSV EXPORT ENGINE
// ==============================================================================
function exportReadingsToCsv() {
  if (state.history.length === 0) {
    alert('No readings recorded to export.');
    return;
  }

  let csv = 'timestamp,device_id,ph,turbidity_ntu,ec_us_cm,temperature_c,overall_status\n';
  state.history.forEach(r => {
    csv += `${r.timestamp},${state.deviceId},${r.ph},${r.turbidity},${r.ec},${r.temp},${r.status}\n`;
  });

  downloadBlob(csv, `jalrakshak_readings_${Date.now()}.csv`, 'text/csv');
}

function exportIncidentsToCsv() {
  if (state.incidents.length === 0) {
    alert('No incidents recorded to export.');
    return;
  }

  let csv = 'incident_id,opened_at,device_id,parameter,observed,severity,status,operator,verification_method,verification_notes,action_taken,closed_at\n';
  state.incidents.forEach(i => {
    csv += `"${i.id}","${i.openedAt}","${i.deviceId}","${i.parameter}","${i.observed}","${i.severity}","${i.status}","${i.operator || ''}","${i.verificationMethod || ''}","${(i.verificationNotes || '').replace(/"/g, '""')}","${(i.actionTaken || '').replace(/"/g, '""')}","${i.closedAt || ''}"\n`;
  });

  downloadBlob(csv, `jalrakshak_incidents_${Date.now()}.csv`, 'text/csv');
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Launch application on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
