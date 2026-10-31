-- PostgreSQL-level double-booking protection. The half-open interval allows
-- one booking to end exactly when the next begins.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_vehicle_no_overlapping_active_periods"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tsrange("pickupAt", "returnAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'ACTIVE'));
