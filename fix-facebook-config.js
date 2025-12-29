import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.SUPABASE_URL;

async function fixFacebookConfig() {
  console.log('=== Fixing Facebook Config ===\n');

  try {
    const client = new Client({ connectionString });
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check current facebook_config
    const currentConfig = await client.query("SELECT value FROM system_configs WHERE key = 'facebook_config'");
    console.log('📄 Current facebook_config:');
    console.log(JSON.stringify(currentConfig.rows[0]?.value, null, 2));
    console.log('');

    // Update with proper config
    const newConfig = {
      pageId: process.env.FACEBOOK_PAGE_ID || '',
      accessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
      pageName: process.env.FACEBOOK_PAGE_NAME || ''
    };

    console.log('🔧 New config will be:');
    console.log(JSON.stringify(newConfig, null, 2));
    console.log('');

    // Check if accessToken is set
    if (!newConfig.accessToken || newConfig.accessToken === '' || newConfig.accessToken.includes('[YOUR-')) {
      console.error('✗ FACEBOOK_ACCESS_TOKEN is not set in environment!');
      process.exit(1);
    }

    // Update or insert config
    if (currentConfig.rows.length > 0) {
      await client.query(
        "UPDATE system_configs SET value = $1, updated_at = NOW() WHERE key = 'facebook_config'",
        [JSON.stringify(newConfig)]
      );
      console.log('✓ Updated facebook_config\n');
    } else {
      await client.query(
        "INSERT INTO system_configs (key, value, updated_at) VALUES ('facebook_config', $1, NOW())",
        [JSON.stringify(newConfig)]
      );
      console.log('✓ Inserted facebook_config\n');
    }

    // Verify
    const verifyConfig = await client.query("SELECT value FROM system_configs WHERE key = 'facebook_config'");
    const config = verifyConfig.rows[0].value;
    console.log('📊 Verification:');
    console.log(`   Page ID: ${config.pageId}`);
    console.log(`   Page Name: ${config.pageName}`);
    console.log(`   Access Token: ${config.accessToken ? '✓ Set (' + config.accessToken.substring(0, 20) + '...)' : '✗ Empty'}`);

    await client.end();
    console.log('\n✓ Facebook config fixed successfully!');

  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  }
}

fixFacebookConfig();
