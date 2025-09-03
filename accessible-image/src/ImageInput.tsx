import {Badge, Box, Button, Card, Flex, Inline, Stack, Text, TextInput, useToast} from "@sanity/ui";
import {ComponentType, useCallback, useEffect, useMemo, useRef, useState} from "react";
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

/**
 * ImageInput component for accessible images with altText, title, and description fields.
 */
const ImageInput: ComponentType<ObjectInputProps<ImageValue, ObjectSchemaType>> = (
  props: ObjectInputProps<ImageValue>,
) => {
  // Remove debug logging that was causing issues
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

  const languageFields = useMemo(() => {
    return languages
      ? languages.map((language: string) => [
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
        ])
      : [];
  }, [languages, requiredFields]);

  const toast = useToast();
  const docId = useFormValue(["_id"]) as string;
  const changed = (useFormValue([pathToString(props.path), "changed"]) as boolean) ?? false;
  const imageId = props.value?.asset?._ref;
  const client = useClient({apiVersion: "2023-03-25"});

  const [sanityImage, setSanityImage] = useState<MetadataImage>(null);
  const [localValues, setLocalValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const pendingChangesRef = useRef({});

  const fieldsToValidate = fields.reduce((acc, field) => {
    if (field.required) {
      return {...acc, [field.name]: false};
    }
    return acc;
  }, {});

  /** Error state used for disabling buttons in case of missing data */
  const [validationStatus, setValidationStatus] = useState(fieldsToValidate);

  const handleSave = useCallback(() => {
    if (!hasPendingChanges || isSaving) return;

    setIsSaving(true);
    const newSanityImage = {...sanityImage, ...pendingChangesRef.current};

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
        setLocalValues({});
        pendingChangesRef.current = {};
        setHasPendingChanges(false);
        setIsSaving(false);
      },
    );
  }, [hasPendingChanges, isSaving, sanityImage, toast, client, docId, changed, props.path]);

  const handleChange = useCallback(
    (event: string, field: string, path: string) => {
      const newValue = event === "" ? "" : event;

      // Update local state immediately
      setLocalValues((prev) => ({
        ...prev,
        [path]: newValue,
      }));

      // Update pending changes
      const updatedPendingChanges = {...pendingChangesRef.current};
      if (path.includes(".")) {
        const [mainField, subField] = path.split(".");
        updatedPendingChanges[mainField] = {
          ...((updatedPendingChanges[mainField] as Record<string, unknown>) || {}),
          [subField]: newValue,
        };
      } else {
        updatedPendingChanges[path] = newValue;
      }
      pendingChangesRef.current = updatedPendingChanges;
      setHasPendingChanges(true);

      // Update validation status
      const isFieldToValidate = fieldsToValidate[field] !== undefined;
      if (isFieldToValidate) {
        setValidationStatus((prevValidationStatus) => ({
          ...prevValidationStatus,
          [field]: newValue.trim() !== "",
        }));
      }
    },
    [fieldsToValidate],
  );

  // Auto-save on component unmount
  useEffect(() => {
    return () => {
      if (hasPendingChanges && sanityImage && Object.keys(pendingChangesRef.current).length > 0) {
        const newSanityImage = {...sanityImage, ...pendingChangesRef.current};
        handleGlobalMetadataConfirm(
          {
            sanityImage: newSanityImage,
            toast,
            client,
            docId,
            changed,
            imagePath: pathToString(props.path),
          },
          () => {},
        );
      }
    };
  }, [hasPendingChanges, sanityImage, toast, client, docId, changed, props.path]);

  useEffect(() => {
    let subscription: Subscription;

    const queryFields = [
      "_id",
      "altText",
      "title",
      "description",
      "altTexts",
      "titles",
      "descriptions",
    ].join(", ");

    const query = `*[_type == "sanity.imageAsset" && _id == $imageId ][0]{
      ${queryFields}
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
  }, [imageId, client, languages]);

  return (
    <Stack space={3}>
      {props.renderDefault(props)}
      {props.value && (
        <Stack space={3}>
          {requiredFields.length > 1 && (
            <SaveButton
              title="Image Metadata"
              isSaving={isSaving}
              hasPendingChanges={hasPendingChanges}
              handleSave={handleSave}
            />
          )}

          {languages && languages.length > 0 ? (
            <Fields
              fields={languageFields.flat()}
              handleChange={handleChange}
              sanityImage={sanityImage}
              localValues={localValues}
              isSaving={isSaving}
              hasPendingChanges={hasPendingChanges}
              handleSave={handleSave}
              showSaveButton={requiredFields.length === 1}
              requiredFields={requiredFields}
            />
          ) : (
            <Fields
              fields={fields}
              handleChange={handleChange}
              sanityImage={sanityImage}
              localValues={localValues}
              isSaving={isSaving}
              hasPendingChanges={hasPendingChanges}
              handleSave={handleSave}
              showSaveButton={requiredFields.length === 1}
              requiredFields={requiredFields}
            />
          )}


        </Stack>
      )}
    </Stack>
  );
};

const Fields = ({
  fields,
  handleChange,
  sanityImage,
  localValues,
  isSaving,
  hasPendingChanges,
  handleSave,
  showSaveButton,
  requiredFields,
}) => {
  let isFirstVisibleField = true;
  
  const fieldElements = fields.map((field) => {
    // Show field if it's required
    const shouldShow = field.required;

    if (!shouldShow) {
      return null;
    }

    const value =
      localValues[field.path] ??
      (sanityImage
        ? (() => {
            if (field?.path?.includes(".")) {
              const [mainField, subField] = field.path.split(".");
              return sanityImage[mainField]?.[subField] ?? "";
            } else {
              return sanityImage[field?.path] ?? "";
            }
          })()
        : "");

    // Only show save button on the first visible field
    const showSaveOnThisField = showSaveButton && isFirstVisibleField;
    isFirstVisibleField = false; // Mark that we've seen the first field

    return (
      <Card key={field.name}>
        <label>
          <Stack space={3} >
            {!showSaveOnThisField ? (
              <Text size={1} weight={"medium"}>
                {field.title}
              </Text>
            ) : (
              <SaveButton
                title={field.title}
                isSaving={isSaving}
                hasPendingChanges={hasPendingChanges}
                handleSave={handleSave}
              />
            )}
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
                  customValidity={
                    field.warn && field.required && (!value || value.trim() === "")
                      ? `${field.title} is required`
                      : undefined
                  }
                />
              </Box>
            </Flex>
          </Stack>
        </label>
      </Card>
    );
  }).filter(Boolean);

  return fieldElements;
};



const SaveButton = ({title, isSaving, hasPendingChanges, handleSave}) => {
  return (
    <Flex justify={"space-between"} align={"center"} style={{height: "25px"}}>
      <Inline space={2}>
        <Text size={1} weight={"medium"}>
          {title}
        </Text>
        {isSaving ? (
          <Badge tone="caution">Saving…</Badge>
        ) : hasPendingChanges ? (
          <Badge tone="critical">Unsaved</Badge>
        ) : (
          <Badge tone="positive">Saved</Badge>
        )}
      </Inline>
      {hasPendingChanges && (
        <Button
          tone="primary"
          text="Save"
          onClick={handleSave}
          disabled={isSaving}
          fontSize={1}
          padding={2}
        />
      )}
    </Flex>
  );
};

export default ImageInput;
