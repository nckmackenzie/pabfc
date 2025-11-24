/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import { format } from 'date-fns'
import type z from 'zod'
import type { DiscountType, TaxType } from '@/drizzle/schema'
import type {
  SchemaValidationFailure,
  SchemaValidationSuccess,
} from '@/types/index.types'

export const validateSchema = <T>(
  values: unknown,
  schema: z.ZodSchema<T>,
): SchemaValidationFailure | SchemaValidationSuccess<T> => {
  const result = schema.safeParse(values)

  if (!result.success) {
    return {
      data: null,
      error: 'Validation failed. Ensure all required fields are set',
    } satisfies SchemaValidationFailure
  }

  return {
    error: null,
    data: result.data,
  } satisfies SchemaValidationSuccess<T>
}

export function hasAtLeastOneDefinedValue(
  obj: Record<string, any> | null,
): boolean {
  if (!obj || typeof obj !== 'object') return false

  return Object.values(obj).some(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !(typeof value === 'number' && Number.isNaN(value)),
  )
}

export const nonEmptyObjectRefinement = (obj: Record<string, any> | null) =>
  hasAtLeastOneDefinedValue(obj)

export const currencyFormatter = (value: string | number, compact?: boolean) => {
  const numberValue = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    notation: compact ? 'compact' : 'standard',
    compactDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(numberValue)
}

export const dateFormat = (
  date: Date | string,
  formattingType: 'regular' | 'reporting' | 'long' = 'regular',
) => {
  if (formattingType === 'reporting') {
    return format(new Date(date), 'dd/MM/yyyy')
  } else if (formattingType === 'long') {
    return format(new Date(date), 'PPP')
  }
  return format(new Date(date), 'yyyy-MM-dd')
}

export const discountCalculator = (
  discountType: DiscountType,
  discountValue: number,
  itemsTotal: number,
) => {
  let discountAmount = 0

  switch (discountType) {
    case 'percentage':
      discountAmount = (itemsTotal * discountValue) / 100
      break
    case 'amount':
      discountAmount = discountValue
      break
    default:
      break
  }

  return discountAmount
}

export const taxCalculator = (
  subTotal: number,
  taxType: TaxType,
  taxRate = 16,
) => {
  switch (taxType) {
    case 'none':
      return {
        amountExlusiveTax: subTotal,
        taxAmount: 0,
        totalInclusiveTax: subTotal,
      }
    case 'inclusive': {
      const amountExlusiveTax = subTotal / (1 + taxRate / 100)
      return {
        amountExlusiveTax,
        taxAmount: subTotal - amountExlusiveTax,
        totalInclusiveTax: subTotal,
      }
    }
    case 'exclusive': {
      const taxAmount = (subTotal * taxRate) / 100
      return {
        amountExlusiveTax: subTotal,
        taxAmount,
        totalInclusiveTax: subTotal + taxAmount,
      }
    }
  }
}
