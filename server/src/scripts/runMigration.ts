import path from 'path';
import { connectDB, disconnectDB } from '../config/db';
import { ImportEngine } from '../services/importService';

async function run() {
  console.log('Connecting to database...');
  await connectDB();

  const sourceDir = path.join(__dirname, '..', '..', '..', 'data', 'source_files');
  console.log(`Source directory: ${sourceDir}`);

  const engine = new ImportEngine(sourceDir);

  console.log('\n--- 1. PREVIEW DRY RUN ---');
  const preview = await engine.preview();
  console.log('Preview Summary:', JSON.stringify(preview.summary, null, 2));
  console.log('Sample Groups:', preview.sampleGroups);
  console.log('Sample Customers:', preview.sampleCustomers);

  console.log('\n--- 2. EXECUTING HISTORICAL MIGRATION ---');
  const result = await engine.execute('system_migration_admin');
  console.log('\nMigration Execution Result:', JSON.stringify(result, null, 2));

  await disconnectDB();
  console.log('\nMigration script completed.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
