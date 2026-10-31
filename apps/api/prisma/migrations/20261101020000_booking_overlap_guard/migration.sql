-- Prevent two active bookings for the same vehicle from overlapping.
-- Existing rows are checked first so the migration fails with a clear message
-- instead of silently changing or deleting any booking data.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_vehicle_no_overlapping_active_periods'
      AND conrelid = '"Booking"'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM "Booking" first_booking
      JOIN "Booking" second_booking
        ON first_booking."vehicleId" = second_booking."vehicleId"
       AND first_booking.id < second_booking.id
      WHERE first_booking.status::text IN ('PENDING', 'CONFIRMED', 'ACTIVE')
        AND second_booking.status::text IN ('PENDING', 'CONFIRMED', 'ACTIVE')
        AND tstzrange(first_booking."pickupAt", first_booking."returnAt", '[)')
            && tstzrange(second_booking."pickupAt", second_booking."returnAt", '[)')
    ) THEN
      RAISE EXCEPTION
        'Cannot add booking overlap protection: existing PENDING, CONFIRMED, or ACTIVE bookings overlap for at least one vehicle. Review and resolve those bookings, then rerun this migration.';
    END IF;

    ALTER TABLE "Booking"
      ADD CONSTRAINT "booking_vehicle_no_overlapping_active_periods"
      EXCLUDE USING gist (
        "vehicleId" WITH =,
        tstzrange("pickupAt", "returnAt", '[)') WITH &&
      )
      WHERE ("status" IN ('PENDING', 'CONFIRMED', 'ACTIVE'));
  END IF;
END
$$;
