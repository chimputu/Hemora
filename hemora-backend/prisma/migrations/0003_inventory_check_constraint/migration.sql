-- Add CHECK constraint to prevent negative inventory units
ALTER TABLE blood_inventory ADD CONSTRAINT blood_inventory_units_check CHECK (units >= 0);
