import { appConfig } from './app.config';

export const seoConfig = {
  defaultTitle: `${appConfig.name} — ${appConfig.tagline}`,
  titleTemplate: `%s | ${appConfig.name}`,
  defaultDescription: appConfig.description,
  defaultOgImage: '/og-default.png',
  twitterHandle: '@rejoice',
  locale: 'en_US',
} as const;
