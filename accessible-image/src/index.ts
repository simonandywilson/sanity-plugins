import {defineField, definePlugin, defineType} from "sanity";
import ImageInput from "./ImageInput";
import {ImageIcon} from "@sanity/icons";
import {CustomField} from "./types";

type AllowedFields = "altText" | "description" | "title";

interface MyPluginConfig {
  fields?: AllowedFields[];
  languages?: string[];
  customFields?: CustomField[];
}

declare module "sanity" {
  export interface ImageOptions {
    requiredFields?: string[];
    languages?: string[];
    customFields?: CustomField[];
  }
}

export type {CustomField} from "./types";

export const accessibleImage = definePlugin<MyPluginConfig>((config = {}) => {
  const {fields = ["altText"], languages = [], customFields = []} = config;  

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
            languages: languages,
            customFields: customFields,
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
              const customFields = context?.type?.options.customFields || [];

              const invalidFields = requiredFields.filter((field: string) => {
                // Check if it's a simple custom field (stored on asset) or built-in field
                const customField = customFields.find(cf => cf.name === field);
                if (customField && customField.documentLevel) {
                  // For document-level fields, check the document value
                  return !value?.[customField.path || customField.name];
                } else {
                  // For asset-level fields, check the image metadata
                  return imageMeta[field] === null;
                }
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
            // Add custom document-level fields as references to existing schema types
            // Hide them from default rendering since we handle them in our custom input
            ...customFields
              .filter(field => field.documentLevel)
              .map(field => defineField({
                name: field.path || field.name,
                title: field.title || field.name,
                type: field.type || field.schemaType?.type || 'string',
                hidden: true, // Hide from default rendering to prevent duplication
                ...(field.schemaType && !field.type ? field.schemaType : {}),
              })),
          ],
          preview: {
            select: {
              media: "asset",
              subtitle: "asset.altText",
              subtitleAlt: `asset.altTexts.${config.languages}`,
            },
            prepare(selection) {
              const {media, subtitle, subtitleAlt} = selection;              
              return {
                title: "Image",
                media: media || ImageIcon,
                subtitle: subtitleAlt?.length > 0 ? subtitleAlt[0] : subtitle,
              };
            },
          },
        }),
      ],
    },
  };
});
