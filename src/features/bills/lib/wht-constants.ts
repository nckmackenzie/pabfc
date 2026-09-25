/**
 * Default withholding tax rate, as a percentage, pre-filled when a bill line is
 * marked as withheld. The rate is stored per line and stays fully editable, so
 * this is only a starting point.
 *
 * ⚠️ CONFIRM BEFORE FILING ⚠️
 * 5% is the commonly cited rate for professional, management and training fees
 * paid to *resident* vendors — the most frequent case, which is why it is the
 * default. Other natures of expense differ (rent on immovable property and
 * contractual fees are withheld at different rates), and payments to
 * non-residents are withheld at materially higher rates. Verify against the
 * current Income Tax Act third schedule before relying on this for a real return,
 * and override the rate per line wherever it does not apply.
 */
export const DEFAULT_WHT_RATE = 5;
