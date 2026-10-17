import { expect, it } from 'vitest';
import { descriptorLines } from '../src/lib/descriptor.ts';
import { diagnosticsReport } from '../src/lib/report.ts';

const collections: HIDCollectionInfo[] = [
  {
    usagePage: 0xff60,
    usage: 0x61,
    inputReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 32, usages: [(0xff60 << 16) | 0x62], logicalMinimum: 0, logicalMaximum: 255 }] }],
    featureReports: [{ reportId: 4, items: [{ reportSize: 8, reportCount: 2, isRange: true, usageMinimum: 1, usageMaximum: 2, isConstant: true }] }],
    children: [{ usagePage: 0x59, usage: 1, featureReports: [{ reportId: 2, items: [{ reportSize: 16, reportCount: 1, usages: [0x00590002] }] }] }],
  },
];

it('prints each collection, report and item, children indented', () => {
  expect(descriptorLines(collections)).toEqual([
    'Collection FF60:0061',
    '  Input report 0x00, 32 bytes',
    '    8 bits × 32 · usage FF60:0062 · logical 0 to 255',
    '  Feature report 0x04, 2 bytes',
    '    8 bits × 2 · usages 0x0001 to 0x0002 · constant',
    '  Collection 0059:0001',
    '    Feature report 0x02, 2 bytes',
    '      16 bits × 1 · usage 0059:0002',
  ]);
});

it('exports the readable descriptor and the whole log, and no input data', () => {
  const log = [
    { at: '2026-10-18T10:00:00.000Z', dir: 'tx' as const, reportId: 4, hex: '04 01' },
    { at: '2026-10-18T10:00:00.020Z', dir: 'rx' as const, reportId: 4, hex: '04 01 02', via: 'feature' as const },
  ];
  const report = diagnosticsReport(
    { vendorId: 0x1234, productId: 0x5678, productName: 'Test', match: null, interfaces: [{ collections }] },
    log,
    new Date('2026-10-18T12:00:00Z'),
    'test-agent',
  ) as Record<string, unknown>;
  expect(report.udbDiagnostics).toBe(1);
  expect(report.log).toEqual(log);
  expect((report.descriptor as string[][])[0]![0]).toBe('Collection FF60:0061');
  expect(Object.keys(report).sort()).toEqual(['date', 'descriptor', 'interfaces', 'log', 'productId', 'productName', 'registryMatch', 'udbDiagnostics', 'udbReport', 'userAgent', 'vendorId']);
});
