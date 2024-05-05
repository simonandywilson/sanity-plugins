import {defineField, definePlugin, defineType} from "sanity";
import {accessibleImageType} from "./accessibleImageType"

interface MyPluginConfig {
  /* nothing here yet */
}

// export const mediaPicker = definePlugin<MyPluginConfig | void>((config = {}) => {
//   // eslint-disable-next-line no-console
//   console.log('hello from sanity-plugin-media-picker CHNAGES')
//   return {
//     name: 'sanity-plugin-media-picker',
//   }
// })


export const accessibleImage = definePlugin<MyPluginConfig | void>((config = {}) => {
  return {
    name: "sanity-plugin-accessible-image",
    schema: {
      types: [accessibleImageType],
    },
    // tools: config.tool === false ? undefined : [createStudioTool(config)],
  };
});
