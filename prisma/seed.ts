import 'dotenv/config';
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import speakeasy from 'speakeasy'
import { reverseGeocode } from '@/lib/server-geocode';
import cliProgress from 'cli-progress';

const prisma = new PrismaClient()

// Sample data
const CITIES = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang'];
const POSITIONS = ['Sales Representative', 'Field Agent', 'Regional Manager', 'Area Supervisor', 'Sales Executive'];
const PRODUCTS = [
  { name: 'Product A', price: 100000, description: 'High-quality product A', stockLevel: 100 },
  { name: 'Product B', price: 150000, description: 'Premium product B', stockLevel: 75 },
  { name: 'Product C', price: 200000, description: 'Luxury product C', stockLevel: 50 },
  { name: 'Product D', price: 250000, description: 'Exclusive product D', stockLevel: 25 },
  { name: 'Product E', price: 300000, description: 'Elite product E', stockLevel: 10 }
];

async function cleanupDatabase() {
  try {
    // Delete all dependent records first to avoid foreign key constraints
    // Delete in order from most dependent to least dependent
    await prisma.salaryAuditLog.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.timeLog.deleteMany({});
    await prisma.salesRecord.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.salary.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.employeeProduct.deleteMany({});
    await prisma.absenceRecord.deleteMany({});
    await prisma.employeeLocation.deleteMany({});
    await prisma.report.deleteMany({});
    
    // Now we can safely delete employees
    await prisma.employee.deleteMany({
      where: {
        user: {
          role: 'employee'
        }
      }
    });
    
    // Delete users (but not admin users)
    await prisma.user.deleteMany({
      where: {
        role: 'employee'
      }
    });

    // Delete products last since they're referenced by employeeProduct
    await prisma.product.deleteMany({});
    
    console.log('Database cleaned up');
  } catch (error) {
    console.error('Error cleaning up database:', error);
    throw error;
  }
}

