const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Find records with NULL values
  const nullRecords = await prisma.salesRecord.findMany({
    where: {
      OR: [
        { productId: null },
        { quantity: null }
      ]
    }
  })

  console.log(`Found ${nullRecords.length} records with NULL values`)

  // Update or delete records with NULL values
  for (const record of nullRecords) {
    // Option 1: Delete the record
    await prisma.salesRecord.delete({
      where: { id: record.id }
    })
    
    // Option 2: Update with default values (uncomment if you prefer this approach)
    // await prisma.salesRecord.update({
    //   where: { id: record.id },
    //   data: {
    //     productId: 1, // Replace with a valid product ID
    //     quantity: 1
    //   }
    // })
  }

  console.log('Finished processing NULL records')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 