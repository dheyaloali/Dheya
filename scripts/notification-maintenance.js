#!/usr/bin/env node

/**
 * 🚀 PRODUCTION: Notification System Maintenance Script
 * 
 * This script handles:
 * - Retrying failed notifications
 * - Cleaning up old notifications
 * - Monitoring system health
 * - Generating analytics reports
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Load environment variables
config();

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  maxRetries: 3,
  cleanupDays: 90,
  batchSize: 100,
  retryDelay: 5000, // 5 seconds
};

/**
 * Retry failed notifications
 */
async function retryFailedNotifications() {
  console.log('🔄 Starting failed notification retry process...');
  
  try {
    const failedNotifications = await prisma.notification.findMany({
      where: {
        deliveryStatus: 'failed',
        retryCount: { lt: CONFIG.maxRetries },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      },
      include: {
        user: { select: { name: true, email: true } },
        employee: { select: { user: { select: { name: true, email: true } } } }
      }
    });

    console.log(`📊 Found ${failedNotifications.length} failed notifications to retry`);

    let successCount = 0;
    let failureCount = 0;

    for (const notification of failedNotifications) {
      try {
        // Update retry count
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            retryCount: { increment: 1 },
            lastAttemptAt: new Date(),
            deliveryStatus: 'retrying'
          }
        });

        // Simulate retry attempt (in production, this would call the actual delivery service)
        const success = await attemptDelivery(notification);
        
        if (success) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              deliveryStatus: 'delivered',
              deliveredAt: new Date()
            }
          });
          successCount++;
        } else {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              deliveryStatus: 'failed',
              errorMessage: 'Retry attempt failed'
            }
          });
          failureCount++;
        }

        // Add delay between retries to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));

      } catch (error) {
        console.error(`❌ Error retrying notification ${notification.id}:`, error);
        failureCount++;
      }
    }

    console.log(`✅ Retry process completed: ${successCount} successful, ${failureCount} failed`);

  } catch (error) {
    console.error('❌ Error in retry process:', error);
  }
}

/**
 * Clean up old notifications
 */
async function cleanupOldNotifications() {
  console.log('🧹 Starting notification cleanup process...');
  
  try {
    const cutoffDate = new Date(Date.now() - CONFIG.cleanupDays * 24 * 60 * 60 * 1000);
    
    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        deliveryStatus: { in: ['delivered', 'failed'] }
      }
    });

    console.log(`🗑️ Cleaned up ${result.count} old notifications (older than ${CONFIG.cleanupDays} days)`);

  } catch (error) {
    console.error('❌ Error in cleanup process:', error);
  }
}

/**
 * Generate system health report
 */
async function generateHealthReport() {
  console.log('📊 Generating system health report...');
  
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalNotifications,
      deliveredNotifications,
      failedNotifications,
      pendingNotifications,
      retryingNotifications,
      recentNotifications,
      recentFailed
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { deliveryStatus: 'delivered' } }),
      prisma.notification.count({ where: { deliveryStatus: 'failed' } }),
      prisma.notification.count({ where: { deliveryStatus: 'pending' } }),
      prisma.notification.count({ where: { deliveryStatus: 'retrying' } }),
      prisma.notification.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.notification.count({ 
        where: { 
          deliveryStatus: 'failed',
          createdAt: { gte: oneDayAgo }
        } 
      })
    ]);

    const deliveryRate = totalNotifications > 0 ? (deliveredNotifications / totalNotifications) * 100 : 0;
    const failureRate = totalNotifications > 0 ? (failedNotifications / totalNotifications) * 100 : 0;

    console.log('\n📈 Notification System Health Report');
    console.log('=====================================');
    console.log(`Total Notifications: ${totalNotifications.toLocaleString()}`);
    console.log(`Delivered: ${deliveredNotifications.toLocaleString()} (${deliveryRate.toFixed(2)}%)`);
    console.log(`Failed: ${failedNotifications.toLocaleString()} (${failureRate.toFixed(2)}%)`);
    console.log(`Pending: ${pendingNotifications.toLocaleString()}`);
    console.log(`Retrying: ${retryingNotifications.toLocaleString()}`);
    console.log(`Last 24h: ${recentNotifications.toLocaleString()}`);
    console.log(`Failed Last 24h: ${recentFailed.toLocaleString()}`);
    
    // Health status
    if (failureRate > 10) {
      console.log('⚠️  WARNING: High failure rate detected (>10%)');
    } else if (failureRate > 5) {
      console.log('⚠️  CAUTION: Elevated failure rate detected (>5%)');
    } else {
      console.log('✅ System health: Good');
    }

  } catch (error) {
    console.error('❌ Error generating health report:', error);
  }
}

/**
 * Simulate delivery attempt (replace with actual delivery logic)
 */
async function attemptDelivery(notification) {
  // Simulate delivery with 80% success rate
  return Math.random() > 0.2;
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'retry':
        await retryFailedNotifications();
        break;
      case 'cleanup':
        await cleanupOldNotifications();
        break;
      case 'health':
        await generateHealthReport();
        break;
      case 'all':
        await retryFailedNotifications();
        await cleanupOldNotifications();
        await generateHealthReport();
        break;
      default:
        console.log('Usage: node notification-maintenance.js [retry|cleanup|health|all]');
        console.log('');
        console.log('Commands:');
        console.log('  retry   - Retry failed notifications');
        console.log('  cleanup - Clean up old notifications');
        console.log('  health  - Generate health report');
        console.log('  all     - Run all maintenance tasks');
        break;
    }
  } catch (error) {
    console.error('❌ Maintenance script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main(); 