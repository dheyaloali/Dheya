import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addLocationData() {
  try {
    console.log('Starting to add location data...');
    
    // Get all employees
    const employees = await prisma.employee.findMany();
    console.log(`Found ${employees.length} employees in the database`);
    
    if (employees.length === 0) {
      console.log('No employees found. Please ensure there are employees in the database.');
      return;
    }
    
    // Add Jakarta locations
    for (const employee of employees) {
      // Create a random location in Jakarta, Indonesia
      const latitude = -6.1 - Math.random() * 0.2; // Around Jakarta
      const longitude = 106.8 + Math.random() * 0.2; // Around Jakarta
      
      // Add a new location for this employee
      const location = await prisma.employeeLocation.create({
        data: {
          employeeId: employee.id,
          latitude,
          longitude,
          timestamp: new Date(),
          batteryLevel: Math.floor(Math.random() * 100),
          address: "Jakarta, Indonesia"
        },
      });
      
      console.log(`Added Jakarta location for employee ${employee.id}: ${location.latitude}, ${location.longitude}`);
    }
    
    // Add Bandung locations
    for (const employee of employees) {
      // Create a random location in Bandung, Indonesia
      const latitude = -6.9 - Math.random() * 0.2; // Around Bandung
      const longitude = 107.6 + Math.random() * 0.2; // Around Bandung
      
      // Add a new location for this employee
      const location = await prisma.employeeLocation.create({
        data: {
          employeeId: employee.id,
          latitude,
          longitude,
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          batteryLevel: Math.floor(Math.random() * 100),
          address: "Bandung, Indonesia"
        },
      });
      
      console.log(`Added Bandung location for employee ${employee.id}: ${location.latitude}, ${location.longitude}`);
    }
    
    // Add Surabaya locations
    for (const employee of employees) {
      // Create a random location in Surabaya, Indonesia
      const latitude = -7.2 - Math.random() * 0.2; // Around Surabaya
      const longitude = 112.7 + Math.random() * 0.2; // Around Surabaya
      
      // Add a new location for this employee
      const location = await prisma.employeeLocation.create({
        data: {
          employeeId: employee.id,
          latitude,
          longitude,
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          batteryLevel: Math.floor(Math.random() * 100),
          address: "Surabaya, Indonesia"
        },
      });
      
      console.log(`Added Surabaya location for employee ${employee.id}: ${location.latitude}, ${location.longitude}`);
    }
    
    console.log('Location data added successfully!');
  } catch (error) {
    console.error('Error adding location data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addLocationData()
  .then(() => console.log('Finished adding location data.'))
  .catch(console.error); 