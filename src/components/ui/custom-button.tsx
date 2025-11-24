import {
  CheckIcon,
  FileSpreadsheetIcon,
  MoreVerticalIcon,
  PencilIcon,
  PrinterIcon,
  SparkleIcon,
  TrashIcon,
} from '@/components/ui/icons'

export function MoreButton() {
  return (
    <button type="button">
      <MoreVerticalIcon className="size-4 text-muted-foreground" />
    </button>
  )
}

export function CheckButton({ text }: { text: string }) {
  return (
    <>
      <CheckIcon className="size-3 text-muted-foreground" />
      <span className="text-xs">{text}</span>
    </>
  )
}

export function EditAction() {
  return (
    <>
      <PencilIcon className="size-3 text-muted-foreground" />
      <span className="text-xs -ml-1">Edit</span>
    </>
  )
}

export function PrintAction() {
  return (
    <>
      <PrinterIcon className="size-3 text-muted-foreground" />
      <span className="text-xs">Print</span>
    </>
  )
}

export function ViewDetailsAction({ text }: { text?: string }) {
  return (
    <>
      <FileSpreadsheetIcon className="size-3 text-muted-foreground" />
      <span className="text-xs">{text || 'Details'}</span>
    </>
  )
}

export function AutomateAction({ text }: { text: string }) {
  return (
    <>
      <SparkleIcon className="size-3 text-muted-foreground" />
      <span className="text-xs">{text}</span>
    </>
  )
}

export function DeleteAction() {
  return (
    <>
      <TrashIcon className="size-3 text-destructive" />
      <span className="text-destructive text-xs">Delete</span>
    </>
  )
}