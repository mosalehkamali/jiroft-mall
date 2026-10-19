'use client';

import { useParams } from 'next/navigation';
import CategoryGrid from '@/components/admin/CategoryGrid';

// دسته‌های یک دپارتمان (قابلیت departments)
export default function SportCategoriesDetail() {
  const { sportId } = useParams();
  return <CategoryGrid sportId={sportId} />;
}
