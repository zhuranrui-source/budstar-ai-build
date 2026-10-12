import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { buildXingyaSeedPackageDraft } from '../src/course-packages/xingya-seed-skeleton';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed campuses');
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    await prisma.campus.upsert({
      where: { code: 'shenzhen-nanshan' },
      create: {
        id: 'shenzhen-nanshan',
        code: 'shenzhen-nanshan',
        name: '深圳南山校区',
      },
      update: { name: '深圳南山校区' },
    });

    const draft = buildXingyaSeedPackageDraft('1.0.0');
    const existing = await prisma.coursePackageVersion.findUnique({
      where: {
        packageKey_version: {
          packageKey: draft.packageKey,
          version: draft.version,
        },
      },
    });
    if (!existing) {
      const versionId = randomUUID();
      const now = new Date();
      await prisma.coursePackageVersion.create({
        data: {
          id: versionId,
          packageKey: draft.packageKey,
          version: draft.version,
          title: draft.title,
          status: 'PUBLISHED',
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
          mainLessons: {
            create: draft.mainLessons.map((lesson) => ({
              id: randomUUID(),
              sequence: lesson.sequence,
              track: lesson.track,
              title: lesson.title,
              theme: lesson.theme,
              coreDeliverable: lesson.coreDeliverable,
              learningGoals: lesson.learningGoals,
              assignmentTemplate: {
                create: {
                  id: randomUUID(),
                  title: lesson.assignment.title,
                  requirements: lesson.assignment.requirements,
                  submissionKinds: lesson.assignment.submissionKinds.join(','),
                },
              },
            })),
          },
          onlineQaSessions: {
            create: draft.onlineQaSessions.map((session) => ({
              id: randomUUID(),
              sequence: session.sequence,
              afterLessonSequence: session.afterLessonSequence,
              title: session.title,
              topic: session.topic,
            })),
          },
          rubrics: {
            create: draft.rubrics.map((rubric) => ({
              id: randomUUID(),
              name: rubric.name,
              dimensionsJson: JSON.stringify(rubric.dimensions),
            })),
          },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