async function seedSampleData() {
  try {
    // --- Admin seeding logic (from seed-admin.ts) ---
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPasswordPlain = process.env.ADMIN_PASSWORD || 'Admin123!@#';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+6281234567890';

    // Remove any existing admin with the same email
    await prisma.user.deleteMany({ where: { email: adminEmail, role: 'admin' } });

    const adminPassword = await bcrypt.hash(adminPasswordPlain, 10);
    const adminMfaSecret = speakeasy.generateSecret({ name: `EMS Admin (${adminEmail})` });

    await prisma.user.create({
      data: {
        name: 'Admin User',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        status: 'active',
        mfaEnabled: false,
        mfaSecret: adminMfaSecret.base32,
        phoneNumber: adminPhone,
      },
    });

    console.log('Admin seeded successfully!');
    console.log(`Admin login: email: ${adminEmail} | password: ${adminPasswordPlain}`);
    console.log('Admin MFA setup:');
    console.log(`Secret (base32): ${adminMfaSecret.base32}`);
    console.log(`otpauth URL: ${adminMfaSecret.otpauth_url}`);
    // --- End admin seeding logic ---

    // Clean up existing data first
    await cleanupDatabase();
    
    // Create products first
    const products = await Promise.all(
      PRODUCTS.map(product => 
        prisma.product.create({
          data: {
            name: product.name,
            description: product.description,
            price: product.price,
            stockLevel: product.stockLevel,
            imageUrl: `https://example.com/images/${product.name.toLowerCase().replace(' ', '-')}.jpg`
          }
        })
      )
    );
    console.log(`Created ${products.length} products`);

    // Create 20 employees
    const employees = [];
    for (let i = 0; i < 20; i++) {
      const firstName = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Emma', 'James', 'Maria'][i % 10];
      const lastName = ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez'][i % 10];
      const city = CITIES[i % CITIES.length];
      const position = POSITIONS[i % POSITIONS.length];
      
      try {
    const user = await prisma.user.create({
    data: {
            name: `${firstName} ${lastName}`,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@example.com`,
            password: await bcrypt.hash('password123', 10),
            role: 'employee',
      status: 'active',
            isApproved: true,
            phoneNumber: `+62${Math.floor(Math.random() * 9000000000) + 1000000000}`, // Generate random Indonesian phone number
      employee: {
        create: {
                position,
                city,
                joinDate: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000),
                pictureUrl: `https://example.com/employees/${firstName.toLowerCase()}-${lastName.toLowerCase()}.jpg`
              }
            }
          },
          include: {
            employee: true
          }
        });
        employees.push(user);
      } catch (error) {
        console.error(`Error creating employee ${i}:`, error);
      }
    }

    console.log(`Created ${employees.length} sample employees`);

    // Create attendance records for the last 7 days for each employee
    for (const user of employees) {
      if (!user.employee) continue;

      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0); // Ensure midnight

        // Randomize status
        const statuses = ["Present", "Late", "Absent"];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        // Only set checkIn/checkOut if not Absent
        let checkIn = null;
        let checkOut = null;
        if (status !== "Absent") {
          checkIn = new Date(date);
          checkIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
          checkOut = new Date(date);
          checkOut.setHours(17, Math.floor(Math.random() * 60), 0, 0);
        }

        await prisma.attendance.create({
          data: {
            employeeId: user.employee.id,
            date,
            checkIn,
            checkOut,
            status,
            notes: status === "Absent" ? "Sick leave" : "",
          }
        });
      }
    }
    console.log('Created sample attendance records');

    // Create employee-product assignments
    for (const user of employees) {
      if (!user.employee) continue;
      
      try {
        // Assign 2-3 random products to each employee
        const numProducts = 2 + Math.floor(Math.random() * 2);
        const shuffledProducts = [...products].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < numProducts; i++) {
          await prisma.employeeProduct.create({
    data: {
              employeeId: user.employee.id,
              productId: shuffledProducts[i].id,
              quantity: 1 + Math.floor(Math.random() * 5)
            }
          });
        }
      } catch (error) {
        console.error(`Error creating product assignments for employee ${user.id}:`, error);
      }
    }

    console.log('Created employee-product assignments');

    // Create sales records for the last 30 days
    for (const user of employees) {
      if (!user.employee) continue;

      try {
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          
          // Random product and quantity
          const product = products[Math.floor(Math.random() * products.length)];
        const quantity = 1 + Math.floor(Math.random() * 5);
          const amount = product.price * quantity;

          await prisma.salesRecord.create({
    data: {
              date,
              amount,
              quantity,
      productId: product.id,
              employeeId: user.employee.id
            }
          });
        }
      } catch (error) {
        console.error(`Error creating sales records for employee ${user.id}:`, error);
      }
    }

    console.log('Created sample sales records');

    // Create time logs for the last 30 days
    for (const user of employees) {
      if (!user.employee) continue;

      try {
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          
          const hours = 6 + Math.floor(Math.random() * 4);
          const overtimeHours = Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0;
          const undertimeHours = Math.random() > 0.9 ? Math.floor(Math.random() * 2) : 0;

          await prisma.timeLog.create({
      data: {
              date,
              hours,
              overtimeHours,
              undertimeHours,
              employeeId: user.employee.id
            }
          });
        }
      } catch (error) {
        console.error(`Error creating time logs for employee ${user.id}:`, error);
      }
    }

    console.log('Created sample time logs');

    // Create sample documents for employees
    const documentTypes = ["ID Document", "Contract", "Certificate", "Report", "Performance Review"];
    const documentStatuses = ["Pending", "Approved", "Rejected"];
    
    for (const user of employees) {
      if (!user.employee) continue;

      try {
        for (let typeIndex = 0; typeIndex < documentTypes.length; typeIndex++) {
          const type = documentTypes[typeIndex];
          const status = documentStatuses[typeIndex % documentStatuses.length];
          const docDate = new Date();
          docDate.setDate(docDate.getDate() - (typeIndex * 5));
          
          await prisma.document.create({
      data: {
              employeeId: user.employee.id,
              type: "passport",
              title: `${user.name}'s ${type}`,
              description: `Sample ${type.toLowerCase()} for ${user.name}`,
              fileUrl: "https://example.com/documents/sample.pdf",
        status,
              isRegistrationDocument: typeIndex === 0,
              uploadedDuring: "registration"
            }
          });
        }
      } catch (error) {
        console.error(`Error creating documents for employee ${user.id}:`, error);
      }
    }

    console.log('Created sample documents');

    // Create sample reports
    for (const user of employees) {
      if (!user.employee) continue;

      try {
        // Create one report of each type
        const reportTypes = ["time", "absence", "sales"];
        for (const type of reportTypes) {
          const details = type === "time" 
            ? { hours: 8, overtimeHours: 2, undertimeHours: 0 }
            : type === "absence"
            ? { absenceType: "sick", duration: 2 }
            : { productName: products[0].name, quantity: 2, amount: products[0].price * 2 };

          await prisma.report.create({
            data: {
              employeeId: user.employee.id,
              type,
              status: "pending",
              details,
              notes: `Sample ${type} report`,
              date: new Date()
            }
          });
        }
      } catch (error) {
        console.error(`Error creating reports for employee ${user.id}:`, error);
      }
    }

    console.log('Created sample reports');

    // Create EmployeeLocation records for each employee (for real-time map testing)
    const totalLocations = employees.length * 10;
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar.start(totalLocations, 0);

    let locCount = 0;
    for (const user of employees) {
      if (!user.employee) continue;
      // Assign a city-based location (Jakarta, Surabaya, Bandung, Medan, Semarang)
      let baseLat = -6.2, baseLng = 106.8; // Jakarta
      if (user.employee.city === 'Surabaya') { baseLat = -7.25; baseLng = 112.75; }
      if (user.employee.city === 'Bandung') { baseLat = -6.917; baseLng = 107.619; }
      if (user.employee.city === 'Medan') { baseLat = 3.595; baseLng = 98.672; }
      if (user.employee.city === 'Semarang') { baseLat = -6.966; baseLng = 110.417; }
      // Simulate 10 locations over the last 5 days
      for (let i = 0; i < 10; i++) {
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - Math.floor(i / 2)); // 2 points per day
        timestamp.setHours(8 + (i % 5) * 2, Math.floor(Math.random() * 60), 0, 0);
        const latitude = baseLat + (Math.random() - 0.5) * 0.1 + i * 0.01;
        const longitude = baseLng + (Math.random() - 0.5) * 0.1 + i * 0.01;
        process.stdout.write(`Seeding location ${i + 1}/10 for ${user.employee.id}... `);
        const address = await reverseGeocode(latitude, longitude);
        await prisma.employeeLocation.create({
          data: {
            employeeId: user.employee.id,
            latitude,
            longitude,
            batteryLevel: 50 + Math.floor(Math.random() * 50),
            timestamp,
            isMoving: Math.random() > 0.5,
            address,
          }
        });
        locCount++;
        bar.update(locCount);
        process.stdout.write('done\n');
      }
    }
    bar.stop();
    console.log('Created sample employee location history');

    // Seed sales records for each employee for the last 7 days
    const allProducts = await prisma.product.findMany();
    for (const emp of employees) {
      for (let i = 0; i < 7; i++) {
        const saleDate = new Date();
        saleDate.setDate(saleDate.getDate() - i);
        saleDate.setHours(10 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0); // Random time in workday
        // Pick a random product
        const product = allProducts[Math.floor(Math.random() * allProducts.length)];
        if (!product) continue;
        const quantity = Math.floor(Math.random() * 5) + 1;
        const amount = product.price * quantity;
        if (!emp.employee || typeof emp.employee.id !== 'number') continue;
        await prisma.sale.create({
          data: {
            employeeId: emp.employee.id,
            productId: product.id,
            date: saleDate,
            quantity,
            amount,
            notes: '',
          },
        });
      }
    }

  } catch (error) {
    console.error('Error seeding sample data:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedSampleData();
  } catch (error) {
    console.error('Error in main seed function:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();