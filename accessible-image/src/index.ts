import {defineField, definePlugin, defineType} from "sanity";
import ImageInput from "./ImageInput";
import {ImageIcon, SparklesIcon} from "@sanity/icons";
import {CustomField} from "./types";
import {AltTextGeneratorTool} from "./altTextGenerator/AltTextGeneratorTool";

type AllowedFields = "altText" | "description" | "title";

interface MyPluginConfig {
  fields?: AllowedFields[];
  languages?: string[];
  customFields?: CustomField[];
  /** Enable the AI Alt Text Generator studio tool. Defaults to false. */
  aiAltTextGenerator?: boolean;
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
  const {fields = ["altText"], languages = [], customFields = [], aiAltTextGenerator = true} = config;

  return {
    name: "sanity-plugin-accessible-image",
    tools: aiAltTextGenerator
      ? [
          {
            name: "ai-alt-text",
            title: "AI Alt Text",
            icon: SparklesIcon,
            component: AltTextGeneratorTool,
          },
        ]
      : [],
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
            accept: "image/*",
          },
          fieldsets:[
            {
              name: "custom",
              title: "Custom Fields",
              options: {
                collapsible: true,
                collapsed: true,
              },
            },
          ],
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
            // Only hide fields that don't have a fieldset - fields with fieldsets should show in default form
            ...customFields
              .filter(field => field.documentLevel)
              .map(field => defineField({
                name: field.path || field.name,
                title: field.title || field.name,
                type: field.type || field.schemaType?.type || 'string',
                fieldset: field.fieldset, // Assign to specified fieldset
                hidden: !field.fieldset, // Only hide if no fieldset specified
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
