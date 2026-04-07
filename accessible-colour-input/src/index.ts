import type {InputProps, ObjectInputProps} from 'sanity'
import {defineField, definePlugin, defineType} from 'sanity'

import {AccessibleColourInput} from './AccessibleColourInput'

declare module 'sanity' {
  export interface ObjectOptions {
    compareColour?: string
    'compare-colour'?: string
    defaultColour?: string
    swatchName?: string
    'swatch-name'?: string
    showSwatchName?: boolean
    'show-swatch-name'?: boolean
  }
}

const isAccessibleColourField = (props: InputProps): props is ObjectInputProps => {
  if (props.schemaType.jsonType !== 'object') {
    return false
  }

  return props.schemaType.name === 'accessibleColour'
}

export const accessibleColourInput = definePlugin(() => {
  return {
    name: 'sanity-plugin-accessible-colour-input',
    schema: {
      types: [
        defineType({
          name: 'accessibleColour',
          title: 'Accessible colour',
          type: 'object',
          fields: [
            defineField({
              name: 'hex',
              type: 'string',
            }),
            defineField({
              name: 'rgb',
              type: 'object',
              fields: [
                defineField({name: 'r', type: 'number'}),
                defineField({name: 'g', type: 'number'}),
                defineField({name: 'b', type: 'number'}),
              ],
            }),
            defineField({
              name: 'hsl',
              type: 'object',
              fields: [
                defineField({name: 'h', type: 'number'}),
                defineField({name: 's', type: 'number'}),
                defineField({name: 'l', type: 'number'}),
              ],
            }),
            defineField({
              name: 'hsv',
              type: 'object',
              fields: [
                defineField({name: 'h', type: 'number'}),
                defineField({name: 's', type: 'number'}),
                defineField({name: 'v', type: 'number'}),
              ],
            }),
            defineField({
              name: 'swatchName',
              type: 'string',
            }),
          ],
        }),
      ],
    },
    form: {
      components: {
        input: (props) => {
          if (isAccessibleColourField(props)) {
            return AccessibleColourInput(props)
          }

          return props.renderDefault(props)
        },
      },
    },
  }
})

export {AccessibleColourInput}
