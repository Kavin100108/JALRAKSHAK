"""
JalRakshak Reference Algorithm & Validation Core
File: jalrakshak_core.py

Provides the deterministic pure-software reference implementations of the
JalRakshak sensing pipeline, anomaly detector, data validator, and incident
workflow manager for deterministic automated unit testing.
"""

from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
import csv
import io


class ThresholdConfig:
    def __init__(
        self,
        ph_crit_low: float = 6.0,
        ph_warn_low: float = 6.5,
        ph_warn_high: float = 8.5,
        ph_crit_high: float = 9.0,
        turb_warn: float = 5.0,
        turb_crit: float = 10.0,
        ec_warn: float = 800.0,
        ec_crit: float = 1500.0,
        temp_warn_low: float = 5.0,
        temp_warn_high: float = 35.0,
        temp_crit_high: float = 45.0,
        debounce_cycles: int = 3,
    ):
        self.ph_crit_low = ph_crit_low
        self.ph_warn_low = ph_warn_low
        self.ph_warn_high = ph_warn_high
        self.ph_crit_high = ph_crit_high
        self.turb_warn = turb_warn
        self.turb_crit = turb_crit
        self.ec_warn = ec_warn
        self.ec_crit = ec_crit
        self.temp_warn_low = temp_warn_low
        self.temp_warn_high = temp_warn_high
        self.temp_crit_high = temp_crit_high
        self.debounce_cycles = debounce_cycles


class SensorReading:
    def __init__(
        self,
        ph: Optional[float],
        turbidity_ntu: Optional[float],
        ec_us_cm: Optional[float],
        temperature_c: Optional[float],
        timestamp: Optional[str] = None,
        device_id: str = "JR-NODE-01",
        raw_v_ph: Optional[float] = None,
        raw_v_turb: Optional[float] = None,
        raw_v_ec: Optional[float] = None,
    ):
        self.ph = ph
        self.turbidity_ntu = turbidity_ntu
        self.ec_us_cm = ec_us_cm
        self.temperature_c = temperature_c
        self.timestamp = timestamp or datetime.utcnow().isoformat() + "Z"
        self.device_id = device_id
        self.raw_v_ph = raw_v_ph
        self.raw_v_turb = raw_v_turb
        self.raw_v_ec = raw_v_ec


class JalRakshakDetector:
    def __init__(self, config: Optional[ThresholdConfig] = None):
        self.config = config or ThresholdConfig()
        self.consecutive_abnormal_cycles = 0
        self.current_severity = "NORMAL"
        self.active_alerts: List[str] = []

    def validate_reading(self, reading: SensorReading) -> Dict[str, str]:
        """Validates hardware health: disconnected probes, saturated rails, DS18B20 errors."""
        health = {
            "ph": "OK",
            "turbidity": "OK",
            "ec": "OK",
            "temperature": "OK",
        }

        # pH checks
        if reading.ph is None or reading.ph < 0.0 or reading.ph > 14.0:
            health["ph"] = "DISCONNECTED" if reading.ph is None or reading.ph < 0.0 else "OUT_OF_RANGE"
        elif reading.raw_v_ph is not None and (reading.raw_v_ph < 0.10 or reading.raw_v_ph > 3.20):
            health["ph"] = "DISCONNECTED"

        # Turbidity checks
        if reading.turbidity_ntu is None or reading.turbidity_ntu < 0.0:
            health["turbidity"] = "DISCONNECTED"
        elif reading.turbidity_ntu > 1000.0:
            health["turbidity"] = "OUT_OF_RANGE"
        elif reading.raw_v_turb is not None and (reading.raw_v_turb < 0.10 or reading.raw_v_turb > 3.20):
            health["turbidity"] = "DISCONNECTED"

        # EC checks
        if reading.ec_us_cm is None or reading.ec_us_cm < 0.0:
            health["ec"] = "DISCONNECTED"
        elif reading.ec_us_cm > 10000.0:
            health["ec"] = "OUT_OF_RANGE"

        # Temperature checks: DS18B20 returns -127°C on communication failure
        if reading.temperature_c is None or reading.temperature_c <= -100.0:
            health["temperature"] = "DISCONNECTED"
        elif reading.temperature_c < -10.0 or reading.temperature_c > 80.0:
            health["temperature"] = "OUT_OF_RANGE"

        return health

    def evaluate_cycle(self, reading: SensorReading) -> Tuple[str, List[str]]:
        """Evaluates a single telemetry cycle with hysteresis/debounce filter."""
        health = self.validate_reading(reading)
        cfg = self.config

        alerts: List[str] = []
        raw_severity = "NORMAL"

        # 1. Hardware faults
        if any(h != "OK" for h in health.values()):
            raw_severity = "FAULT"
            for sensor, status in health.items():
                if status != "OK":
                    alerts.append(f"FAULT_{sensor.upper()}_{status}")
        else:
            # 2. Critical anomalies
            has_crit = False
            if reading.ph <= cfg.ph_crit_low or reading.ph >= cfg.ph_crit_high:
                has_crit = True
                alerts.append(f"CRIT_PH_{'ACIDIC' if reading.ph <= cfg.ph_crit_low else 'ALKALINE'}")
            if reading.turbidity_ntu >= cfg.turb_crit:
                has_crit = True
                alerts.append("CRIT_TURBIDITY")
            if reading.ec_us_cm >= cfg.ec_crit:
                has_crit = True
                alerts.append("CRIT_EC_SPIKE")
            if reading.temperature_c >= cfg.temp_crit_high:
                has_crit = True
                alerts.append("CRIT_TEMP_HIGH")

            if has_crit:
                raw_severity = "CRITICAL"
            else:
                # 3. Warning anomalies
                has_warn = False
                if reading.ph < cfg.ph_warn_low or reading.ph > cfg.ph_warn_high:
                    has_warn = True
                    alerts.append(f"WARN_PH_{'LOW' if reading.ph < cfg.ph_warn_low else 'HIGH'}")
                if reading.turbidity_ntu >= cfg.turb_warn:
                    has_warn = True
                    alerts.append("WARN_TURBIDITY")
                if reading.ec_us_cm >= cfg.ec_warn:
                    has_warn = True
                    alerts.append("WARN_EC_ELEVATED")
                if reading.temperature_c <= cfg.temp_warn_low or reading.temperature_c >= cfg.temp_warn_high:
                    has_warn = True
                    alerts.append("WARN_TEMP_DRIFT")

                if has_warn:
                    raw_severity = "WARNING"

        # Debounce filter (Hysteresis)
        if raw_severity != "NORMAL":
            self.consecutive_abnormal_cycles += 1
            if self.consecutive_abnormal_cycles >= cfg.debounce_cycles:
                self.current_severity = raw_severity
                self.active_alerts = alerts
        else:
            if self.consecutive_abnormal_cycles > 0:
                self.consecutive_abnormal_cycles -= 1
            if self.consecutive_abnormal_cycles == 0:
                self.current_severity = "NORMAL"
                self.active_alerts = []

        return self.current_severity, self.active_alerts


