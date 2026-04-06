# sanity-plugin-limit-array

> This is a **Sanity Studio v3** plugin.

Hides the default **+ Add item** button when an array field reaches its maximum item limit, as defined by a `max` validation rule. Optionally, replaces it with per-type buttons for a cleaner authoring experience.

## Installation

```sh
npm install sanity-plugin-limit-array
```

## Usage

Add it as a plugin in `sanity.config.ts` (or `.js`):

```ts
import {defineConfig} from 'sanity'
import {limitArray} from 'sanity-plugin-limit-array'

export default defineConfig({
  // ...
  plugins: [limitArray()],
})
```

The plugin automatically detects any array field that has a `max` validation rule and hides the add button once the limit is reached.

```ts
defineType({
  name: 'myDocument',
  type: 'document',
  fields: [
    defineField({
      name: 'items',
      type: 'array',
      of: [{type: 'string'}],
      validation: (Rule) => Rule.max(5),
    }),
  ],
})
```

### `showAsButtons` option

For arrays with multiple item types, you can opt in to rendering per-type add buttons instead of the default dropdown. Set `showAsButtons: true` in the field's `options`:

```ts
defineField({
  name: 'content',
  type: 'array',
  of: [{type: 'imageBlock'}, {type: 'textBlock'}],
  validation: (Rule) => Rule.max(10),
  options: {
    showAsButtons: true,
  },
})
```

## License

[MIT](LICENSE) © simonandywilson

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.
