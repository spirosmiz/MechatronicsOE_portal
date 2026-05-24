import { PrismaClient } from '@prisma/client';
import { UserRole, JobType, StatusType } from '../lib/enums';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Users
  const adminHash = await bcrypt.hash('admin123', 12);
  const pmHash = await bcrypt.hash('manager123', 12);
  const techHash = await bcrypt.hash('tech123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mechatroniqs.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@mechatroniqs.com',
      passwordHash: adminHash,
      role: UserRole.admin,
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: 'pm@mechatroniqs.com' },
    update: {},
    create: {
      name: 'Alex Papadopoulos',
      email: 'pm@mechatroniqs.com',
      passwordHash: pmHash,
      role: UserRole.project_manager,
    },
  });

  const tech = await prisma.user.upsert({
    where: { email: 'tech@mechatroniqs.com' },
    update: {},
    create: {
      name: 'Nikos Georgiou',
      email: 'tech@mechatroniqs.com',
      passwordHash: techHash,
      role: UserRole.technician,
    },
  });

  // Customers
  const customer1 = await prisma.customer.upsert({
    where: { vatNumber: 'EL123456789' },
    update: {},
    create: {
      companyName: 'Hellenic Steel Works S.A.',
      vatNumber: 'EL123456789',
      contactPerson: 'Dimitris Kostas',
      email: 'info@hellenicsteel.gr',
      phone: '+30 210 555 0100',
      address: 'Piraeus Industrial Zone, Block 4, Piraeus 18545, Greece',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { vatNumber: 'EL987654321' },
    update: {},
    create: {
      companyName: 'Aegean Manufacturing Ltd.',
      vatNumber: 'EL987654321',
      contactPerson: 'Maria Stavros',
      email: 'contact@aegeanmfg.gr',
      phone: '+30 2310 444 200',
      address: 'Thessaloniki Industrial Park, Unit 12, Thessaloniki 57022, Greece',
    },
  });

  // Machines
  const machine1 = await prisma.machine.upsert({
    where: { serialNumber: 'CNC-2019-001' },
    update: {},
    create: {
      customerId: customer1.id,
      name: 'CNC Plasma Cutter',
      model: 'Hypertherm XPR300',
      serialNumber: 'CNC-2019-001',
      manufacturer: 'Hypertherm',
      technicalSpecs: JSON.stringify({
        voltage: '3-phase 400V',
        power_kw: 22,
        cutting_thickness_mm: 80,
        table_size_m: '3x6',
      }),
    },
  });

  const machine2 = await prisma.machine.upsert({
    where: { serialNumber: 'PRESS-2017-005' },
    update: {},
    create: {
      customerId: customer1.id,
      name: 'Hydraulic Press Brake',
      model: 'Amada HFE3i-1703',
      serialNumber: 'PRESS-2017-005',
      manufacturer: 'Amada',
      technicalSpecs: JSON.stringify({
        voltage: '3-phase 400V',
        tonnage: 170,
        bending_length_mm: 3000,
        control_system: 'AMNC-3i',
      }),
    },
  });

  const machine3 = await prisma.machine.upsert({
    where: { serialNumber: 'WELD-2021-009' },
    update: {},
    create: {
      customerId: customer2.id,
      name: 'MIG Welding Robot Cell',
      model: 'KUKA KR 16 R1610',
      serialNumber: 'WELD-2021-009',
      manufacturer: 'KUKA',
      technicalSpecs: JSON.stringify({
        reach_mm: 1610,
        payload_kg: 16,
        axes: 6,
        welding_process: 'MIG/MAG',
      }),
    },
  });

  // Inventory
  const inv1 = await prisma.inventory.upsert({
    where: { partNumber: 'PLC-SIEMENS-1200' },
    update: {},
    create: {
      partNumber: 'PLC-SIEMENS-1200',
      name: 'Siemens S7-1200 CPU 1214C',
      description: 'Compact PLC with 14 DI, 10 DO, 2 AI. DC/DC/DC variant.',
      stockQuantity: 8,
      safetyStockLevel: 3,
      unitCost: 380.00,
      unitPrice: 520.00,
      ceCertified: true,
    },
  });

  const inv2 = await prisma.inventory.upsert({
    where: { partNumber: 'HMI-SIEMENS-KTP700' },
    update: {},
    create: {
      partNumber: 'HMI-SIEMENS-KTP700',
      name: 'Siemens KTP700 Basic Panel',
      description: '7" touch + key panel, 800x480 resolution, PROFINET.',
      stockQuantity: 4,
      safetyStockLevel: 2,
      unitCost: 620.00,
      unitPrice: 890.00,
      ceCertified: true,
    },
  });

  const inv3 = await prisma.inventory.upsert({
    where: { partNumber: 'VFD-ABB-ACS580' },
    update: {},
    create: {
      partNumber: 'VFD-ABB-ACS580',
      name: 'ABB ACS580 15kW Variable Frequency Drive',
      description: 'General purpose drive 15kW 400V 3-phase with built-in EMC filter.',
      stockQuantity: 2,
      safetyStockLevel: 1,
      unitCost: 1150.00,
      unitPrice: 1680.00,
      ceCertified: true,
    },
  });

  const inv4 = await prisma.inventory.upsert({
    where: { partNumber: 'SERVO-PANASONIC-A6' },
    update: {},
    create: {
      partNumber: 'SERVO-PANASONIC-A6',
      name: 'Panasonic MINAS A6 400W Servo System',
      description: '400W servo motor + driver combo, EtherCAT interface.',
      stockQuantity: 12,
      safetyStockLevel: 4,
      unitCost: 540.00,
      unitPrice: 780.00,
      ceCertified: true,
    },
  });

  const inv5 = await prisma.inventory.upsert({
    where: { partNumber: 'CABLE-LAPP-0010260' },
    update: {},
    create: {
      partNumber: 'CABLE-LAPP-0010260',
      name: 'LAPP ÖLFLEX CLASSIC 110 4G2.5mm² (per meter)',
      description: 'Oil and UV resistant flexible control cable, 4 cores 2.5mm².',
      stockQuantity: 500,
      safetyStockLevel: 100,
      unitCost: 1.85,
      unitPrice: 3.20,
      ceCertified: true,
    },
  });

  // Projects
  const project1 = await prisma.project.create({
    data: {
      customerId: customer1.id,
      machineId: machine1.id,
      title: 'CNC Plasma Cutter – Full Electrical Retrofit',
      type: JobType.electrical_upgrade,
      status: StatusType.in_progress,
      estimatedLaborHours: 80.00,
      actualLaborHours: 32.00,
      quotedTotalPrice: 15800.00,
      termsAndConditions: 'Net 30 days. Warranty: 12 months on parts and labor.',
      createdBy: pm.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      customerId: customer2.id,
      machineId: machine3.id,
      title: 'Welding Robot Cell – Annual Preventive Maintenance',
      type: JobType.maintenance,
      status: StatusType.approved,
      estimatedLaborHours: 24.00,
      actualLaborHours: 0.00,
      quotedTotalPrice: 3200.00,
      termsAndConditions: 'Net 15 days. Service included as per contract SLA-2024-007.',
      createdBy: pm.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      customerId: customer1.id,
      machineId: machine2.id,
      title: 'Press Brake Control System Reconstruction',
      type: JobType.reconstruction,
      status: StatusType.draft,
      estimatedLaborHours: 120.00,
      actualLaborHours: 0.00,
      quotedTotalPrice: 28500.00,
      termsAndConditions: 'Net 45 days. 30% deposit required before work commences.',
      createdBy: admin.id,
    },
  });

  // Project Materials
  await prisma.projectMaterial.create({
    data: {
      projectId: project1.id,
      inventoryId: inv1.id,
      quantityRequired: 2,
      unitCostAtQuote: 380.00,
      unitPriceAtQuote: 520.00,
    },
  });

  await prisma.projectMaterial.create({
    data: {
      projectId: project1.id,
      inventoryId: inv2.id,
      quantityRequired: 1,
      unitCostAtQuote: 620.00,
      unitPriceAtQuote: 890.00,
    },
  });

  await prisma.projectMaterial.create({
    data: {
      projectId: project1.id,
      inventoryId: inv5.id,
      quantityRequired: 50,
      unitCostAtQuote: 1.85,
      unitPriceAtQuote: 3.20,
    },
  });

  await prisma.projectMaterial.create({
    data: {
      projectId: project3.id,
      inventoryId: inv1.id,
      quantityRequired: 1,
      unitCostAtQuote: 380.00,
      unitPriceAtQuote: 520.00,
    },
  });

  await prisma.projectMaterial.create({
    data: {
      projectId: project3.id,
      inventoryId: inv4.id,
      quantityRequired: 4,
      unitCostAtQuote: 540.00,
      unitPriceAtQuote: 780.00,
    },
  });

  // Service Reports
  await prisma.serviceReport.create({
    data: {
      projectId: project1.id,
      technicianId: tech.id,
      workPerformed:
        'Removed old Fanuc 0i control cabinet. Installed new Siemens S7-1200 PLC and KTP700 HMI panel. Rewired I/O connections per new wiring diagram REV-A. Performed initial power-on tests – all inputs/outputs verified.',
      hoursLogged: 16.00,
      digitalSignature: 'NIKOS_GEORGIOU_2026-05-10',
      submittedAt: new Date('2026-05-10T17:00:00Z'),
    },
  });

  await prisma.serviceReport.create({
    data: {
      projectId: project1.id,
      technicianId: tech.id,
      workPerformed:
        'Completed PLC software configuration and HMI screen development. Conducted full motion test on all plasma cutting axes. Calibrated torch height controller. Remaining: final acceptance test with customer.',
      hoursLogged: 16.00,
      digitalSignature: 'NIKOS_GEORGIOU_2026-05-14',
      submittedAt: new Date('2026-05-14T18:30:00Z'),
    },
  });

  console.log('Seed complete.');
  console.log(`Created users: ${admin.email}, ${pm.email}, ${tech.email}`);
  console.log(`Created customers: ${customer1.companyName}, ${customer2.companyName}`);
  console.log(`Created projects: ${project1.title}, ${project2.title}, ${project3.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
