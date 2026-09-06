import { appConfig } from './app.config';

export const seoConfig = {
  // A pipe, matching `titleTemplate` below, so the home page's title is
  // punctuated the same way as every other page's.
  defaultTitle: `${appConfig.name} | ${appConfig.tagline}`,
  titleTemplate: `%s | ${appConfig.name}`,
  defaultDescription: appConfig.description,
  defaultOgImage: '/og-default.png',
  /*
   * No `twitterHandle`.
   *
   * This used to read '@rejoice', which is not Rejoice's account — it was
   * placeholder text that shipped, and every shared link credited a stranger
   * with the site. An absent `twitter:site` is correct; a wrong one is worse
   * than none. If an account is ever opened, add the handle back here and
   * `buildMetadata` will start emitting the tag again.
   */
  locale: 'en_US',
} as const;
