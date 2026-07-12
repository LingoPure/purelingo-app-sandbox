/**
 * Stamp an EXISTING PDF (a dataroom source file) with a per-recipient confidential
 * watermark on every page. Re-exported from @caistech/dataroom-core; degrade-
 * don't-deny (returns the original bytes if a PDF can't be loaded) is preserved.
 */

export { stampPdf } from "@caistech/dataroom-core";
