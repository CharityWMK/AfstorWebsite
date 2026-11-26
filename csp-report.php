<?php
declare(strict_types=1);

/*
 * Receives Content-Security-Policy violation reports (report-uri) while the policy runs in
 * Report-Only mode, so problems can be fixed before it is enforced.
 *
 * Logs only the violated directive, the blocked source (scheme + host, no path or query) and
 * the page path, to ../afstor-private/logs/csp-YYYY-MM.log, outside the web root.
 * No personal data and no raw IP addresses are stored. Logs older than 90 days are deleted.
 */

ini_set('display_errors', '0');
header_remove('X-Powered-By');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 8192) {
    http_response_code(204);
    exit;
}

$dir = dirname(__DIR__) . '/afstor-private/logs';
if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
    http_response_code(204);
    exit;
}

/* Light per-IP throttle (hashed): at most 60 reports per hour. */
$key = substr(hash('sha256', __DIR__ . '|' . ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 32);
$throttle = $dir . '/.csp-' . $key . '-' . gmdate('YmdH');
$count = is_file($throttle) ? (int) file_get_contents($throttle) : 0;
if ($count >= 60) {
    http_response_code(204);
    exit;
}
@file_put_contents($throttle, (string) ($count + 1), LOCK_EX);

$raw = file_get_contents('php://input', false, null, 0, 8193);
$data = is_string($raw) ? json_decode($raw, true, 6) : null;
$report = is_array($data) ? ($data['csp-report'] ?? ($data[0]['body'] ?? null)) : null;
if (!is_array($report)) {
    http_response_code(204);
    exit;
}

$clean = static function ($value, int $max): string {
    $value = is_string($value) ? $value : '';
    return substr((string) preg_replace('/[^\x21-\x7E]/', '', $value), 0, $max);
};
$originOnly = static function ($url) use ($clean): string {
    $url = $clean($url, 300);
    $parts = parse_url($url);
    if (!is_array($parts) || empty($parts['scheme'])) {
        return $url === '' ? '-' : substr($url, 0, 20); // e.g. "inline", "eval", "data"
    }
    return $parts['scheme'] . '://' . ($parts['host'] ?? '');
};
$pagePath = static function ($url) use ($clean): string {
    $path = parse_url($clean($url, 300), PHP_URL_PATH);
    return is_string($path) ? $path : '-';
};

$line = implode("\t", [
    gmdate('c'),
    $clean($_SERVER['HTTP_HOST'] ?? '', 80),
    'csp',
    $clean($report['effective-directive'] ?? ($report['effectiveDirective'] ?? ($report['violated-directive'] ?? '')), 60),
    $originOnly($report['blocked-uri'] ?? ($report['blockedURL'] ?? '')),
    $pagePath($report['document-uri'] ?? ($report['documentURL'] ?? '')),
]) . "\n";
@file_put_contents($dir . '/csp-' . gmdate('Y-m') . '.log', $line, FILE_APPEND | LOCK_EX);

foreach (array_merge(glob($dir . '/*.log') ?: [], glob($dir . '/.csp-*') ?: []) as $old) {
    $maxAge = substr(basename($old), 0, 5) === '.csp-' ? 7200 : 90 * 86400;
    if (filemtime($old) < time() - $maxAge) {
        @unlink($old);
    }
}

http_response_code(204);
