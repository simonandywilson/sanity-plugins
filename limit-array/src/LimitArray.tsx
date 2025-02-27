import { Button, Grid, Stack } from "@sanity/ui";
import {  insert, setIfMissing, useClient } from "sanity";
import { AddIcon } from "@sanity/icons";
import { useCallback, useState } from "react";
import { randomKey } from "@sanity/util/content";

export const LimitArray = (props) => {
  const [currentKey, setCurrentKey] = useState<string>(randomKey(12));

  const {
    schemaType: { validation = [], options, of },
    members,
    onChange,
  } = props;

  const client = useClient({ apiVersion: `2023-04-01` });

  const showAsButtons: boolean[] = options?.showAsButtons;

  const validationRules = validation
    .flatMap((rule: { _rules: any }) => rule._rules)
    .find((rule: { flag: string }) => rule.flag === "max");

  const arrayLimit: boolean[] = validationRules ? validationRules.constraint : undefined;

  const arrayHasMaxElements: Boolean = members.length >= arrayLimit ? true : false;

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const key = randomKey(12);
      setCurrentKey(key);
      
      // Find the selected type from the schema
      const selectedType = of.find(type => type.name === event.currentTarget.value);
      
      // Get the initial value from either the field options or type definition
      let initialValue = options?.initialValue || selectedType?.initialValue || {};
      if (typeof initialValue === 'function') {
        initialValue = await initialValue();
      }

      onChange([
        setIfMissing([]),
        insert(
          [
            {
              _key: currentKey,
              _type: event.currentTarget.value,
              ...initialValue
            },
          ],
          "after",
          [-1],
        ),
      ]);
    },
    [onChange, client, currentKey, of, options],
  );

  return arrayHasMaxElements ? (
    props.renderDefault({ ...props, arrayFunctions: () => null })
  ) : (
    <>
      {showAsButtons ? (
        <Stack space={2}>
          {props.renderDefault({ ...props, arrayFunctions: () => null })}
          <Grid columns={of.length} gap={1}>
            {of.map((type) => {
              const { name, title } = type;
              return (
                <Button
                  key={name}
                  value={name}
                  icon={AddIcon}
                  text={title}
                  mode={"ghost"}
                  onClick={handleClick}
                />
              );
            })}
          </Grid>
        </Stack>
      ) : (
        props.renderDefault(props)
      )}
    </>
  );
};
