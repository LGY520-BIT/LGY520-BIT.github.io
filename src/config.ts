import profile from './data/profile.json';

// 网页个人空间保存的资料也是静态构建的唯一品牌来源。
export const site = {
  name: profile.siteName,
  englishName: 'UNFINISHED MEMORIES',
  title: `${profile.siteName} · 月面手账`,
  description: profile.signature,
  author: profile.displayName,
  bio: profile.bio,
  location: profile.location,
  avatar: profile.avatar,
  cover: profile.cover,
  email: '',
  github: '',
  demo: Boolean(profile.sampleMode)
};
