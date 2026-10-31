-- Add MPV as a distinct car category without changing existing vehicle rows.
ALTER TYPE "VehicleCategory" ADD VALUE IF NOT EXISTS 'MPV';
