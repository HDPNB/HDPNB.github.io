export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function readingTime(body: string) {
  const chinese = (body.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = body.replace(/[\u4e00-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil((chinese + words * 1.5) / 400));
}
