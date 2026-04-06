import { definePlugin } from "sanity";
import { LimitArray } from "./LimitArray";

export const limitArray = definePlugin(() => {
  return {
    name: "sanity-plugin-limit-array",
    form: {
      components: {
        input: (props) => {
          if (props.schemaType.name === "array") {
            return LimitArray(props);
          }
          return props.renderDefault(props);
        },
      },
    },
  };
});
