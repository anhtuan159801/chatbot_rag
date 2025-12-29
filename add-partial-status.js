import { Client } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

async function addPartialStatus() {
  const connectionString = process.env.SUPABASE_URL;
  
  if (!connectionString) {
    console.error('Error: SUPABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    console.log('[FIX] Connecting to database...');
    await client.connect();
    console.log('[FIX] ✓ Connected');

    // Drop existing CHECK constraint
    console.log('\n[FIX] Dropping existing status constraint...');
    await client.query(`ALTER TABLE knowledge_base
DROP CONSTRAINT IF EXISTS knowledge_base_status_check`);
    console.log('[FIX] ✓ Constraint dropped');

    // Add new CHECK constraint with PARTIAL status
    console.log('\n[FIX] Adding new status constraint with PARTIAL...');
    await client.query(`ALTER TABLE knowledge_base
ADD CONSTRAINT knowledge_base_status_check
CHECK (status IN ('PENDING', 'PROCESSING', 'VECTORIZING', 'COMPLETED', 'PARTIAL', 'FAILED'))`);
    console.log('[FIX] ✓ New constraint added');

    console.log('\n[SUCCESS] ✓✓✓ Database updated to support PARTIAL status!');
    console.log('[SUCCESS] Documents will now show FAILED when vectors = 0');

  } catch (error) {
    console.error('\n[ERROR] Failed to add PARTIAL status:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n[FIX] Database connection closed');
  }
}

addPartialStatus();
