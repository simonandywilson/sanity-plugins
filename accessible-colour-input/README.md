# sanity-plugin-accessible-colour-input


## Installation

```sh
npm install sanity-plugin-accessible-colour-input
```

## Usage

Add it as a plugin in `sanity.config.ts` (or .js):

```ts
import {defineConfig} from 'sanity'
import {accessibleColourInput} from 'sanity-plugin-accessible-colour-input'

export default defineConfig({
  //...
  plugins: [accessibleColourInput()],
})
```

In your schema, use the `accessibleColour` type and set an optional compare colour:

```ts
import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'themeSettings',
  type: 'document',
  fields: [
    defineField({
      name: 'brandColour',
      title: 'Brand colour',
      type: 'accessibleColour',
      options: {
        compareColour: '#ffffff',
        // Optional fallback default:
        defaultColour: '#1a73e8',
      },
    }),
    defineField({
      name: 'accentColour',
      title: 'Accent colour',
      type: 'accessibleColour',
      // No compareColour: behaves like a standard colour input
    }),
  ],
})
```

Stored value shape:

```ts
{
  hex: '#1a73e8',
  rgb: {r: 26, g: 115, b: 232},
  hsl: {h: 215, s: 82, l: 51},
  hsv: {h: 215, s: 89, v: 91}
}
```

## License

[MIT](LICENSE) © simonandywilson

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.