class IncidentRecord:
    VALID_STATUSES = ["OPEN", "ACKNOWLEDGED", "VERIFIED", "ACTION_TAKEN", "CLOSED"]

    def __init__(
        self,
        incident_id: str,
        timestamp_opened: str,
        device_id: str,
        parameter: str,
        observed_value: str,
        severity: str,
        status: str = "OPEN",
        operator: Optional[str] = None,
        verification_method: Optional[str] = None,
        verification_notes: Optional[str] = None,
        action_taken: Optional[str] = None,
        timestamp_closed: Optional[str] = None,
    ):
        self.incident_id = incident_id
        self.timestamp_opened = timestamp_opened
        self.device_id = device_id
        self.parameter = parameter
        self.observed_value = observed_value
        self.severity = severity
        self.status = status
        self.operator = operator
        self.verification_method = verification_method
        self.verification_notes = verification_notes
        self.action_taken = action_taken
        self.timestamp_closed = timestamp_closed

    def acknowledge(self, operator_name: str) -> None:
        if not operator_name or not operator_name.strip():
            raise ValueError("Operator name is required to acknowledge an incident.")
        self.operator = operator_name.strip()
        self.status = "ACKNOWLEDGED"

    def record_verification(self, method: str, notes: str) -> None:
        if not method or not method.strip():
            raise ValueError("Verification reference method is required.")
        if not notes or not notes.strip():
            raise ValueError("Verification notes are required.")
        self.verification_method = method.strip()
        self.verification_notes = notes.strip()
        self.status = "VERIFIED"

    def take_action_and_close(self, action_details: str, close_timestamp: Optional[str] = None) -> None:
        if not action_details or not action_details.strip():
            raise ValueError("Remediation action details are required before closing.")
        if self.status not in ["ACKNOWLEDGED", "VERIFIED", "ACTION_TAKEN"]:
            raise ValueError(f"Cannot close incident from status '{self.status}'. Must be acknowledged/verified first.")
        self.action_taken = action_details.strip()
        self.status = "CLOSED"
        self.timestamp_closed = close_timestamp or datetime.utcnow().isoformat() + "Z"


class OfflineSyncManager:
    """Manages offline record storage queue and deduplication upon synchronization."""
    def __init__(self):
        self._synced_keys = set()
        self.records: List[Dict[str, Any]] = []

    def add_record(self, record: Dict[str, Any]) -> bool:
        """Returns True if record was added, False if duplicate was rejected."""
        ts = record.get("timestamp")
        dev = record.get("device_id", "UNKNOWN")
        key = f"{dev}:{ts}"
        if key in self._synced_keys:
            return False  # Duplicate ignored
        self._synced_keys.add(key)
        self.records.append(record)
        return True
