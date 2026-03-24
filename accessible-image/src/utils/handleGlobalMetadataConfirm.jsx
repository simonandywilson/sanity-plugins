export const handleGlobalMetadataConfirm = (
  props,
  callback
) => {
  const { sanityImage, toast } = props

  /** Make sure there is a image _id passed down */
  if (sanityImage?._id) {
    patchImageData(props, callback)
  } else {
    toast.push({
      status: 'error',
      title: `No image found!`,
      description: `Image metadata was not added to the asset because there is no _id... `,
    })
    if (callback) callback()
  }
}

/** ### Data patching via patchImageData
 *
 * We also add a toast notification to let the user know what succeeded.
 */
const patchImageData = ({
  docId,
  sanityImage,
  toast,
  client,
  changed,
  imagePath,
}, callback) => {
  // create an object with the values that should be set
  const valuesToSet = Object.entries(sanityImage).reduce(
    (acc, [key, value]) => {
      if (value === '') {
        return acc
      }
      return {
        ...acc,
        [key]: value,
      }
    },
    {},
  )
  // create an array of key strings (field names) of fields to be unset
  const valuesToUnset = Object.entries(sanityImage).reduce(
    (acc, [key, value]) => {
      if (value === '') {
        return [...acc, key]
      }
      return acc
    },
    [],
  )

  client
    .patch(sanityImage._id)
    .set(valuesToSet)
    .unset(valuesToUnset)
    .commit(/* {dryRun: true} */) //If you want to test this script first, you can use the dryRun option to see what would happen without actually committing the changes to the content lake.
    .then((res) =>
      toast.push({
        status: 'success',
        title: `Success!`,
        description: `Image metadata was successfully synced.`,
      })
    )
    .then(() => {
      client
        .patch(docId)
        .set({ [`${imagePath}.changed`]: !changed })
        .commit()
    })
    .then(() => {
      if (callback) callback();
    })
    .catch((err) => console.error(err))
}
