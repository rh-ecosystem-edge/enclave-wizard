import {
  Button,
  FormGroup,
  FormHelperText,
  TextInput,
} from "@patternfly/react-core";
import { MinusCircleIcon, PlusCircleIcon } from "@patternfly/react-icons";
import type React from "react";
import { stepStyles } from "../steps/stepStyles.ts";
import { useRowKeys } from "./useRowKeys.ts";

interface StringArrayFieldProps {
  label: string;
  description?: string;
  values: string[];
  onChange: (values: string[]) => void;
  isRequired?: boolean;
}

export const StringArrayField: React.FC<StringArrayFieldProps> = ({
  label,
  description,
  values,
  onChange,
  isRequired = false,
}) => {
  const { keys, removeAt } = useRowKeys(values.length);
  const rows = values.map((value, index) => ({
    key: keys[index] ?? "",
    value,
    index,
  }));

  const addItem = () => onChange([...values, ""]);

  const removeItem = (index: number) => {
    removeAt(index);
    onChange(values.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) =>
    onChange(values.map((v, i) => (i === index ? value : v)));

  return (
    <FormGroup label={label} isRequired={isRequired} fieldId={`field-${label}`}>
      {rows.map((row) => (
        <div key={row.key} className={stepStyles.arrayItemRow}>
          <TextInput
            id={`field-${label}-${row.index}`}
            value={row.value}
            onChange={(_e, v) => updateItem(row.index, v)}
            aria-label={`${label} item ${row.index + 1}`}
          />
          <Button
            variant="plain"
            aria-label={`Remove ${label} item ${row.index + 1}`}
            onClick={() => removeItem(row.index)}
          >
            <MinusCircleIcon />
          </Button>
        </div>
      ))}
      <Button variant="link" icon={<PlusCircleIcon />} onClick={addItem}>
        Add {label.toLowerCase()}
      </Button>
      {description && <FormHelperText>{description}</FormHelperText>}
    </FormGroup>
  );
};
