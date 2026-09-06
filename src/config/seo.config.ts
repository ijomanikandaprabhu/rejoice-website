import { appConfig } from './app.config';

export const seoConfig = {
  // A pipe, matching `titleTemplate` below, so the home page's title is
  // punctuated the same way as every other page's.
  defaultTitle: `${appConfig.name} | ${appConfig.tagline}`,
  titleTemplate: `%s | ${appConfig.name}`,
  defaultDescription: appConfig.description,
  defaultOgImage: '/og-default.png',
  twitterHandle: '@rejoice',
  locale: 'en_US',
} as const;
