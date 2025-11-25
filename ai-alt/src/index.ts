import {definePlugin} from 'sanity'
import {AltTextGeneratorTool} from './altTextGenerator'

interface MyPluginConfig {
  /* nothing here yet */
}

/**
 * Usage in `sanity.config.ts` (or .js)
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {myPlugin} from 'sanity-plugin-ai-alt'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [myPlugin()],
 * })
 * ```
 *
 * @public
 */
export const aiAltText = definePlugin<MyPluginConfig | void>((config = {}) => {
  // eslint-disable-next-line no-console
  return {
    name: 'sanity-plugin-ai-alt',
    schema: {
      types: [
        {
          name: 'altTextPluginSettings',
          title: 'Alt Text Plugin Settings',
          type: 'document',
          fields: [
            {
              name: 'apiKey',
              title: 'OpenAI API Key',
              type: 'string',
            },
            {
              name: 'model',
              title: 'Model',
              type: 'string',
            },
            {
              name: 'globalContext',
              title: 'Global Context',
              type: 'text',
            },
            {
              name: 'recentContexts',
              title: 'Recent Contexts',
              type: 'array',
              of: [{type: 'string'}],
            },
          ],
        },
      ],
    },
    tools: [
      {
        name: 'alt-text-generator',
        title: 'AI Alt Text',
        icon: () => '✨',
        component: AltTextGeneratorTool,
      },
    ],
  }
})
