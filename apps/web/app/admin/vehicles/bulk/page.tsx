'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload, XCircle } from 'lucide-react';
import { api, money } from '@/lib/api';

const COLUMNS = [
  'type', 'category', 'brand', 'model', 'variant', 'displayName',
  'registrationNumber', 'year', 'color', 'fuelType', 'transmission',
  'seats', 'engineCc', 'dailyRateINR', 'hourlyRateINR', 'weeklyRateINR',
  'monthlyRateINR', 'securityDepositINR', 'includedKmPerDay',
  'extraKmRateINR', 'lateFeePerHourINR', 'pickupLocation', 'description',
  'features', 'isFeatured', 'isPublished',
];

type CsvVehicle = {
  type: string;
  category: string;
  brand: string;
  model: string;
  variant?: string;
  displayName: string;
  registrationNumber: string;
  year?: number;
  color?: string;
  fuelType: string;
  transmission?: string;
  seats?: number;
  engineCc?: number;
  dailyRatePaise: number;
  hourlyRatePaise?: number;
  weeklyRatePaise?: number;
  monthlyRatePaise?: number;
  securityDepositPaise?: number;
  includedKmPerDay?: number;
  extraKmRatePaise?: number;
  lateFeePerHourPaise?: number;
  pickupLocation: string;
  description?: string;
  features: string[];
  isFeatured: boolean;
  isPublished: boolean;
};

type ImportResult = {
  total: number;
  created: number;
  failed: number;
  results: Array<{
    row: number;
    success: boolean;
    id?: string;
    displayName?: string;
    registrationNumber: string;
    error?: string;
  }>;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"' && value.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(value.trim());
      value = '';
    } else if (char === '\n') {
      row.push(value.trim());
      if (row.some(cell => cell.length > 0)) rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some(cell => cell.length > 0)) rows.push(row);
  return rows;
}

function parseBoolean(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
}

function parseVehicleRows(csvText: string): { vehicles: CsvVehicle[]; errors: string[] } {
  const matrix = parseCsv(csvText.replace(/^\uFEFF/, ''));
  if (matrix.length < 2) {
    return { vehicles: [], errors: ['The CSV must contain a header row and at least one vehicle row.'] };
  }

  const headers = matrix[0].map(header => header.trim().toLowerCase());
  const index = new Map(headers.map((header, i) => [header, i]));
  const required = [
    'type', 'category', 'brand', 'model', 'displayname',
    'registrationnumber', 'fueltype', 'dailyrateinr', 'pickuplocation',
  ];
  const missing = required.filter(header => !index.has(header));
  if (missing.length) {
    return { vehicles: [], errors: ['Missing required CSV columns: ' + missing.join(', ')] };
  }

  const vehicles: CsvVehicle[] = [];
  const errors: string[] = [];

  const cell = (row: string[], key: string) => {
    const position = index.get(key.toLowerCase());
    return position === undefined ? '' : (row[position] ?? '').trim();
  };

  const numberValue = (
    row: string[],
    key: string,
    rowNumber: number,
    options: { required?: boolean; integer?: boolean; rupees?: boolean } = {},
  ): number | undefined => {
    const raw = cell(row, key);
    if (!raw) {
      if (options.required) errors.push('Row ' + rowNumber + ': ' + key + ' is required.');
      return undefined;
    }
    const parsed = Number(raw.replace(/,/g, '').replace(/^₹\s*/, ''));
    if (!Number.isFinite(parsed) || (options.integer && !Number.isInteger(parsed)) || parsed < 0) {
      errors.push('Row ' + rowNumber + ': ' + key + ' must be a valid non-negative ' + (options.integer ? 'whole number.' : 'number.'));
      return undefined;
    }
    return options.rupees ? Math.round(parsed * 100) : parsed;
  };

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    const rowNumber = i + 1;
    const type = cell(row, 'type').toUpperCase();
    const category = cell(row, 'category').toUpperCase();
    const fuelType = cell(row, 'fuelType').toUpperCase();
    const transmission = cell(row, 'transmission').toUpperCase();
    const brand = cell(row, 'brand');
    const model = cell(row, 'model');
    const displayName = cell(row, 'displayName');
    const registrationNumber = cell(row, 'registrationNumber');
    const pickupLocation = cell(row, 'pickupLocation');

    if (!['CAR', 'BIKE'].includes(type)) errors.push('Row ' + rowNumber + ': type must be CAR or BIKE.');
    const allowedCategories = type === 'CAR'
      ? ['HATCHBACK', 'SEDAN', 'SUV', 'LUXURY']
      : ['SPORTS_BIKE', 'SCOOTER', 'MOTORCYCLE', 'ELECTRIC_BIKE'];
    if (!allowedCategories.includes(category)) {
      errors.push('Row ' + rowNumber + ': category is not valid for ' + (type || 'this vehicle') + '.');
    }
    if (!['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'].includes(fuelType)) {
      errors.push('Row ' + rowNumber + ': fuelType must be PETROL, DIESEL, ELECTRIC, HYBRID or CNG.');
    }
    if (transmission && !['MANUAL', 'AUTOMATIC'].includes(transmission)) {
      errors.push('Row ' + rowNumber + ': transmission must be MANUAL or AUTOMATIC.');
    }
    if (!brand || !model || !displayName || !registrationNumber || !pickupLocation) {
      errors.push('Row ' + rowNumber + ': brand, model, displayName, registrationNumber and pickupLocation are required.');
    }

    const year = numberValue(row, 'year', rowNumber, { integer: true });
    const seats = numberValue(row, 'seats', rowNumber, { integer: true });
    const engineCc = numberValue(row, 'engineCc', rowNumber, { integer: true });
    const dailyRatePaise = numberValue(row, 'dailyRateINR', rowNumber, { required: true, rupees: true });
    const hourlyRatePaise = numberValue(row, 'hourlyRateINR', rowNumber, { rupees: true });
    const weeklyRatePaise = numberValue(row, 'weeklyRateINR', rowNumber, { rupees: true });
    const monthlyRatePaise = numberValue(row, 'monthlyRateINR', rowNumber, { rupees: true });
    const securityDepositPaise = numberValue(row, 'securityDepositINR', rowNumber, { rupees: true });
    const includedKmPerDay = numberValue(row, 'includedKmPerDay', rowNumber, { integer: true });
    const extraKmRatePaise = numberValue(row, 'extraKmRateINR', rowNumber, { rupees: true });
    const lateFeePerHourPaise = numberValue(row, 'lateFeePerHourINR', rowNumber, { rupees: true });

    if (dailyRatePaise === undefined) continue;

    vehicles.push({
      type, category, brand, model,
      variant: cell(row, 'variant') || undefined,
      displayName, registrationNumber,
      year, color: cell(row, 'color') || undefined,
      fuelType, transmission: transmission || undefined,
      seats, engineCc, dailyRatePaise,
      hourlyRatePaise, weeklyRatePaise, monthlyRatePaise,
      securityDepositPaise, includedKmPerDay,
      extraKmRatePaise, lateFeePerHourPaise,
      pickupLocation,
      description: cell(row, 'description') || undefined,
      features: cell(row, 'features').split('|').map(feature => feature.trim()).filter(Boolean),
      isFeatured: parseBoolean(cell(row, 'isFeatured'), false),
      isPublished: parseBoolean(cell(row, 'isPublished'), true),
    });
  }

  return { vehicles, errors };
}

