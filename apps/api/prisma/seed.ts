import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@roadnest.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMeNow!2026';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: process.env.ADMIN_NAME || 'Shop Administrator', role: 'ADMIN' },
    create: { name: process.env.ADMIN_NAME || 'Shop Administrator', email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), role: 'ADMIN' },
  });
  const vehicles: any[] = [
    { type:'CAR', category:'HATCHBACK', brand:'Maruti Suzuki', model:'Swift', displayName:'Maruti Suzuki Swift', registrationNumber:'DEMO-CAR-001', year:2024, fuelType:'PETROL', transmission:'MANUAL', seats:5, hourlyRatePaise:25000, dailyRatePaise:180000, weeklyRatePaise:1050000, monthlyRatePaise:3600000, securityDepositPaise:300000, includedKmPerDay:200, extraKmRatePaise:800, lateFeePerHourPaise:15000, pickupLocation:process.env.NEXT_PUBLIC_SHOP_CITY || 'Your shop location', features:['AC','Bluetooth','5 seats'], isFeatured:true },
    { type:'CAR', category:'SUV', brand:'Hyundai', model:'Creta', displayName:'Hyundai Creta', registrationNumber:'DEMO-CAR-002', year:2023, fuelType:'DIESEL', transmission:'AUTOMATIC', seats:5, hourlyRatePaise:40000, dailyRatePaise:280000, weeklyRatePaise:1750000, monthlyRatePaise:6200000, securityDepositPaise:500000, includedKmPerDay:200, extraKmRatePaise:1000, lateFeePerHourPaise:20000, pickupLocation:process.env.NEXT_PUBLIC_SHOP_CITY || 'Your shop location', features:['AC','Reverse camera','Automatic'], isFeatured:true },
    { type:'BIKE', category:'MOTORCYCLE', brand:'Royal Enfield', model:'Classic 350', displayName:'Royal Enfield Classic 350', registrationNumber:'DEMO-BIKE-001', year:2024, fuelType:'PETROL', transmission:'MANUAL', engineCc:350, hourlyRatePaise:10000, dailyRatePaise:80000, weeklyRatePaise:480000, monthlyRatePaise:1600000, securityDepositPaise:200000, includedKmPerDay:150, extraKmRatePaise:500, lateFeePerHourPaise:8000, pickupLocation:process.env.NEXT_PUBLIC_SHOP_CITY || 'Your shop location', features:['Helmet included','350cc'], isFeatured:true },
    { type:'BIKE', category:'SCOOTER', brand:'Honda', model:'Activa 6G', displayName:'Honda Activa 6G', registrationNumber:'DEMO-BIKE-002', year:2023, fuelType:'PETROL', transmission:'AUTOMATIC', engineCc:110, hourlyRatePaise:5000, dailyRatePaise:45000, weeklyRatePaise:260000, monthlyRatePaise:850000, securityDepositPaise:100000, includedKmPerDay:120, extraKmRatePaise:300, lateFeePerHourPaise:5000, pickupLocation:process.env.NEXT_PUBLIC_SHOP_CITY || 'Your shop location', features:['Automatic','Helmet included'] },
  ];
  for (const v of vehicles) {
    await prisma.vehicle.upsert({ where: { registrationNumber: v.registrationNumber }, update: {}, create: v });
  }
  console.log(`Seed complete. Admin: ${adminEmail}. Demo vehicles: ${vehicles.length}.`);
}
main().finally(() => prisma.$disconnect());
