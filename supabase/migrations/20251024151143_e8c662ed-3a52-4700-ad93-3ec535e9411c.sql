-- Add default plan flag to subscription_plans
ALTER TABLE subscription_plans 
ADD COLUMN is_default_plan boolean DEFAULT false;

-- Create index for faster queries
CREATE INDEX idx_subscription_plans_default ON subscription_plans(is_default_plan) WHERE is_default_plan = true;

-- Ensure only one plan can be default at a time (optional but recommended)
CREATE OR REPLACE FUNCTION ensure_single_default_plan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default_plan = true THEN
    UPDATE subscription_plans 
    SET is_default_plan = false 
    WHERE id != NEW.id AND is_default_plan = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_default_plan
BEFORE INSERT OR UPDATE ON subscription_plans
FOR EACH ROW
WHEN (NEW.is_default_plan = true)
EXECUTE FUNCTION ensure_single_default_plan();