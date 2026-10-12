import { PrismaPg } from '@prisma/adapter-pg';
import { AppointmentLeadsService } from '../src/appointment-leads/appointment-leads.service';
import { PrismaAppointmentLeadRepository } from '../src/appointment-leads/prisma-appointment-lead.repository';
import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = process.env.TEST_DATABASE_URL;
// Point TEST_DATABASE_URL at a migrated PostgreSQL database to enable this suite.
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres('Prisma appointment concurrency (PostgreSQL)', () => {
  const campusId = 'review-concurrency-campus';
  let prisma: PrismaClient;
  let service: AppointmentLeadsService;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl! }),
    });
    await prisma.campus.upsert({
      where: { code: campusId },
      create: { id: campusId, code: campusId, name: '并发测试校区' },
      update: {},
    });
    service = new AppointmentLeadsService(
      new PrismaAppointmentLeadRepository(prisma),
    );
  });

  afterAll(async () => {
    await prisma.appointmentLeadStatusHistory.deleteMany({
      where: { campusId },
    });
    await prisma.appointmentLead.deleteMany({ where: { campusId } });
    await prisma.campus.delete({ where: { id: campusId } });
    await prisma.$disconnect();
  });

  it('returns one row for concurrent idempotent and content-equivalent writes', async () => {
    const runId = Date.now();
    const input = {
      campusId,
      parentName: '并发家长',
      phone: '13800138000',
      childAgeOrGrade: '四年级',
      interestedCourse: `AI 并发课-${Date.now()}`,
      preferredContactTime: '工作日晚间',
    };

    const sameKey = await Promise.all(
      Array.from({ length: 4 }, () =>
        service.create(input, `postgres-concurrent-same-key-${runId}`),
      ),
    );
    expect(new Set(sameKey.map(({ lead }) => lead.id)).size).toBe(1);
    await expect(
      prisma.appointmentLead.count({
        where: { campusId, interestedCourse: input.interestedCourse },
      }),
    ).resolves.toBe(1);

    const duplicateContent = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        service.create(
          { ...input, interestedCourse: `${input.interestedCourse}-duplicate` },
          `postgres-content-key-${runId}-${index}`,
        ),
      ),
    );
    expect(new Set(duplicateContent.map(({ lead }) => lead.id)).size).toBe(1);
    await expect(
      prisma.appointmentLead.count({
        where: {
          campusId,
          interestedCourse: `${input.interestedCourse}-duplicate`,
        },
      }),
    ).resolves.toBe(1);
  });
});
