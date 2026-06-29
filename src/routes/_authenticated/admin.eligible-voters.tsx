import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { uploadEligibleVoters, getEligibleVoters } from '@/lib/admin.functions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, Search, CheckCircle2, AlertCircle, Users, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export const Route = createFileRoute('/_authenticated/admin/eligible-voters')({
  head: () => ({ meta: [{ title: 'Eligible Voters — Admin' }] }),
  component: EligibleVotersPage,
});

type ParsedRow = {
  student_id: string;
  last_name: string;
  first_name: string;
};

type ParseResult =
  | { ok: true; rows: ParsedRow[]; warnings: string[] }
  | { ok: false; error: string };

// ── Column name normaliser ───────────────────────────────────────────────────
function normalise(s: string) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s_\-]+/g, ' ');
}

// Matches for student id column
const STUDENT_ID_ALIASES = ['student id', 'studentid', 'id', 'student no', 'student number', 'student_id'];
// Matches for combined name column
const COMBINED_NAME_ALIASES = [
  'last name, first name',
  'last name first name',
  'lastname firstname',
  'full name',
  'name',
  'student name',
];
// Matches for separate last name
const LAST_NAME_ALIASES = ['last name', 'lastname', 'surname', 'family name'];
// Matches for separate first name
const FIRST_NAME_ALIASES = ['first name', 'firstname', 'given name', 'givenname'];

function findCol(headers: string[], aliases: string[]): string | undefined {
  return headers.find((h) => aliases.includes(normalise(h)));
}

/**
 * Parse an xlsx/csv workbook into rows.
 *
 * Handles files that have decorative title rows at the top (e.g. school name,
 * "Republic of the Philippines", semester info) by scanning every row for one
 * that contains recognisable column header names.
 *
 * Supports:
 *  - Separate "Student ID", "Last Name", "First Name" columns
 *  - Combined "Last Name, First Name" style column (comma or space delimiter)
 */
