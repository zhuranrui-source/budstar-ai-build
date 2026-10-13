-- ③ AI 引导：实验室「教师参考」全文作为个性化讲解上下文
ALTER TABLE "SubjectChapter" ADD COLUMN "aiContext" TEXT;
