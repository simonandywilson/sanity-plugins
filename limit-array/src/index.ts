import {definePlugin} from 'sanity'
import { LimitArray } from "./LimitArray";
 
interface MyPluginConfig {
  /* nothing here yet */
}

export const limitArray = definePlugin<MyPluginConfig | void>((config = {}) => {
  // eslint-disable-next-line no-console
  return {
    name: 'sanity-plugin-limit-array',
    form: {
      components: {
        input: (props) => {
          if (props.schemaType.name === "array") {
            return LimitArray(props)
          }
          return props.renderDefault(props);
        },
      },
    },
  }
})
