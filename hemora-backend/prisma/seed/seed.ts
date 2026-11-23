import { PrismaClient, UserRole, BloodGroup, BloodComponent, Urgency, RequisitionStatus, CampaignStatus, InvitationStatus } from "../../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("FATAL: DATABASE_URL is not set in .env");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

// ── Demo password (same for all accounts) ──
const DEMO_PASSWORD = "Demo1234!";

async function main() {
    console.log("🌱 Starting database seed...");

    // Hash the demo password using Argon2id
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    console.log("✅ Password hashed with Argon2id");

    // ── Facilities ──
    const generalHospital = await prisma.facility.upsert({
        where: { id: "facility-general-hospital" },
        update: {},
        create: {
            id: "facility-general-hospital",
            name: "Kafue General Hospital",
            type: "Hospital",
            address: "Plot 45, Kafue Road, Lusaka",
            phone: "+260 211 234 567",
        },
    });

    const ubongoHospital = await prisma.facility.upsert({
        where: { id: "facility-ubongo" },
        update: {},
        create: {
            id: "facility-ubongo",
            name: "Ubongo Hospital",
            type: "Hospital",
            address: "Ubongo Road, Lusaka",
            phone: "+260 211 345 678",
        },
    });

    const bloodBank = await prisma.facility.upsert({
        where: { id: "facility-blood-bank" },
        update: {},
        create: {
            id: "facility-blood-bank",
            name: "National Blood Transfusion Service",
            type: "Blood Bank",
            address: "Ridgway, Lusaka",
            phone: "+260 211 456 789",
        },
    });

    const ruralClinic = await prisma.facility.upsert({
        where: { id: "facility-rural-clinic" },
        update: {},
        create: {
            id: "facility-rural-clinic",
            name: "Choma Rural Health Clinic",
            type: "Clinic",
            address: "Choma District, Southern Province",
            phone: "+260 213 123 456",
        },
    });

    const kawambwaHospital = await prisma.facility.upsert({
        where: { id: "facility-kawambwa" },
        update: {},
        create: {
            id: "facility-kawambwa",
            name: "Kawambwa General Hospital",
            type: "Hospital",
            address: "Kawambwa District, Luapula Province",
            phone: "+260772231300",
        },
    });

    console.log("✅ Facilities seeded");

    // ── Demo Users ──
    const users = [
        {
            email: "admin@hemora.zm",
            name: "Chimputu Kafiswe Jr",
            role: UserRole.ADMIN,
            facilityId: null,
        },
        {
            email: "bankmanager@hemora.zm",
            name: "Mulenga Banda",
            role: UserRole.MANAGER,
            facilityId: bloodBank.id,
        },
        {
            email: "facilityadmin@hemora.zm",
            name: "Thandiwe Phiri",
            role: UserRole.MANAGER,
            facilityId: generalHospital.id,
        },
        {
            email: "doctor@hemora.zm",
            name: "Dr. Chanda Mwale",
            role: UserRole.DOCTOR,
            facilityId: generalHospital.id,
            licenseNo: "HPCZ-12345",
            bloodGroup: BloodGroup.O_POS,
        },
        {
            email: "nurse@hemora.zm",
            name: "Grace Tembo",
            role: UserRole.NURSE,
            facilityId: generalHospital.id,
            bloodGroup: BloodGroup.A_POS,
        },
        {
            email: "donor@hemora.zm",
            name: "Bwalya Mutale",
            role: UserRole.DONOR,
            facilityId: null,
            bloodGroup: BloodGroup.O_NEG,
            phone: "+260 97 123 4567",
            eligible: true,
        },
        {
            email: "donor2@hemora.zm",
            name: "Chilufya Sikazwe",
            role: UserRole.DONOR,
            facilityId: null,
            bloodGroup: BloodGroup.A_POS,
            phone: "+260 96 234 5678",
            eligible: true,
        },
        {
            email: "donor3@hemora.zm",
            name: "Mutinta Kapembwa",
            role: UserRole.DONOR,
            facilityId: null,
            bloodGroup: BloodGroup.B_POS,
            phone: "+260 95 345 6789",
            eligible: true,
        },
        {
            email: "doctor2@hemora.zm",
            name: "Dr. Namunda Zulu",
            role: UserRole.DOCTOR,
            facilityId: ubongoHospital.id,
            licenseNo: "HPCZ-67890",
            bloodGroup: BloodGroup.AB_POS,
        },
        {
            email: "nurse2@hemora.zm",
            name: "Luyando Musonda",
            role: UserRole.NURSE,
            facilityId: ubongoHospital.id,
            bloodGroup: BloodGroup.O_POS,
        },
    ];

    const createdUsers: any[] = [];

    for (const u of users) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { passwordHash }, // Update password hash on existing users
            create: {
                name: u.name,
                email: u.email,
                emailVerified: true,
                role: u.role,
                banned: false,
                passwordHash,
                bloodGroup: u.bloodGroup,
                phone: u.phone,
                eligible: u.eligible ?? true,
                facilityId: u.facilityId,
                licenseNo: u.licenseNo,
            },
        });

        createdUsers.push(user);
        console.log(`  ✅ User: ${u.name} (${u.email}) — ${u.role} [id: ${user.id}]`);
    }

    // ── Blood Inventory ──
    const bloodGroups: BloodGroup[] = [
        BloodGroup.A_POS, BloodGroup.A_NEG,
        BloodGroup.B_POS, BloodGroup.B_NEG,
        BloodGroup.AB_POS, BloodGroup.AB_NEG,
        BloodGroup.O_POS, BloodGroup.O_NEG,
    ];

    const components: BloodComponent[] = [
        BloodComponent.WHOLE_BLOOD,
        BloodComponent.Packed_RBC,
        BloodComponent.PLASMA,
        BloodComponent.PLATELETS,
    ];

    // Clear existing inventory and re-seed
    await prisma.bloodInventory.deleteMany({});

    const inventoryData: any[] = [];
    for (const bg of bloodGroups) {
        for (const comp of components) {
            // Realistic stock levels: O+ and A+ higher, rare groups lower
            let units = 20;
            if (bg === BloodGroup.O_POS) units = 45;
            else if (bg === BloodGroup.A_POS) units = 35;
            else if (bg === BloodGroup.B_POS) units = 25;
            else if (bg === BloodGroup.O_NEG) units = 12;
            else if (bg === BloodGroup.AB_NEG) units = 5;
            else if (bg === BloodGroup.AB_POS) units = 8;

            if (comp === BloodComponent.Packed_RBC) units = Math.floor(units * 0.6);
            else if (comp === BloodComponent.PLASMA) units = Math.floor(units * 0.4);
            else if (comp === BloodComponent.PLATELETS) units = Math.floor(units * 0.3);

            inventoryData.push({
                bloodGroup: bg,
                component: comp,
                units,
                minThreshold: 15,
                expiresAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // 35 days from now
            });
        }
    }

    await prisma.bloodInventory.createMany({ data: inventoryData });
    console.log(`✅ Blood inventory seeded: ${inventoryData.length} records`);

    // ── Requisitions ──
    const doctor = createdUsers.find((u: any) => u.role === UserRole.DOCTOR);
    const doctor2 = createdUsers.find((u: any) => u.email === "doctor2@hemora.zm");
    const bankManager = createdUsers.find((u: any) => u.email === "bankmanager@hemora.zm");

    if (doctor && bankManager) {
        const requisitions = [
            {
                requesterId: doctor.id,
                patientName: "Patient A. Mweetwa",
                patientRef: "GH-2024-001",
                bloodGroup: BloodGroup.O_POS,
                component: BloodComponent.Packed_RBC,
                unitsNeeded: 2,
                urgency: Urgency.EMERGENCY,
                status: RequisitionStatus.APPROVED,
                clinicalNote: "Post-surgery transfusion for acute blood loss",
                facilityId: generalHospital.id,
                approvedBy: bankManager.id,
                approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            },
            {
                requesterId: doctor.id,
                patientName: "Patient B. Chileshe",
                patientRef: "GH-2024-002",
                bloodGroup: BloodGroup.A_POS,
                component: BloodComponent.WHOLE_BLOOD,
                unitsNeeded: 1,
                urgency: Urgency.ROUTINE,
                status: RequisitionStatus.PENDING,
                clinicalNote: "Elective surgery scheduled for next week",
                facilityId: generalHospital.id,
            },
            {
                requesterId: doctor2?.id || doctor.id,
                patientName: "Patient C. Banda",
                patientRef: "UB-2024-001",
                bloodGroup: BloodGroup.B_POS,
                component: BloodComponent.Packed_RBC,
                unitsNeeded: 3,
                urgency: Urgency.URGENT,
                status: RequisitionStatus.PENDING,
                clinicalNote: "Severe anemia, hemoglobin 5.2 g/dL",
                facilityId: ubongoHospital.id,
            },
            {
                requesterId: doctor.id,
                patientName: "Patient D. Phiri",
                patientRef: "NBT-2024-001",
                bloodGroup: BloodGroup.O_NEG,
                component: BloodComponent.PLASMA,
                unitsNeeded: 1,
                urgency: Urgency.URGENT,
                status: RequisitionStatus.APPROVED,
                clinicalNote: "Coagulation disorder, factor replacement",
                facilityId: bloodBank.id,
                approvedBy: bankManager.id,
                approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            },
            {
                requesterId: doctor2?.id || doctor.id,
                patientName: "Patient E. Musonda",
                patientRef: "CH-2024-001",
                bloodGroup: BloodGroup.AB_POS,
                component: BloodComponent.PLATELETS,
                unitsNeeded: 2,
                urgency: Urgency.ROUTINE,
                status: RequisitionStatus.REJECTED,
                clinicalNote: "Platelet transfusion for thrombocytopenia",
                facilityId: ruralClinic.id,
                approvedBy: bankManager.id,
                approvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            },
        ];

        for (const req of requisitions) {
            await prisma.requisition.create({ data: req });
        }
        console.log(`✅ Requisitions seeded: ${requisitions.length} records`);
    }

    // ── Campaigns ──
    const campaign1 = await prisma.campaign.create({
        data: {
            title: "O+ Blood Drive — November 2024",
            description: "Urgent need for O+ donors. Our stock is critically low. Please donate and save lives.",
            bloodGroup: BloodGroup.O_POS,
            targetUnits: 20,
            status: CampaignStatus.ACTIVE,
            startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdBy: bankManager?.id || "",
        },
    });

    const campaign2 = await prisma.campaign.create({
        data: {
            title: "General Donor Mobilisation — December 2024",
            description: "Help us prepare for the holiday season. All blood groups needed.",
            targetUnits: 50,
            status: CampaignStatus.ACTIVE,
            startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            createdBy: bankManager?.id || "",
        },
    });

    console.log("✅ Campaigns seeded");

    // ── Campaign Invitations ──
    const donors = createdUsers.filter((u: any) => u.role === UserRole.DONOR);
    for (const donor of donors) {
        await prisma.campaignInvitation.create({
            data: {
                campaignId: campaign1.id,
                donorId: donor.id,
                status: donor.email === "donor@hemora.zm" ? InvitationStatus.ACCEPTED : InvitationStatus.PENDING,
                respondedAt: donor.email === "donor@hemora.zm" ? new Date() : null,
            },
        });
        await prisma.campaignInvitation.create({
            data: {
                campaignId: campaign2.id,
                donorId: donor.id,
                status: InvitationStatus.PENDING,
            },
        });
    }
    console.log(`✅ Campaign invitations seeded for ${donors.length} donors`);

    // ── Summary ──
    console.log("\n📊 Seed Summary:");
    console.log(`  Facilities: ${await prisma.facility.count()}`);
    console.log(`  Users: ${await prisma.user.count()}`);
    console.log(`  Blood Inventory: ${await prisma.bloodInventory.count()}`);
    console.log(`  Requisitions: ${await prisma.requisition.count()}`);
    console.log(`  Campaigns: ${await prisma.campaign.count()}`);
    console.log(`  Campaign Invitations: ${await prisma.campaignInvitation.count()}`);
    console.log("\n🔑 Demo Password for all accounts: Demo1234!");
    console.log("\n📋 Demo Accounts:");
    console.log(`  admin@hemora.zm        — Chimputu Kafiswe Jr`);
    console.log(`  bankmanager@hemora.zm  — Blood Bank Manager (MANAGER role)`);
    console.log(`  facilityadmin@hemora.zm — Facility Manager (MANAGER role)`);
    console.log(`  doctor@hemora.zm       — Doctor (Kafue General Hospital)`);
    console.log(`  nurse@hemora.zm        — Nurse (Kafue General Hospital)`);
    console.log(`  donor@hemora.zm        — Blood Donor`);
    console.log(`  donor2@hemora.zm       — Blood Donor`);
    console.log(`  donor3@hemora.zm       — Blood Donor`);
    console.log(`  doctor2@hemora.zm      — Doctor (Ubongo Hospital)`);
    console.log(`  nurse2@hemora.zm       — Nurse (Ubongo Hospital)`);
    console.log("\n✅ Database seed complete!");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
