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

  const languageFields = languages ? languages.map((language: string) => {
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
  }) : [];

  const toast = useToast();
  const docId = useFormValue(["_id"]) as string;
  const changed = (useFormValue([pathToString(props.path), "changed"]) as boolean) ?? false;
  const imageId = props.value?.asset?._ref;
  const client = useClient({apiVersion: "2023-03-25"});

  const [sanityImage, setSanityImage] = useState<MetadataImage>(null);
  const [localValues, setLocalValues] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef(null);

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
      const newValue = event === "" ? "" : event;

      // Update local state immediately
      setLocalValues((prev) => ({
        ...prev,
        [path]: newValue,
      }));

      // Update validation status
      const isFieldToValidate = fieldsToValidate[field] !== undefined;
      if (isFieldToValidate) {
        setValidationStatus((prevValidationStatus) => ({
          ...prevValidationStatus,
          [field]: newValue.trim() !== "",
        }));
      }

      // Clear previous timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      // Set up new timeout for syncing
      syncTimeoutRef.current = setTimeout(() => {
        setIsSyncing(true);
        const newSanityImage = {...sanityImage};
        if (path.includes(".")) {
          const [mainField, subField] = path.split(".");
          newSanityImage[mainField] = {
            ...((newSanityImage[mainField] as Record<string, unknown>) || {}),
            [subField]: newValue,
          };
        } else {
          newSanityImage[path] = newValue;
        }

        handleGlobalMetadataConfirm(
          {
            sanityImage: newSanityImage,
            toast,
            client,
            docId,
            changed,
            imagePath: pathToString(props.path),
          },
          () => {
            setSanityImage(newSanityImage);
            setIsSyncing(false);
          },
        );
      }, 1000);
    },
    [fieldsToValidate, sanityImage, toast, client, docId, changed, props.path],
  );

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
        <Stack space={5} marginTop={5}>
          <Inline space={2}>
            <Text size={1} weight={"medium"}>
              Image Metadata
            </Text>
            {isSyncing ? (
              <Badge tone="caution">Syncing…</Badge>
            ) : (
              <Badge tone="positive">Synced</Badge>
            )}
          </Inline>
          {languages && languages.length > 0 ? (
            <Fields
              fields={languageFields.flat()}
              handleChange={handleChange}
              sanityImage={sanityImage}
              localValues={localValues}
            />
          ) : (
            <Fields
              fields={fields}
              handleChange={handleChange}
              sanityImage={sanityImage}
              localValues={localValues}
            />
          )}
        </Stack>
      )}
    </>
  );
};

const Fields = ({fields, handleChange, sanityImage, localValues}) => {
  return fields.map((field) => {
    if (!field.required) {
      return null;
    }

    const value = localValues[field.path] ?? (sanityImage
      ? (() => {
          if (field?.path?.includes(".")) {
            const [mainField, subField] = field.path.split(".");
            return sanityImage[mainField]?.[subField] ?? "";
          } else {
            return sanityImage[field?.path] ?? "";
          }
        })()
      : "");

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