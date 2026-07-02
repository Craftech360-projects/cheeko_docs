// @ts-check
const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Cheeko Docs',
  tagline: 'AI Companion for Children — Backend & Firmware Reference',
  favicon: 'img/favicon.ico',

  url: 'https://docs.cheeko.ai',
  baseUrl: '/',

  organizationName: 'Craftech360-projects',
  projectName: 'cheeko_docs',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/',
          editUrl: 'https://github.com/Craftech360-projects/cheeko_docs/edit/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Cheeko Docs',
        items: [
          { type: 'docSidebar', sidebarId: 'mainSidebar', position: 'left', label: 'Docs' },
          {
            label: 'Repos',
            position: 'right',
            items: [
              { href: 'https://github.com/Craftech360-projects/cheeko_docs', label: 'Docs Site' },
              { href: 'https://github.com/Craftech360-projects/cheeko-backend', label: 'Backend' },
              { href: 'https://github.com/Craftech360-projects/picoclaw-chat', label: 'Voice Agent (picoclaw)' },
              { href: 'https://github.com/Craftech360-projects/line_art', label: 'Imagine Server (line_art)' },
              { href: 'https://github.com/Craftech360-projects/CheekoAI-Parent-App', label: 'Parent App' },
            ],
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Copyright © ${new Date().getFullYear()} Cheeko. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'python', 'java', 'cpp'],
      },
    }),
};

module.exports = config;
