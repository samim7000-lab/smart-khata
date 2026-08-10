-- ====================================================
-- SMART KHATA MIGRATION V6: SERVER-SIDE CAMPAIGN LIMITS & RLS
-- ====================================================

-- 1. Postgres Function to Validate Campaign Recipient Limits Server-Side
CREATE OR REPLACE FUNCTION validate_campaign_recipients(
  p_shop_id UUID,
  p_recipient_count INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  max_limit INT,
  current_tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit INT;
BEGIN
  -- Fetch current shop plan tier
  SELECT COALESCE(plan_tier, 'free') INTO v_tier
  FROM shops
  WHERE id = p_shop_id;

  -- Determine limit based on tier
  IF v_tier = 'free' THEN
    v_limit := 50;
  ELSIF v_tier = 'pro' THEN
    v_limit := 500;
  ELSE
    v_limit := 2147483647; -- Unlimited
  END IF;

  -- Return validation result
  allowed := (p_recipient_count <= v_limit);
  max_limit := v_limit;
  current_tier := v_tier;
  RETURN NEXT;
END;
$$;
