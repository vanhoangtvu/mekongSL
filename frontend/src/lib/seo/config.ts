import type { Metadata } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "../constants/app";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3004";

export const siteConfig = {
  name: APP_NAME,
  tagline: APP_TAGLINE,
  description: APP_DESCRIPTION,
  url: SITE_URL,
  ogImage: `${SITE_URL}/logo.png`,
  locale: "vi_VN",
} as const;

export const openGraphDefaults = {
  siteName: siteConfig.name,
  locale: siteConfig.locale,
  type: "website" as const,
  images: [
    {
      url: siteConfig.ogImage,
      width: 1200 as const,
      height: 630 as const,
      alt: siteConfig.name,
    },
  ],
};

export const twitterDefaults = {
  card: "summary_large_image" as const,
  images: [siteConfig.ogImage],
};

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    ...openGraphDefaults,
    title: siteConfig.name,
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    ...twitterDefaults,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const homeMetadata: Metadata = {
  title: `${siteConfig.name} - ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    ...openGraphDefaults,
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    ...twitterDefaults,
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
};
