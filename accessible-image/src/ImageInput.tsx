import {Button, Card, Dialog, Flex, Label, Spinner, Stack, TextInput, useToast} from "@sanity/ui";
import {ComponentType, useCallback, useEffect, useState} from "react";
import {Subscription} from "rxjs";
import {
  ImageValue,
  ObjectInputProps,
  ObjectSchemaType,
  pathToString,
  useClient,
  useFormValue,
} from "sanity";

import {MetadataImage} from "./types";
import {handleGlobalMetadataConfirm} from "./utils/handleGlobalMetadataConfirm";
import {sleep} from "./utils/sleep";

const ImageInput: ComponentType<ObjectInputProps<ImageValue, ObjectSchemaType>> = (
  props: ObjectInputProps<ImageValue>,
) => {
  const requiredFields = props.schemaType?.options?.requiredFields ?? [];

  const fields = [
    // {
    //   name: "title",
    //   title: "Title",
    //   required: requiredFields.some((field) => field === "title"),
    // },
    {
      name: "altText",
      title: "Alt Text",
      required: requiredFields.some((field) => field === "altText"),
    },
    // {
    //   name: "description",
    //   title: "Description",
    //   required: requiredFields.some((field) => field === "description"),
    // },
  ];

  const toast = useToast();
  const docId = useFormValue(["_id"]) as string;
  const changed = (useFormValue([pathToString(props.path), "changed"]) as boolean) ?? false;
  const imageId = props.value?.asset?._ref;
  const client = useClient({apiVersion: "2023-03-25"});

  const [sanityImage, setSanityImage] = useState<MetadataImage>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fieldsToValidate = fields.reduce((acc, field) => {
    if (field.required) {
      return {...acc, [field.name]: false};
    }
    return acc;
  }, {});

  /** Error state used for disabling buttons in case of missing data */
  const [validationStatus, setValidationStatus] = useState(fieldsToValidate);


  const handleChange = useCallback(
    (event: string, field: string) => {
      /* unset value */
      event === ""
        ? setSanityImage((prevSanityImage) => ({
            ...prevSanityImage,
            [field]: "",
          }))
        : setSanityImage((prevSanityImage) => ({
            ...prevSanityImage,
            [field]: event,
          }));

      const isFieldToValidate = fieldsToValidate[field] !== undefined;
      isFieldToValidate &&
        setValidationStatus((prevValidationStatus) => ({
          ...prevValidationStatus,
          [field]: event.trim() !== "" ? true : false,
        }));
    },
    [fieldsToValidate],
  );

  useEffect(() => {
    let subscription: Subscription;

    const query = `*[_type == "sanity.imageAsset" && _id == $imageId ][0]{
      _id,
      altText,
      title, 
      description,
    }`;
    const params = {imageId: imageId};

    const fetchReference = async (listening = false) => {
      /** Debouncing the listener
       */
      listening && (await sleep(1500));

      /** Fetching the data */
      await client
        .fetch(query, params)
        .then((res) => {
          setSanityImage(res);
          // check if all required fields are filled by checking if validationStatus fields have values in res
          const resValidationStatus = Object.entries(res).reduce((acc, [key, value]) => {
            if (value && fieldsToValidate[key] !== undefined) {
              return {...acc, [key]: true};
            }
            if (!value && fieldsToValidate[key] !== undefined) {
              return {...acc, [key]: false};
            }
            return acc;
          }, {});
          setValidationStatus(resValidationStatus);
        })
        .catch((err) => {
          console.error(err.message);
        });
    };

    const listen = () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      subscription = client
        .listen(query, params, {visibility: "query"})
        .subscribe(() => fetchReference(true));
    };

    /** we only want to run the fetchReference function if we have a imageId (from the context) */
    imageId ? fetchReference().then(listen) : setSanityImage(null as any);

    /** and then we need to cleanup after ourselves, so we don't get any memory leaks */
    return function cleanup() {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, client]);

  return (
    <>
      {props.renderDefault(props)}
      <Stack space={3} paddingTop={3}>
        {fields.map((field) => {
          return (
            <Card key={field.name}>
              <label>
                <Stack space={2}>
                  <Label size={1}>{field.title}</Label>
                  <TextInput
                    fontSize={2}
                    onChange={(event) => handleChange(event.currentTarget.value, field.name)}
                    placeholder={field.title}
                    value={sanityImage ? (sanityImage[field.name] as string) : ""}
                    required={field.required}
                    iconRight={
                      isEditing ? (
                        <div style={{paddingTop: "6px"}}>
                          <Spinner muted />
                        </div>
                      ) : null
                    }
                    onFocus={() => setIsEditing(true)}
                    onBlur={() => {
                      setIsEditing(false);
                      handleGlobalMetadataConfirm({
                        sanityImage,
                        toast,
                        client,
                        docId,
                        changed,
                        imagePath: pathToString(props.path),
                      });
                    }}
                  />
                </Stack>
              </label>
            </Card>
          );
        })}
      </Stack>
    </>
  );
};

export default ImageInput;
