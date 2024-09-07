import {Badge, Box, Card, Flex, Inline, Stack, Text, TextInput, useToast} from "@sanity/ui";
import {ComponentType, useCallback, useEffect, useRef, useState} from "react";
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
  const languages = props.schemaType?.options?.languages;

  const fields = [
    {
      name: "title",
      path: "title",
      title: "Title",
      required: requiredFields.some((field) => field === "title"),
      warn: false,
    },
    {
      name: "description",
      path: "description",
      title: "Caption",
      required: requiredFields.some((field) => field === "description"),
      warn: false,
    },
    {
      name: "altText",
      path: "altText",
      title: "Alt Text",
      required: requiredFields.some((field) => field === "altText"),
      warn: true,
    },
  ];

  const languageFields = languages.map((language: string) => {
    return [
      {
        name: `title.${language}`,
        title: `Title (${language.toUpperCase()})`,
        path: `titles.${language}`,
        required: requiredFields.some((field) => field === "title"),
        warn: false,
      },
      {
        name: `description.${language}`,
        title: `Caption (${language.toUpperCase()})`,
        path: `descriptions.${language}`,
        required: requiredFields.some((field) => field === "description"),
        warn: false,
      },
      {
        name: `altText.${language}`,
        title: `Alt Text (${language.toUpperCase()})`,
        path: `altTexts.${language}`,
        required: requiredFields.some((field) => field === "altText"),
        warn: true,
      },
    ];
  });

  const toast = useToast();
  const docId = useFormValue(["_id"]) as string;
  const changed = (useFormValue([pathToString(props.path), "changed"]) as boolean) ?? false;
  const imageId = props.value?.asset?._ref;
  const client = useClient({apiVersion: "2023-03-25"});

  const [sanityImage, setSanityImage] = useState<MetadataImage>(null);

  const [synced, setSynced] = useState(true);

  const fieldsToValidate = fields.reduce((acc, field) => {
    if (field.required) {
      return {...acc, [field.name]: false};
    }
    return acc;
  }, {});

  /** Error state used for disabling buttons in case of missing data */
  const [validationStatus, setValidationStatus] = useState(fieldsToValidate);

  const handleChange = useCallback(
    (event: string, field: string, path: string) => {
      // Set synced to false as the user is typing
      setSynced(false);

      // Update the sanityImage state with the new value
      const newSanityImage = {...sanityImage};
      if (path.includes(".")) {
        const [mainField, subField] = path.split(".");
        newSanityImage[mainField] = {
          ...((newSanityImage[mainField] as Record<string, unknown>) || {}),
          [subField]: event === "" ? "" : event,
        };
      } else {
        newSanityImage[path] = event === "" ? "" : event;
      }

      setSanityImage(newSanityImage);

      const isFieldToValidate = fieldsToValidate[field] !== undefined;
      if (isFieldToValidate) {
        setValidationStatus((prevValidationStatus) => ({
          ...prevValidationStatus,
          [field]: event.trim() !== "" ? true : false,
        }));
      }

      // Debounce the function call to ensure it triggers only after typing stops
      if (debouncedHandleGlobalMetadataConfirm.current) {
        clearTimeout(debouncedHandleGlobalMetadataConfirm.current);
      }

      debouncedHandleGlobalMetadataConfirm.current = setTimeout(() => {
        // Set synced to false just before running handleGlobalMetadataConfirm
        setSynced(false);

        handleGlobalMetadataConfirm(
          {
            sanityImage: newSanityImage, // Use the latest state
            toast,
            client,
            docId,
            changed,
            imagePath: pathToString(props.path),
          },
          () => {
            // Set synced to true after the handleGlobalMetadataConfirm has run and toast has fired
            setSynced(true);
          },
        );
      }, 1500);
    },
    [fieldsToValidate, sanityImage, toast, client, docId, changed, props.path],
  );

  const debouncedHandleGlobalMetadataConfirm = useRef(null);

  useEffect(() => {
    let subscription: Subscription;

    const query = `*[_type == "sanity.imageAsset" && _id == $imageId ][0]{
      _id,
      altText,
      title, 
      description,
      altTexts,
      titles,
      descriptions,
    }`;
    const params = {imageId: imageId};

    const fetchReference = async (listening = false) => {
      listening && (await sleep(1500));

      await client
        .fetch(query, params)
        .then((res) => {
          setSanityImage(res);

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
      subscription = client
        .listen(query, params, {visibility: "query"})
        .subscribe(() => fetchReference(true));
    };

    imageId ? fetchReference().then(listen) : setSanityImage(null as any);

    return function cleanup() {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [imageId, client]);

  return (
    <>
      {props.renderDefault(props)}
      {props.value && (
        <Stack space={5}>
          <Inline space={2}>
            <Text size={1} weight={"medium"}>
              Image Metadata
            </Text>
            {synced ? (
              <Badge tone="positive">Synced</Badge>
            ) : (
              <Badge tone="critical">Syncing…</Badge>
            )}
          </Inline>
          {languages ? (
            <Fields
              fields={languageFields.flat()}
              handleChange={handleChange}
              sanityImage={sanityImage}
            />
          ) : (
            <Fields fields={fields} handleChange={handleChange} sanityImage={sanityImage} />
          )}
        </Stack>
      )}
    </>
  );
};

const Fields = ({fields, handleChange, sanityImage}) => {
  return fields.map((field) => {
    if (!field.required) {
      return null;
    }

    const value = sanityImage
      ? (() => {
          if (field?.path?.includes(".")) {
            const [mainField, subField] = field.path.split(".");
            return sanityImage[mainField]?.[subField] ?? "";
          } else {
            return sanityImage[field?.path] ?? "";
          }
        })()
      : "";

    return (
      <Card key={field.name}>
        <label>
          <Stack space={4}>
            <Text size={1} weight={"medium"}>
              {field.title}
            </Text>
            <Flex gap={1} width={5}>
              <Box flex={1}>
                <TextInput
                  style={{width: "100%"}}
                  fontSize={2}
                  onChange={(event) =>
                    handleChange(event.currentTarget.value, field.name, field.path)
                  }
                  placeholder={field.title}
                  value={value ? value : ""}
                  required={field.warn}
                />
              </Box>
            </Flex>
          </Stack>
        </label>
      </Card>
    );
  });
};

export default ImageInput;
