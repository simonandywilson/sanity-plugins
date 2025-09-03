import { ToastContextValue } from '@sanity/ui'
import { Image, ImageDimensions, ImageMetadata, SanityClient } from 'sanity'
import React from 'react'
/** # Image with Metadata
 *
 * extends the Sanity Image Value with metadata. 
 * Use the same type in your front end, if you want to use the metadata.
 * Use the extendedQuery to get all the metadata from the image asset.
 *
 * @param {MetadataImage['_id']} _id is the alt text of the image and used as the _ref in image fields
 * @param {MetadataImage['title']} title is the alt text (set by media browser)
 * @param {MetadataImage['altText']} altText is the alt text (set by media browser)
 * @param {MetadataImage['description']} description is the description (set by media browser)
 * @param {MetadataImage['imageDimensions']} imageDimensions are the dimensions of the image
 * @param {Image['blurHashURL']} blurHashURL is the lqip string of the image metadata
 * @param {Image['asset']} asset is the asset of the image 
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
 * @param {string} name - The field name/key used in the data structure
 * @param {string} [title] - Display title for the field (defaults to name)
 * @param {string} [path] - Custom path in the data structure (defaults to name)
 * @param {string} [pluralPath] - Path for language variants (defaults to `${name}s`)
 * @param {boolean} [warn] - Whether the field should show validation warnings (defaults to false)
 * @param {boolean} [alwaysShow] - Whether to show the field even when not required (defaults to true)
 * @param {boolean} [documentLevel] - Whether to store at document level instead of image asset (defaults to false)
 * @param {string} [type] - Sanity schema type name for document-level fields (e.g., 'credit', 'array', 'string')
 * @param {any} [schemaType] - Complete schema type definition for complex inline fields (deprecated - use 'type' instead)
 * @param {React.ComponentType} [inputComponent] - Custom input component for complex fields
 * @param {string} [fieldset] - Fieldset name to group the field under in the schema
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
 * @param {MetadataImage} sanityImage is the image object with metadata
 * @param {ToastContextValue} toast is the toast context from the Sanity UI
 * @param {SanityClient} client is the Sanity client
 * @param {() => void} onClose is the function to close the dialog
 * @param {string} docId is the document id of the document that contains the image
 * @param {boolean} changed is a boolean that indicates if the image has changed
 * @param {string} imagePath is the path to the image
 *
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