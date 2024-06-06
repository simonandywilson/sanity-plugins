// schemas/image/imageType.ts

import {defineField, defineType} from "sanity";

import ImageInput from "./ImageInput";
import {Image} from "lucide-react";

declare module "sanity" {
  export interface ImageOptions {
    requiredFields?: string[];
  }
}

export const accessibleImageType = defineType({
  name: "accessibleImage",
  type: "image",
  options: {
    hotspot: true,
    metadata: ["blurhash", "lqip", "palette"],
    requiredFields: ["altText"],
  },
  components: {
    input: ImageInput,
  },
  validation: (Rule) =>
    Rule.warning().custom(async (value, context) => {
      const client = context.getClient({apiVersion: "2021-03-25"});

      /** Stop validation when no value is set
       * If you want to set the image as `required`,
       * you should change `true` to "Image is required"
       * or another error message
       */
      if (!value) return true;

      /** Get global metadata for set image asset */
      const imageMeta = await client.fetch("*[_id == $id][0]{description, altText, title}", {
        id: value?.asset?._ref,
      });

      /** Check if all required fields are set */
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
    // we use this to cause revalidation of document when the image is changed
    // A listener would also be an option, but more complex
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
    },
    prepare(selection) {
      const {media, subtitle} = selection;
      return {
        title: "Image",
        media: media || <Image strokeWidth={1.5} size={25} />,
        subtitle,
      };
    },
  },
});