function parseWorkbook(wb: XLSX.WorkBook): ParseResult {
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { ok: false, error: 'The file has no sheets.' };

  const ws = wb.Sheets[sheetName];

  // Read as raw 2-D array so we can scan every row regardless of how many
  // decorative title rows sit above the actual header.
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (allRows.length === 0) return { ok: false, error: 'The sheet is empty or has no data rows.' };

  // ── Scan for the header row ─────────────────────────────────────────────
  // We look for the first row that contains at least one Student ID alias
  // AND at least one name-related alias.
  const ALL_NAME_ALIASES = [
    ...COMBINED_NAME_ALIASES,
    ...LAST_NAME_ALIASES,
    ...FIRST_NAME_ALIASES,
  ];

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(allRows.length, 30); i++) {
    const rowCells = allRows[i].map((c: any) => normalise(String(c ?? '')));
    const hasId = rowCells.some((c: string) => STUDENT_ID_ALIASES.includes(c));
    const hasName = rowCells.some((c: string) => ALL_NAME_ALIASES.includes(c));
    if (hasId && hasName) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    // Build a helpful preview of what was found in the first few rows
    const preview = allRows
      .slice(0, 5)
      .map((r) => r.filter(Boolean).join(', '))
      .filter(Boolean)
      .join(' | ');
    return {
      ok: false,
      error:
        `Could not find a header row with "Student ID" and name columns in the first 30 rows. ` +
        `First rows found: ${preview || '(empty)'}. ` +
        `Please make sure the file has column headers like "Student ID", "Last Name", "First Name" (or a combined "Last Name, First Name" column).`,
    };
  }

  const headers: string[] = allRows[headerRowIndex].map((c: any) => String(c ?? '').trim());
  const dataRows = allRows.slice(headerRowIndex + 1);

  // ── Locate columns by alias ─────────────────────────────────────────────
  const idCol = headers.findIndex((h) => STUDENT_ID_ALIASES.includes(normalise(h)));
  const combinedColIdx = headers.findIndex((h) => COMBINED_NAME_ALIASES.includes(normalise(h)));
  const lastColIdx = headers.findIndex((h) => LAST_NAME_ALIASES.includes(normalise(h)));
  const firstColIdx = headers.findIndex((h) => FIRST_NAME_ALIASES.includes(normalise(h)));

  if (idCol === -1) {
    return {
      ok: false,
      error: `Found a header row at line ${headerRowIndex + 1} but it has no "Student ID" column. Headers: ${headers.join(', ')}`,
    };
  }

  const hasCombined = combinedColIdx !== -1;
  const hasSeparate = lastColIdx !== -1 && firstColIdx !== -1;

  if (!hasCombined && !hasSeparate) {
    return {
      ok: false,
      error:
        `Found a header row at line ${headerRowIndex + 1} but no name columns. ` +
        `Expected either a combined "Last Name, First Name" column OR separate "Last Name" and "First Name" columns. ` +
        `Headers found: ${headers.join(', ')}`,
    };
  }

  // ── Parse data rows ─────────────────────────────────────────────────────
  const rows: ParsedRow[] = [];
  const warnings: string[] = [];

  dataRows.forEach((r, idx) => {
    const rowNum = headerRowIndex + idx + 2; // 1-based sheet row number
    const student_id = String(r[idCol] ?? '').trim();
    if (!student_id) {
      // silently skip blank rows (common at bottom of enrollment lists)
      return;
    }

    let last_name = '';
    let first_name = '';

    if (hasSeparate) {
      last_name = String(r[lastColIdx] ?? '').trim();
      first_name = String(r[firstColIdx] ?? '').trim();
    } else if (hasCombined) {
      const combined = String(r[combinedColIdx] ?? '').trim();
      // Split on first comma: "Dela Cruz, Juan"  or first space: "Dela Cruz Juan"
      const commaIdx = combined.indexOf(',');
      if (commaIdx !== -1) {
        last_name = combined.slice(0, commaIdx).trim();
        first_name = combined.slice(commaIdx + 1).trim();
      } else {
        const spaceIdx = combined.indexOf(' ');
        if (spaceIdx !== -1) {
          last_name = combined.slice(0, spaceIdx).trim();
          first_name = combined.slice(spaceIdx + 1).trim();
        } else {
          last_name = combined;
          first_name = '';
        }
      }
    }

    if (!last_name) {
      warnings.push(`Row ${rowNum}: missing Last Name for ID "${student_id}" — skipped.`);
      return;
    }

    rows.push({ student_id, last_name, first_name });
  });

  if (rows.length === 0) {
    return {
      ok: false,
      error:
        'No valid data rows found after the header row. Make sure the file has at least one student record.',
    };
  }

  return { ok: true, rows, warnings };
}

