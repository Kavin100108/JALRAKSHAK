"""
Unit Tests for JalRakshak Data Validation, Hardware Fault Trapping & Workflow
File: test_data_validation.py
"""

import unittest
import csv
import io
from jalrakshak_core import (
    ThresholdConfig,
    SensorReading,
    JalRakshakDetector,
    IncidentRecord,
    OfflineSyncManager,
)


class TestDataValidation(unittest.TestCase):
    def setUp(self):
        self.detector = JalRakshakDetector()

    def test_disconnected_temperature_sensor(self):
        """Verifies that DS18B20 error codes (-127°C, -999°C) are trapped as DISCONNECTED faults."""
        faulty = SensorReading(ph=7.20, turbidity_ntu=0.80, ec_us_cm=320.0, temperature_c=-999.0)
        health = self.detector.validate_reading(faulty)
        self.assertEqual(health["temperature"], "DISCONNECTED")

        # Evaluate cycle to ensure overall severity is FAULT rather than low-temperature warning
        for _ in range(3):
            sev, alerts = self.detector.evaluate_cycle(faulty)
        self.assertEqual(sev, "FAULT")
        self.assertIn("FAULT_TEMPERATURE_DISCONNECTED", alerts)

    def test_saturated_and_open_circuit_adc_rails(self):
        """Tests that voltages below 0.10V or above 3.20V are trapped as electrical faults."""
        # Open circuit (0.05V)
        open_circuit = SensorReading(ph=7.0, turbidity_ntu=1.0, ec_us_cm=300.0, temperature_c=25.0, raw_v_ph=0.04)
        health_open = self.detector.validate_reading(open_circuit)
        self.assertEqual(health_open["ph"], "DISCONNECTED")

        # Saturated rail (3.28V)
        saturated = SensorReading(ph=7.0, turbidity_ntu=1.0, ec_us_cm=300.0, temperature_c=25.0, raw_v_turb=3.28)
        health_sat = self.detector.validate_reading(saturated)
        self.assertEqual(health_sat["turbidity"], "DISCONNECTED")

    def test_out_of_range_sensor_values(self):
        """Verifies out-of-range detection for impossible pH (< 0 or > 14)."""
        impossible_ph = SensorReading(ph=16.5, turbidity_ntu=1.0, ec_us_cm=300.0, temperature_c=25.0)
        health = self.detector.validate_reading(impossible_ph)
        self.assertEqual(health["ph"], "OUT_OF_RANGE")

    def test_missing_timestamp_fallback(self):
        """Verifies that a SensorReading instantiated without a timestamp defaults gracefully."""
        reading = SensorReading(ph=7.2, turbidity_ntu=1.0, ec_us_cm=300.0, temperature_c=25.0, timestamp=None)
        self.assertIsNotNone(reading.timestamp)
        self.assertTrue(reading.timestamp.endswith("Z"))

    def test_incident_lifecycle_workflow(self):
        """Tests complete workflow: OPEN -> ACKNOWLEDGED -> VERIFIED -> CLOSED."""
        incident = IncidentRecord(
            incident_id="INC-2026-999",
            timestamp_opened="2026-10-27T10:00:00Z",
            device_id="JR-NODE-01",
            parameter="TURBIDITY",
            observed_value="14.5 NTU",
            severity="CRITICAL",
        )
        self.assertEqual(incident.status, "OPEN")

        # 1. Cannot close without acknowledgment and verification
        with self.assertRaises(ValueError):
            incident.take_action_and_close("Attempt premature close")

        # 2. Acknowledge
        with self.assertRaises(ValueError):
            incident.acknowledge("")  # Operator required
        incident.acknowledge("Operator_Ramesh")
        self.assertEqual(incident.status, "ACKNOWLEDGED")
        self.assertEqual(incident.operator, "Operator_Ramesh")

        # 3. Verify
        with self.assertRaises(ValueError):
            incident.record_verification("", "Notes without method")
        incident.record_verification("Physical Inspection", "Confirmed visual runoff from inlet drain")
        self.assertEqual(incident.status, "VERIFIED")

        # 4. Action and Close
        incident.take_action_and_close("Diverted inlet valve to secondary tank; flushed pipe")
        self.assertEqual(incident.status, "CLOSED")
        self.assertIsNotNone(incident.timestamp_closed)

    def test_csv_parsing_and_export_consistency(self):
        """Verifies parsing of sample CSV telemetry rows and exporting back to CSV format."""
        raw_csv_data = (
            "timestamp,device_id,ph,turbidity_ntu,ec_us_cm,temperature_c\n"
            "2026-10-27T06:00:00Z,JR-NODE-01,7.24,0.78,320.5,22.40\n"
            "2026-10-27T06:15:00Z,JR-NODE-01,7.22,0.81,322.0,22.60\n"
        )
        stream = io.StringIO(raw_csv_data)
        reader = csv.DictReader(stream)
        rows = list(reader)
        self.assertEqual(len(rows), 2)
        self.assertEqual(float(rows[0]["ph"]), 7.24)
        self.assertEqual(float(rows[1]["turbidity_ntu"]), 0.81)

        # Export test
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        self.assertIn("7.24", output.getvalue())

    def test_offline_deduplication(self):
        """Verifies that re-transmitted duplicate records are rejected during offline sync."""
        sync_mgr = OfflineSyncManager()
        rec1 = {"timestamp": "2026-10-27T06:00:00Z", "device_id": "JR-NODE-01", "ph": 7.2}
        rec2 = {"timestamp": "2026-10-27T06:05:00Z", "device_id": "JR-NODE-01", "ph": 7.3}
        rec1_dup = {"timestamp": "2026-10-27T06:00:00Z", "device_id": "JR-NODE-01", "ph": 7.2}

        self.assertTrue(sync_mgr.add_record(rec1))
        self.assertTrue(sync_mgr.add_record(rec2))
        self.assertFalse(sync_mgr.add_record(rec1_dup), "Duplicate record must be rejected.")
        self.assertEqual(len(sync_mgr.records), 2)


if __name__ == "__main__":
    unittest.main()
