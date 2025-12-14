#!/usr/bin/env npx tsx
/**
 * Set Admin Script
 *
 * Sets a user as admin by email.
 *
 * Usage:
 *   npx tsx scripts/set-admin.ts dave-king1@hotmail.co.uk
 *   npx tsx scripts/set-admin.ts --email=dave-king1@hotmail.co.uk
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default admin emails - these users will be made admin automatically
const DEFAULT_ADMINS = [
  'dave-king1@hotmail.co.uk',
];

async function setAdmin(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`User not found: ${email}`);
      console.log('Note: User must sign up first before being made admin.');
      return false;
    }

    if (user.isAdmin) {
      console.log(`User ${email} is already an admin.`);
      return true;
    }

    await prisma.user.update({
      where: { email },
      data: { isAdmin: true },
    });

    console.log(`✓ User ${email} is now an admin.`);
    return true;
  } catch (error) {
    console.error(`Error setting admin for ${email}:`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Parse email from args
  let emails: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--email=')) {
      emails.push(arg.split('=')[1]);
    } else if (arg.includes('@')) {
      emails.push(arg);
    }
  }

  // If no emails provided, use defaults
  if (emails.length === 0) {
    console.log('No email provided, using default admin list...');
    emails = DEFAULT_ADMINS;
  }

  console.log(`Setting admin for ${emails.length} user(s)...\n`);

  let success = 0;
  for (const email of emails) {
    if (await setAdmin(email)) {
      success++;
    }
  }

  console.log(`\nDone: ${success}/${emails.length} users updated.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