function downloadTemplate() {
  const csv = COLUMNS.join(',') + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'roadnest-vehicle-bulk-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BulkVehicleImportPage() {
  const router = useRouter();
  const [fileName, setFileName] = useState('');
  const [vehicles, setVehicles] = useState<CsvVehicle[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    api('/auth/me')
      .then((me: any) => {
        if (!['ADMIN', 'STAFF'].includes(me.user?.role)) router.replace('/account');
      })
      .catch(() => router.replace('/login'))
      .finally(() => setAuthChecking(false));
  }, [router]);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);
    setRequestError('');
    setErrors([]);
    setVehicles([]);
    setFileName('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrors(['Please select a .csv file.']);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors(['CSV file must be smaller than 2 MB.']);
      return;
    }

    const parsed = parseVehicleRows(await file.text());
    setFileName(file.name);
    setVehicles(parsed.vehicles);
    setErrors(parsed.errors);
  }

  async function importVehicles() {
    if (!vehicles.length || errors.length) return;
    setBusy(true);
    setRequestError('');
    setResult(null);
    try {
      const response = await api<ImportResult>('/vehicles/bulk', {
        method: 'POST',
        body: JSON.stringify({ vehicles }),
      });
      setResult(response);
    } catch (error: any) {
      setRequestError(error.message || 'Bulk import failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (authChecking) {
    return <main className="page-shell container"><div className="loading-state">Checking administrator access…</div></main>;
  }

  return (
    <main className="page-shell admin-shell">
      <div className="container dashboard-header">
        <div>
          <span className="section-kicker">FLEET MANAGEMENT</span>
          <h1>Bulk add <em>vehicles.</em></h1>
          <p>Import many cars and bikes into your RoadNest fleet using one CSV spreadsheet.</p>
        </div>
        <div className="admin-quick-actions">
          <Link href="/admin/vehicles" className="button button-outline"><ArrowLeft size={16} /> Back to vehicles</Link>
        </div>
      </div>

      <div className="container admin-content full-width">
        <section className="panel-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">STEP 1</span>
              <h2>Download the CSV template</h2>
            </div>
            <FileSpreadsheet size={26} />
          </div>
          <p>Fill one row per vehicle. You can add 6 cars, 10 bikes or any mix, up to 100 vehicles per import.</p>
          <button className="button button-outline" type="button" onClick={downloadTemplate}>
            <Download size={16} /> Download CSV template
          </button>
          <div className="notice" style={{ marginTop: 18 }}>
            <strong>Important CSV rules</strong>
            <ul>
              <li>Use CAR or BIKE for type.</li>
              <li>Use categories: HATCHBACK, SEDAN, SUV, LUXURY, SPORTS_BIKE, SCOOTER, MOTORCYCLE or ELECTRIC_BIKE.</li>
              <li>Fuel type: PETROL, DIESEL, ELECTRIC, HYBRID or CNG. Transmission: MANUAL or AUTOMATIC.</li>
              <li>Enter rental prices in rupees, for example 1800 (not paise).</li>
              <li>Separate features with a vertical bar: AC|Bluetooth|USB charging.</li>
              <li>Use the actual unique registration number for every vehicle.</li>
              <li>Leave optional fields blank. New vehicles are published by default.</li>
            </ul>
          </div>
        </section>

        <section className="panel-card" style={{ marginTop: 24 }}>
          <div className="panel-heading">
            <div>
              <span className="section-kicker">STEP 2</span>
              <h2>Upload and preview</h2>
            </div>
            <Upload size={24} />
          </div>
          <label className="form-label">
            Choose completed CSV file
            <input type="file" accept=".csv,text/csv" onChange={selectFile} />
          </label>
          {fileName && <p><strong>Selected:</strong> {fileName}</p>}
          {vehicles.length > 0 && (
            <div className="notice" style={{ marginTop: 14 }}>
              Preview: <strong>{vehicles.length} valid vehicle row(s)</strong> — {vehicles.filter(vehicle => vehicle.type === 'CAR').length} cars and {vehicles.filter(vehicle => vehicle.type === 'BIKE').length} bikes.
            </div>
          )}
          {errors.length > 0 && (
            <div className="notice error" style={{ marginTop: 14 }}>
              <strong>Please fix these CSV issues before importing:</strong>
              <ul>{errors.slice(0, 30).map((error, index) => <li key={index}>{error}</li>)}</ul>
              {errors.length > 30 && <p>And {errors.length - 30} more issue(s).</p>}
            </div>
          )}
          {vehicles.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 18 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    {['#', 'Type', 'Vehicle', 'Registration', 'Daily rate', 'Pickup location'].map(label => (
                      <th key={label} style={{ padding: 12, borderBottom: '1px solid #d9e2dc', whiteSpace: 'nowrap' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.slice(0, 12).map((vehicle, index) => (
                    <tr key={vehicle.registrationNumber + index}>
                      <td style={{ padding: 12, borderBottom: '1px solid #edf1ee' }}>{index + 1}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #edf1ee' }}>{vehicle.type}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #edf1ee' }}>{vehicle.displayName}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #edf1ee' }}>{vehicle.registrationNumber}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #edf1ee' }}>{money(vehicle.dailyRatePaise)}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #edf1ee' }}>{vehicle.pickupLocation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vehicles.length > 12 && <p>Showing first 12 rows of {vehicles.length}.</p>}
            </div>
          )}
          {requestError && <div className="notice error" style={{ marginTop: 14 }}>{requestError}</div>}
          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button className="button button-primary" type="button" disabled={busy || vehicles.length === 0 || errors.length > 0} onClick={importVehicles}>
              {busy ? <><LoaderCircle size={16} className="spin" /> Importing…</> : <><Upload size={16} /> Import {vehicles.length} vehicle(s) into database</>}
            </button>
          </div>
        </section>

        {result && (
          <section className="panel-card" style={{ marginTop: 24 }}>
            <div className="panel-heading">
              <div>
                <span className="section-kicker">IMPORT RESULTS</span>
                <h2>Import completed</h2>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
              <strong><CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Created: {result.created}</strong>
              <strong><XCircle size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Failed: {result.failed}</strong>
              <strong>Total rows: {result.total}</strong>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {result.results.map(item => (
                <div key={item.row} className="fleet-row">
                  <span>{item.success ? <CheckCircle2 color="green" /> : <XCircle color="red" />}</span>
                  <div className="fleet-row-name">
                    <strong>CSV row {item.row + 1}: {item.displayName || item.registrationNumber}</strong>
                    <small>{item.registrationNumber}</small>
                    {!item.success && <small className="notice error">{item.error}</small>}
                  </div>
                  <span>{item.success ? 'Created' : 'Not imported'}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <Link href="/admin/vehicles" className="button button-primary">View fleet</Link>
            </div>
          </section>
        )}

        <section className="panel-card" style={{ marginTop: 24 }}>
          <strong>About vehicle photos</strong>
          <p>Bulk CSV import adds vehicle details and rental rates. Upload photographs separately from each vehicle's edit screen after Cloudinary image storage is configured.</p>
        </section>
      </div>
    </main>
  );
}
