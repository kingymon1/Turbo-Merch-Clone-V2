/**
 * Migration Script: Move existing designs from database to R2
 *
 * This script:
 * 1. Fetches all designs with base64 images in imageUrl
 * 2. Uploads images to R2
 * 3. Uploads runConfig and listingData to R2 as research data
 * 4. Updates database records with R2 URLs
 *
 * Usage:
 *   npx tsx scripts/migrate-to-r2.ts --dry-run    # Test without making changes
 *   npx tsx scripts/migrate-to-r2.ts --execute    # Actually migrate
 */

import prisma from '../lib/prisma';
import { uploadImage, uploadResearchData } from '../lib/r2-storage';

const isDryRun = process.argv.includes('--dry-run');
const isExecute = process.argv.includes('--execute');

if (!isDryRun && !isExecute) {
  console.error('❌ Please specify --dry-run or --execute');
  process.exit(1);
}

async function migrateToR2() {
  console.log('🚀 Starting R2 migration...\n');
  console.log(`Mode: ${isDryRun ? '🧪 DRY RUN (no changes)' : '✅ EXECUTE (will make changes)'}\n`);

  try {
    // Find all designs with base64 images
    const designs = await prisma.designHistory.findMany({
      where: {
        deletedAt: null,
        imageUrl: {
          startsWith: 'data:', // Base64 data URI
        },
      },
      select: {
        id: true,
        userId: true,
        imageUrl: true,
        runConfig: true,
        listingData: true,
        niche: true,
        slogan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 Found ${designs.length} designs with base64 images to migrate\n`);

    if (designs.length === 0) {
      console.log('✅ No designs to migrate. All done!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const design of designs) {
      console.log(`\n📦 Processing design: ${design.id}`);
      console.log(`   Niche: ${design.niche || 'Unknown'}`);
      console.log(`   Title: ${design.slogan || 'Untitled'}`);

      try {
        let r2ImageUrl: string | null = null;
        let r2ResearchUrl: string | null = null;

        // Upload image to R2
        if (design.imageUrl && design.imageUrl.startsWith('data:')) {
          const imageSize = Math.round(design.imageUrl.length / 1024);
          console.log(`   📸 Image size: ${imageSize}KB (base64)`);

          if (!isDryRun) {
            r2ImageUrl = await uploadImage(design.userId!, design.id!, design.imageUrl!);
            console.log(`   ✅ Image uploaded to R2: ${r2ImageUrl}`);
          } else {
            console.log(`   🧪 Would upload image to R2`);
          }
        }

        // Upload research data (runConfig + listingData) to R2
        const researchData = {
          runConfig: design.runConfig,
          listingData: design.listingData,
        };

        const researchSize = Math.round(JSON.stringify(researchData).length / 1024);
        console.log(`   📊 Research data size: ${researchSize}KB`);

        if (!isDryRun) {
          r2ResearchUrl = await uploadResearchData(design.userId!, design.id!, researchData);
          console.log(`   ✅ Research data uploaded to R2: ${r2ResearchUrl}`);
        } else {
          console.log(`   🧪 Would upload research data to R2`);
        }

        // Update database record
        if (!isDryRun && (r2ImageUrl || r2ResearchUrl)) {
          const updateData: any = {
            imageUrl: r2ImageUrl || design.imageUrl,
          };

          if (r2ResearchUrl) {
            updateData.runConfig = {
              researchUrl: r2ResearchUrl,
              migratedAt: new Date().toISOString(),
            };
          }

          await prisma.designHistory.update({
            where: { id: design.id! },
            data: updateData,
          });
          console.log(`   ✅ Database updated with R2 references`);
        } else {
          console.log(`   🧪 Would update database with R2 references`);
        }

        successCount++;
        console.log(`   ✅ Design migrated successfully`);
      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ Error migrating design ${design.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total designs: ${designs.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('='.repeat(60));

    if (isDryRun) {
      console.log('\n🧪 This was a dry run. No changes were made.');
      console.log('Run with --execute to actually migrate.');
    } else {
      console.log('\n✅ Migration complete!');
      console.log('Your designs are now stored in R2.');
      console.log('Database records have been updated with R2 URLs.');
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateToR2();
