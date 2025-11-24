import type { ComponentProps } from 'react'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useFieldContext } from '@/lib/form'
import { cn } from '@/lib/utils'

type TextAreaProps = {
  label: string
  required?: boolean
  placeholder?: string
  helperText?: string
  className?: string
  fieldClassName?: string
}

export function TextAreaField({
  label,
  required,
  placeholder,
  helperText,
  className,
  fieldClassName,
  ...props
}: TextAreaProps & ComponentProps<'textarea'>) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  return (
    <Field data-invalid={isInvalid} className={fieldClassName}>
      <FieldLabel htmlFor={field.name}>
        {label} {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Textarea
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        id={field.name}
        aria-invalid={isInvalid}
        className={cn('field-sizing-content min-h-auto', className)}
        placeholder={placeholder}
        {...props}
      />
      {helperText && <FieldDescription>{helperText}</FieldDescription>}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
