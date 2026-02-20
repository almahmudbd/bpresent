/**
 * Automated Database Setup Script for "Present"
 * 
 * This script runs all migration steps (1-5) on your Supabase database.
 * Requirement: npm install postgres dotenv
 */

import 'dotenv/config';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL is missing in your .env file.');
    console.log('Please get your connection string from Supabase: Project Settings -> Database -> Connection string (Node.js)');
    process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function runMigration() {
    console.log('🚀 Starting Database Migration...');

    const migrationFiles = [
        'supabase/setup.sql'
    ];

    for (const file of migrationFiles) {
        const filePath = path.join(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Warning: ${file} not found. Skipping.`);
            continue;
        }

        console.log(`\n📄 Running ${file}...`);
        const content = fs.readFileSync(filePath, 'utf8');

        try {
            // Split by ';' but be careful with functions
            // For simplicity and safety with PL/pgSQL, we execute the whole file as a single batch
            await sql.unsafe(content);
            console.log(`✅ ${file} completed successfully.`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.warn(`💡 Note: Some items in ${file} already exist. Moving on.`);
            } else {
                console.error(`❌ Error in ${file}:`, error.message);
                // We don't exit here as some errors might be non-critical
            }
        }
    }

    console.log('\n✨ Database setup finished!');

    const adminEmail = process.argv[2];
    if (adminEmail) {
        console.log(`\n👑 Granting admin access to: ${adminEmail}...`);
        try {
            await sql`SELECT grant_admin_access(${adminEmail})`;
            console.log(`✅ Admin access granted to ${adminEmail}.`);
        } catch (error) {
            console.error('❌ Failed to grant admin access:', error.message);
        }
    } else {
        console.log('\n💡 Tip: You can grant admin access by running: node setup-db.mjs your-email@example.com');
    }

    await sql.end();
    process.exit(0);
}

runMigration();
