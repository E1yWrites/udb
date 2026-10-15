import { expect, it } from 'vitest';
import { deviceReport } from '../src/lib/report.ts';

it('describes descriptors with report sizes and nothing else', () => {
  const report = deviceReport(
    {
      vendorId: 0x3710,
      productId: 0x5406,
      productName: 'Pulsar 8K Dongle',
      match: null,
      interfaces: [
        {
          collections: [
            {
              usagePage: 0xff02,
              usage: 0x0002,
              inputReports: [{ reportId: 8, items: [{ reportSize: 8, reportCount: 16 }] }],
              outputReports: [{ reportId: 8, items: [{ reportSize: 8, reportCount: 16 }] }],
            },
          ],
        },
      ],
    },
    new Date('2026-10-15T12:00:00Z'),
    'test-agent',
  );
  expect(report).toEqual({
    udbReport: 1,
    date: '2026-10-15',
    userAgent: 'test-agent',
    vendorId: '0x3710',
    productId: '0x5406',
    productName: 'Pulsar 8K Dongle',
    registryMatch: null,
    interfaces: [
      { collections: [{ usagePage: '0xFF02', usage: '0x0002', input: [{ id: 8, bytes: 16 }], output: [{ id: 8, bytes: 16 }], feature: [] }] },
    ],
  });
});
