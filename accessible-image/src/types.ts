import { ToastContextValue } from '@sanity/ui'
import { Image, ImageDimensions, ImageMetadata, SanityClient } from 'sanity'
import React from 'react'
/** # Image with Metadata
 *
 * extends the Sanity Image Value with metadata.
 * Use the same type in your front end, if you want to use the metadata.
 * Use the extendedQuery to get all the metadata from the image asset.
 *
 * @param _id - the alt text of the image and used as the _ref in image fields
 * @param title - the alt text (set by media browser)
 * @param altText - the alt text (set by media browser)
 * @param description - the description (set by media browser)
 * @param imageDimensions - the dimensions of the image
 * @param blurHashURL - the lqip string of the image metadata
 * @param asset - the asset of the image
 * @see {@link Image} - Sanity Image
 *
 * ----
 *
 * ## Sanity Image Type:
 *
 * ```ts
 *  declare interface Image {
 *    [key: string]: unknown
 *    asset?: Reference
 *    crop?: ImageCrop
 *    hotspot?: ImageHotspot
 *  }
 * ```
 *
 */
export interface MetadataImage extends Image {
  title?: string
  altText?: string
  description?: string
  titles?: { [key: string]: string }
  altTexts?: { [key: string]: string }
  descriptions?: { [key: string]: string }
  _id: string
  imageDimensions?: ImageDimensions
  blurHashURL?: ImageMetadata['lqip']
}

/** # CustomField
 *
 * Configuration for custom fields that can be added to the image metadata form.
 *
 * @param name - The field name/key used in the data structure
 * @param title - Display title for the field (defaults to name)
 * @param path - Custom path in the data structure (defaults to name)
 * @param pluralPath - Path for language variants (defaults to `${name}s`)
 * @param warn - Whether the field should show validation warnings (defaults to false)
 * @param alwaysShow - Whether to show the field even when not required (defaults to true)
 * @param documentLevel - Whether to store at document level instead of image asset (defaults to false)
 * @param type - Sanity schema type name for document-level fields (e.g., 'credit', 'array', 'string')
 * @param schemaType - Complete schema type definition for complex inline fields (deprecated - use 'type' instead)
 * @param inputComponent - Custom input component for complex fields
 * @param fieldset - Fieldset name to group the field under in the schema
 */
export interface CustomField {
  name: string
  title?: string
  path?: string
  pluralPath?: string
  warn?: boolean
  alwaysShow?: boolean
  documentLevel?: boolean
  type?: string
  schemaType?: any // Deprecated in favor of 'type'
  inputComponent?: React.ComponentType<any>
  fieldset?: string
}

/** # GlobalMetadataHandlerProps
 *
 * This is the type of the props passed to the global metadata handler.
 *
 * @param sanityImage - the image object with metadata
 * @param toast - the toast context from the Sanity UI
 * @param client - the Sanity client
 * @param onClose - the function to close the dialog
 * @param docId - the document id of the document that contains the image
 * @param changed - indicates if the image has changed
 * @param imagePath - the path to the image
 */
export interface GlobalMetadataHandlerProps {
  sanityImage: MetadataImage
  toast: ToastContextValue
  client: SanityClient
  onClose: () => void
  docId: string
  changed: boolean
  imagePath: string
}