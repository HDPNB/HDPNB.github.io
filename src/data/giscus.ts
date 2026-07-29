/**
 * 在 https://giscus.app/zh-CN 获取参数后填写。
 * repo 仅存在于源代码配置中；未配置时，访客只会看到友好的留言占位。
 */
export const giscusConfig = {
  enabled: false,
  repo: '',
  repoId: '',
  category: '',
  categoryId: '',
  mapping: 'pathname',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'top',
  lang: 'zh-CN',
} as const;
