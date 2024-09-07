import {defineField, definePlugin, defineType} from "sanity";
import ImageInput from "./ImageInput";
import {ImageIcon} from "@sanity/icons";

type AllowedFields = "altText" | "description" | "title";

interface MyPluginConfig {
  fields?: AllowedFields[];
  languages?: string[];
}

declare module "sanity" {
  export interface ImageOptions {
    requiredFields?: string[];
    languages?: string[];
  }
}

export const accessibleImage = definePlugin<MyPluginConfig>((config = {}) => {
  const {fields = ["altText"]} = config;  

  return {
    name: "sanity-plugin-accessible-image",
    schema: {
      types: [
        defineType({
          name: "accessibleImage",
          type: "image",
          options: {
            hotspot: true,
            metadata: ["blurhash", "lqip", "palette"],
            requiredFields: fields,
            languages: config.languages,
          },
          components: {
            input: ImageInput,
          },
          validation: (Rule) =>
            Rule.warning().custom(async (value, context) => {
              const client = context.getClient({apiVersion: "2021-03-25"});
              if (!value) return true;

              const imageMeta = await client.fetch(
                "*[_id == $id][0]{description, altText, title}",
                {
                  id: value?.asset?._ref,
                },
              );

              const requiredFields = context?.type?.options.requiredFields;

              const invalidFields = requiredFields.filter((field: string) => {
                return imageMeta[field] === null;
              });
              if (invalidFields.length > 0) {
                const message = `Please add an ${invalidFields.join(", ")} value to the image`;
                return {valid: false, message};
              }
              return true;
            }),
          fields: [
            defineField({
              type: "boolean",
              name: "changed",
              hidden: true,
            }),
          ],
          preview: {
            select: {
              media: "asset",
              subtitle: "asset.altText",
              subtitleAlt: `asset.altTexts.${config.languages[0]}`,
            },
            prepare(selection) {
              const {media, subtitle, subtitleAlt} = selection;              
              return {
                title: "Image",
                media: media || ImageIcon,
                subtitle: subtitleAlt || subtitle,
              };
            },
          },
        }),
      ],
    },
  };
});
