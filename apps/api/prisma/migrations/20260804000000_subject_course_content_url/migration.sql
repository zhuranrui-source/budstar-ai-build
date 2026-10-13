-- 学科内容：高中学段 + 通用学段、跨年级可空、自包含互动实验室走静态文件 URL
ALTER TABLE "SubjectCourse" ALTER COLUMN "gradeLevel" DROP NOT NULL;
ALTER TABLE "SubjectChapter" ADD COLUMN "contentUrl" VARCHAR(1000);
