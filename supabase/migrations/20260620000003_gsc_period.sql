-- Add period column to gsc_clicks to track the data window selected at import time.
-- Values: '28d', '1m', '3m', '6m', '1y'
ALTER TABLE gsc_clicks ADD COLUMN IF NOT EXISTS period varchar(10);