// ── Component ────────────────────────────────────────────────────────────────
function EligibleVotersPage() {
  const uploadFn = useServerFn(uploadEligibleVoters);
  const getVotersFn = useServerFn(getEligibleVoters);
  const qc = useQueryClient();

  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: voters, isLoading } = useQuery({
    queryKey: ['eligible-voters'],
    queryFn: () => getVotersFn(),
  });

  // ── File processing ─────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      setParseError('Invalid file type. Please upload an .xlsx, .xls, or .csv file.');
      setParsed(null);
      setFileName(null);
      return;
    }
    setFileName(file.name);
    setParseError(null);
    setParsed(null);
    setParseWarnings([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const result = parseWorkbook(wb);
        if (!result.ok) {
          setParseError(result.error);
        } else {
          setParsed(result.rows);
          setParseWarnings(result.warnings);
        }
      } catch (err: any) {
        setParseError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const clearFile = () => {
    setFileName(null);
    setParsed(null);
    setParseError(null);
    setParseWarnings([]);
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!parsed || parsed.length === 0) return;
    setUploading(true);
    try {
      const result = await uploadFn({ data: { rows: parsed } });
      toast.success(`✓ ${result.total} eligible voter records saved successfully.`);
      clearFile();
      qc.invalidateQueries({ queryKey: ['eligible-voters'] });
    } catch (err: any) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // ── Filtered list ────────────────────────────────────────────────────────
  const filteredVoters = (voters ?? []).filter((v) => {
    const q = search.toLowerCase();
    return (
      v.student_id.toLowerCase().includes(q) ||
      v.last_name.toLowerCase().includes(q) ||
      v.first_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold">Eligible Voters</h1>
        <p className="text-muted-foreground mt-1">
          Upload the official list of students who are eligible to register and vote.
        </p>
      </div>

      {/* Upload Card */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 grid place-items-center">
            <Upload className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Upload Voter List</h2>
            <p className="text-sm text-muted-foreground">
              Accepts <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> files
            </p>
          </div>
        </div>

        {/* Supported formats hint */}
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Supported column formats:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>
              <strong>Student ID</strong> + <strong>Last Name</strong> + <strong>First Name</strong>{' '}
              (separate columns)
            </li>
            <li>
              <strong>Student ID</strong> + <strong>Last Name, First Name</strong> (combined column,
              comma-separated inside)
            </li>
          </ul>
          <p className="text-xs mt-2 text-muted-foreground/70">
            Column headers are case-insensitive. Duplicate Student IDs are updated, not duplicated.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !fileName && fileRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
            ${dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
            ${fileName ? 'cursor-default' : ''}
          `}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={onFileChange}
            id="voter-file-input"
          />
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
            <FileSpreadsheet
              className={`size-10 transition-colors ${dragging ? 'text-primary' : 'text-muted-foreground'}`}
            />
            {fileName ? (
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{fileName}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  className="rounded-full p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove file"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">
                  Drag &amp; drop your file here, or{' '}
                  <span className="text-primary underline underline-offset-2">browse</span>
                </p>
                <p className="text-xs text-muted-foreground">Supports .xlsx, .xls, .csv</p>
              </>
            )}
          </div>
        </div>

        {/* Parse error */}
        {parseError && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <AlertCircle className="size-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Could not parse file</p>
              <p className="text-muted-foreground mt-0.5">{parseError}</p>
            </div>
          </div>
        )}

        {/* Warnings */}
        {parseWarnings.length > 0 && (
          <div className="rounded-lg border border-yellow-400/40 bg-yellow-50/50 dark:bg-yellow-900/10 p-4 text-sm space-y-1">
            <p className="font-semibold text-yellow-700 dark:text-yellow-400">
              {parseWarnings.length} row(s) skipped:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
              {parseWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {parsed && parsed.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-500" />
                <span className="text-sm font-medium">
                  {parsed.length} row{parsed.length !== 1 ? 's' : ''} parsed — preview
                </span>
              </div>
              <Badge variant="secondary">{parsed.length} records</Badge>
            </div>
            <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Student ID</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Last Name</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">First Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsed.slice(0, 100).map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs">{row.student_id}</td>
                      <td className="px-4 py-2">{row.last_name}</td>
                      <td className="px-4 py-2">{row.first_name}</td>
                    </tr>
                  ))}
                  {parsed.length > 100 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-center text-muted-foreground text-xs">
                        … and {parsed.length - 100} more rows (all will be uploaded)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button
              id="upload-eligible-voters-btn"
              onClick={handleUpload}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Upload className="size-4" />
                  Save {parsed.length} Records to Database
                </span>
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Current list */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 grid place-items-center">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Current Eligible Voter List</h2>
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? 'Loading…'
                  : `${voters?.length ?? 0} student${(voters?.length ?? 0) !== 1 ? 's' : ''} on record`}
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="eligible-voters-search"
              placeholder="Search ID or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : filteredVoters.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {search ? 'No records match your search.' : 'No eligible voters uploaded yet.'}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">First Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredVoters.map((v, i) => (
                    <tr key={v.student_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium">{v.student_id}</td>
                      <td className="px-4 py-2.5 font-medium">{v.last_name}</td>
                      <td className="px-4 py-2.5">{v.first_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(v.uploaded_at).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
