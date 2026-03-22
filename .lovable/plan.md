

## Plan: Fix Excel Import — Allow Empty CONCEPTO

### Problem
The parser rejects 511 rows because CONCEPTO is empty. These are valid financial records in the real Excel file. The system should accept them with a sensible fallback value.

### Changes

**File: `src/components/movimientos/ModalExcelUpload.tsx`**

1. Remove the strict validation `if (!concepto) throw new Error("CONCEPTO vacío")`
2. When CONCEPTO is empty, generate a fallback value using available fields in this priority:
   - `CATEGORÍA + GRUPO` if both exist (e.g. "NOMINA - SUELDO")
   - `CATEGORÍA` alone if it exists
   - `NOMBRE` if it exists
   - Final fallback: `"Sin concepto"`
3. This ensures all 511 previously-rejected rows get imported with a meaningful description

### Result
The import should go from ~8,700 valid rows to ~9,195+ valid rows, matching the full Excel file.

