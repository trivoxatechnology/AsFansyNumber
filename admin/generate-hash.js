/**
 * Run this script to generate a SHA-256 hash for your admin password.
 * Usage:  node generate-hash.js
 * Then paste the output into admin/.env as VITE_ADMIN_PASSWORD_HASH=
 */

import crypto from 'crypto';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter your new admin password: ', (password) => {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  console.log('\n✅ Your SHA-256 hash:');
  console.log(hash);
  console.log('\nCopy the line below into your admin/.env file:');
  console.log(`VITE_ADMIN_PASSWORD_HASH=${hash}`);
  rl.close();
});
