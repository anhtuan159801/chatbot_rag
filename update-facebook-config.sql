-- Update facebook_config in system_configs table
-- Run this in your Supabase SQL Editor

-- First, check current config
SELECT key, value FROM system_configs WHERE key = 'facebook_config';

-- Update with access token from environment variables
UPDATE system_configs
SET value = jsonb_set(
    value,
    '{accessToken}',
    '"EAAK4ltJZCqX4BPWUFQ6mZBe9dHnJY3Bk0pnEmizqRMJVEZBTSprmbGXGKmizvMADMyFJ9HLVsFrqZBbZBrO4FNkt8rzp4uO9VykNGrJyJzBsxiXErEr3ODKS9ekolQ1ZA8oFPvh9bNDQ5TA0930tp5JWIuZBkYKIMnag0UBOMb7xHjukcHZAZAZAWFa8yCL3CE062RiQIKknPmhIMQKlhqbqzZAeh3T"'
),
updated_at = NOW()
WHERE key = 'facebook_config';

-- Verify update
SELECT key, value FROM system_configs WHERE key = 'facebook_config';
