import { Button, Grid, Stack } from "@sanity/ui";
import { insert, setIfMissing } from "sanity";
import { AddIcon } from "@sanity/icons";
import { useCallback } from "react";
import { randomKey } from "@sanity/util/content";

export const LimitArray = (props) => {
  const {
    schemaType: { validation = [], options, of },
    members,
    onChange,
  } = props;

  const showAsButtons: boolean = options?.showAsButtons;

  const validationRules = validation
    .flatMap((rule: { _rules: { flag: string; constraint: number }[] }) => rule._rules)
    .find((rule: { flag: string }) => rule.flag === "max");

  const arrayLimit: number | undefined = validationRules ? validationRules.constraint : undefined;

  const arrayHasMaxElements: boolean = members.length >= arrayLimit;

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const selectedType = of.find((type) => type.name === event.currentTarget.value);

      let initialValue = options?.initialValue || selectedType?.initialValue || {};
      if (typeof initialValue === "function") {
        initialValue = await initialValue();
      }

      onChange([
        setIfMissing([]),
        insert(
          [
            {
              _key: randomKey(12),
              _type: event.currentTarget.value,
              ...initialValue,
            },
          ],
          "after",
          [-1],
        ),
      ]);
    },
    [onChange, of, options],
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
