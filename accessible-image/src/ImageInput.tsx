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

import {MetadataImage, CustomField} from "./types";
import {handleGlobalMetadataConfirm} from "./utils/handleGlobalMetadataConfirm";
import {sleep} from "./utils/sleep";

/**
 * ImageInput component that supports both simple and complex custom fields.
 *
 * Simple fields (documentLevel: false) are stored on the image asset and sync globally.
 * Complex fields (documentLevel: true) are stored on the document level.
 *
 * Example usage with complex fields:
 *
 * ```typescript
 * // First, define your schema type in your schema:
 * export default defineType({
 *   name: "credit",
 *   title: "Credit",
 *   type: "array",
 *   of: [
 *     defineArrayMember({
 *       type: "block",
 *       // ... your complex field definition
 *     })
 *   ]
 * })
 *
 * // Then reference it in your custom fields:
 * const customFields: CustomField[] = [
 *   {
 *     name: 'credit',
 *     title: 'Credit',
 *     documentLevel: true,
 *     alwaysShow: true,
 *     type: 'credit' // References the schema type defined above
 *   }
 * ]
 *
 * // Use in plugin:
 * accessibleImage({
 *   fields: ['altText', 'title'],
 *   customFields: customFields
 * })
 * ```
 */
const ImageInput: ComponentType<ObjectInputProps<ImageValue, ObjectSchemaType>> = (
  props: ObjectInputProps<ImageValue>,
) => {
  // Remove debug logging that was causing issues
  const requiredFields = props.schemaType?.options?.requiredFields ?? [];
  const languages = props.schemaType?.options?.languages;
  const customFields: CustomField[] = props.schemaType?.options?.customFields ?? [];

  // Memoize custom fields processing to prevent infinite re-renders
  const {simpleCustomFields, complexCustomFields} = useMemo(() => {
    const simple = customFields.filter((field) => !field.documentLevel);
    const complex = customFields.filter((field) => field.documentLevel);
    return {simpleCustomFields: simple, complexCustomFields: complex};
  }, [customFields]);

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
    // Only add simple custom fields that sync to image asset (not document-level ones)
    ...simpleCustomFields.map((customField) => ({
      name: customField.name,
      path: customField.path || customField.name,
      title: customField.title || customField.name,
      required: requiredFields.some((field) => field === customField.name),
      warn: customField.warn ?? false,
      alwaysShow: customField.alwaysShow ?? true,
    })),
  ];

  const languageFields = useMemo(() => {
    return languages
      ? languages.map((language: string) => {
          const baseLanguageFields = [
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

          // Add simple custom fields for this language
          const customLanguageFields = simpleCustomFields.map((customField) => ({
            name: `${customField.name}.${language}`,
            title: `${customField.title || customField.name} (${language.toUpperCase()})`,
            path: `${customField.pluralPath || `${customField.name}s`}.${language}`,
            required: requiredFields.some((field) => field === customField.name),
            warn: customField.warn ?? false,
            alwaysShow: customField.alwaysShow ?? true,
          }));

          return [...baseLanguageFields, ...customLanguageFields];
        })
      : [];
  }, [languages, simpleCustomFields, requiredFields]);

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

    // Build dynamic query fields including only simple custom fields (complex ones are document-level)
    const customFieldsQuery = simpleCustomFields
      .map((field) => field.path || field.name)
      .join(", ");
    const customFieldsPluralQuery = simpleCustomFields
      .map((field) => field.pluralPath || `${field.name}s`)
      .join(", ");

    const queryFields = [
      "_id",
      "altText",
      "title",
      "description",
      "altTexts",
      "titles",
      "descriptions",
      ...(simpleCustomFields.length > 0 ? [customFieldsQuery] : []),
      ...(languages && simpleCustomFields.length > 0 ? [customFieldsPluralQuery] : []),
    ]
      .filter(Boolean)
      .join(", ");

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
  }, [imageId, client, simpleCustomFields, languages]);

  return (
    <>
      {props.renderDefault(props)}
      {props.value && (
        <Stack space={5}>
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
            />
          )}

          {/* Render complex custom fields at document level - these appear below standard fields */}
          {complexCustomFields.length > 0 && (
            <Stack space={4} marginTop={0}>
              <ComplexFields
                customFields={complexCustomFields}
                props={props}
                requiredFields={requiredFields}
              />
            </Stack>
          )}
        </Stack>
      )}
    </>
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
}) => {
  let isFirstVisibleField = true;
  
  return fields.map((field) => {
    // Show field if it's required OR if it's a custom field with alwaysShow=true
    const shouldShow = field.required || field.alwaysShow;

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
          <Stack space={showSaveOnThisField ? 3 : 4}>
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

const ComplexFields = ({customFields, props, requiredFields}) => {
  return customFields.map((field) => {
    const shouldShow = field.required || field.alwaysShow;

    if (!shouldShow) {
      return null;
    }

    const fieldName = field.path || field.name;
    const fieldPath = [...props.path, fieldName];
    const fieldValue = props.value?.[fieldName];

    // Find the registered schema field
    const schemaField = props.schemaType.fields?.find((f) => f.name === fieldName);

    if (!schemaField) {
      console.warn(`Custom field "${fieldName}" not found in schema fields`);
      return null;
    }

    const InputComponent = field.inputComponent;

    return (
      <Card key={field.name}>
        <Stack space={4}>
          <Text size={1} weight={"medium"}>
            {field.title || field.name}
          </Text>
          {InputComponent ? (
            <InputComponent
              {...props}
              path={fieldPath}
              schemaType={schemaField.type}
              value={fieldValue}
            />
          ) : (
            props.renderInput({
              ...props,
              path: fieldPath,
              schemaType: schemaField.type,
              value: fieldValue,
              focused: false,
              readOnly: props.readOnly || false,
              presence: [],
              validation: [],
              level: (props.level || 0) + 1,
            })
          )}
        </Stack>
      </Card>
    );
  });
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
