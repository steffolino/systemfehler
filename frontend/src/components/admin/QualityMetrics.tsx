import { useState, useEffect } from 'react';
import { api, type QualityReportResponse } from '../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

export function QualityMetrics() {
  const [report, setReport] = useState<QualityReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getQualityReport();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quality report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading quality metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Error: {error}
      </div>
    );
  }

  if (!report) return null;

  const totalEntries = Object.values(report.byDomain).reduce(
    (sum, domain) => sum + domain.totalEntries,
    0
  );
  const avgIqs =
    Object.values(report.byDomain).reduce((sum, domain) => sum + parseFloat(domain.avgIqs), 0) /
    Object.values(report.byDomain).length;
  const avgAis =
    Object.values(report.byDomain).reduce((sum, domain) => sum + parseFloat(domain.avgAis), 0) /
    Object.values(report.byDomain).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Entries</CardDescription>
            <CardTitle className="text-4xl">{totalEntries}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Average IQS</CardDescription>
            <CardTitle className="text-4xl">
              {avgIqs.toFixed(1)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Average AIS</CardDescription>
            <CardTitle className="text-4xl">
              {avgAis.toFixed(1)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Low Quality</CardDescription>
            <CardTitle className="text-4xl text-red-600">
              {report.lowQualityEntries.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* By Domain Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Quality by Domain</CardTitle>
          <CardDescription>Quality metrics broken down by content domain</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-semibold">Domain</th>
                  <th className="text-right p-2 font-semibold">Entries</th>
                  <th className="text-right p-2 font-semibold">Active</th>
                  <th className="text-right p-2 font-semibold">Avg IQS</th>
                  <th className="text-right p-2 font-semibold">Avg AIS</th>
                  <th className="text-right p-2 font-semibold">Missing EN</th>
                  <th className="text-right p-2 font-semibold">Missing Easy DE</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.byDomain).map(([domain, stats]) => (
                  <tr key={domain} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      <Badge variant="outline">
                        {domain.charAt(0).toUpperCase() + domain.slice(1)}
                      </Badge>
                    </td>
                    <td className="text-right p-2">{stats.totalEntries}</td>
                    <td className="text-right p-2">{stats.activeEntries}</td>
                    <td className="text-right p-2">
                      <span
                        className={
                          parseFloat(stats.avgIqs) >= 80
                            ? 'text-green-600'
                            : parseFloat(stats.avgIqs) >= 60
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }
                      >
                        {stats.avgIqs}
                      </span>
                    </td>
                    <td className="text-right p-2">
                      <span
                        className={
                          parseFloat(stats.avgAis) >= 80
                            ? 'text-green-600'
                            : parseFloat(stats.avgAis) >= 60
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }
                      >
                        {stats.avgAis}
                      </span>
                    </td>
                    <td className="text-right p-2 text-red-600">{stats.missingEnTranslation}</td>
                    <td className="text-right p-2 text-red-600">
                      {stats.missingEasyDeTranslation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Low Quality Entries */}
      {report.lowQualityEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Low Quality Entries</CardTitle>
            <CardDescription>
              Entries with IQS or AIS below 50 that need attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.lowQualityEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{entry.title}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {entry.url}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-4 ml-4">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">IQS</div>
                      <div className="font-semibold text-red-600">
                        {entry.iqs.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">AIS</div>
                      <div className="font-semibold text-red-600">
                        {entry.ais.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Translations */}
      {report.missingTranslations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Missing Translations</CardTitle>
            <CardDescription>
              Entries that need English or Easy German translations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Title</th>
                    <th className="text-left p-2 font-semibold">Domain</th>
                    <th className="text-center p-2 font-semibold">Missing EN</th>
                    <th className="text-center p-2 font-semibold">Missing Easy DE</th>
                  </tr>
                </thead>
                <tbody>
                  {report.missingTranslations.slice(0, 20).map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div className="max-w-md truncate">{entry.title}</div>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{entry.domain}</Badge>
                      </td>
                      <td className="text-center p-2">
                        {entry.missingEn && (
                          <Badge variant="destructive">Missing</Badge>
                        )}
                      </td>
                      <td className="text-center p-2">
                        {entry.missingEasyDe && (
                          <Badge variant="destructive">Missing</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
