import type { Metadata } from 'next';
import LabPage from './lab-page';

export const metadata: Metadata = {
  title: '互动实验室｜星芽 AI',
  description:
    '数学、物理、化学、生物、语文、英语六个学科，185 个可以动手操作的互动知识点，覆盖小学到高中。',
};

export default function LabEntry() {
  return <LabPage />;
}
